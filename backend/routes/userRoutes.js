const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({ username, email, password });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      token: generateToken(user._id)
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET profile (protected)
router.get('/profile', protect, async (req, res) => {
  res.json(req.user);
});

// BOOKMARK a recipe (protected)
router.post('/bookmark/:recipeId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const recipeId = req.params.recipeId;

    const isBookmarked = user.bookmarks.includes(recipeId);

    if (isBookmarked) {
      user.bookmarks = user.bookmarks.filter(id => id.toString() !== recipeId);
    } else {
      user.bookmarks.push(recipeId);
    }

    await user.save();
    res.json({ bookmarks: user.bookmarks });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
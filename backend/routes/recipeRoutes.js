const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const { protect } = require('../middleware/auth');

// GET all recipes (with search & filter)
router.get('/', async (req, res) => {
  try {
    const { search, cuisine, category, difficulty } = req.query;
    let query = {};

    if (search) query.title = { $regex: search, $options: 'i' };
    if (cuisine) query.cuisine = cuisine;
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    const recipes = await Recipe.find(query)
      .populate('author', 'username')
      .sort({ createdAt: -1 });

    res.json(recipes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET single recipe
router.get('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate('author', 'username')
      .populate('ratings.user', 'username');

    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// CREATE recipe (protected)
router.post('/', protect, async (req, res) => {
  try {
    const recipe = await Recipe.create({
      ...req.body,
      author: req.user._id
    });
    res.status(201).json(recipe);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// UPDATE recipe (protected)
router.put('/:id', protect, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    if (recipe.author.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const updated = await Recipe.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE recipe (protected)
router.delete('/:id', protect, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    if (recipe.author.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await recipe.deleteOne();
    res.json({ message: 'Recipe deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ADD rating & review (protected)
router.post('/:id/review', protect, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    const { rating, review } = req.body;

    // Check if user already reviewed
    const alreadyReviewed = recipe.ratings.find(
      r => r.user.toString() === req.user._id.toString()
    );
    if (alreadyReviewed) {
      return res.status(400).json({ message: 'You already reviewed this recipe' });
    }

    recipe.ratings.push({ user: req.user._id, rating, review });

    // Update average rating
    recipe.averageRating = recipe.ratings.reduce((acc, r) => acc + r.rating, 0) / recipe.ratings.length;

    await recipe.save();
    res.status(201).json({ message: 'Review added' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
// DELETE review (protected)
router.delete('/:id/review/:reviewId', protect, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    const review = recipe.ratings.id(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    recipe.ratings.pull({ _id: req.params.reviewId });

    // Recalculate average
    if (recipe.ratings.length > 0) {
      recipe.averageRating = recipe.ratings.reduce(
        (acc, r) => acc + r.rating, 0) / recipe.ratings.length;
    } else {
      recipe.averageRating = 0;
    }

    await recipe.save();
    res.json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
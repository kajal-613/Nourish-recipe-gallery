const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/recipes', require('./routes/recipeRoutes'));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working! ✅' });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected ✅'))
  .catch(err => console.log('DB Error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));

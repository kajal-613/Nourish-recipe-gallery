const mongoose = require('mongoose');

const RecipeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  cuisine: {
    type: String,
    required: true  // e.g. "Indian", "Italian", "Mexican"
  },
  category: {
    type: String,
    required: true  // e.g. "Breakfast", "Lunch", "Dinner", "Dessert"
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Easy'
  },
  prepTime: { type: Number },   // in minutes
  cookTime: { type: Number },   // in minutes
  servings: { type: Number, default: 2 },
  image: { type: String },      // image URL from Cloudinary

  ingredients: [
    {
      name: { type: String, required: true },
      quantity: { type: String, required: true }, // e.g. "2 cups"
    }
  ],

  instructions: [
    {
      step: { type: Number },
      description: { type: String, required: true },
      timer: { type: Number, default: 0 }  // timer in minutes for that step
    }
  ],

  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  ratings: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rating: { type: Number, min: 1, max: 5 },
      review: { type: String },
      createdAt: { type: Date, default: Date.now }
    }
  ],

  averageRating: { type: Number, default: 0 },

}, { timestamps: true });

module.exports = mongoose.model('Recipe', RecipeSchema);
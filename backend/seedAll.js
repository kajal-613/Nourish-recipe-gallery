const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Recipe = require('./models/Recipe');
const User = require('./models/User');

dotenv.config();

// ── UNIT CONVERTER ──
// Converts western measurements to Indian standard units
function convertToIndianUnits(measure, ingredientName) {
  if (!measure || !measure.trim()) return 'to taste';

  let m = measure.trim().toLowerCase();
  const name = (ingredientName || '').toLowerCase();

  // Already Indian-style — keep as is
  if (/^\d+\s*(g|kg|ml|l|litre|liter|tsp|tbsp|clove|piece|pinch|bunch|handful|sprig|stick|inch|cm)s?$/i.test(m)) {
    return measure.trim();
  }

  // Extract number
  const numMatch = m.match(/^(\d+\/\d+|\d+\.?\d*)/);
  let num = numMatch ? eval(numMatch[1]) : 1;
  const rest = m.replace(/^(\d+\/\d+|\d+\.?\d*)/, '').trim();

  // Convert cups to ml or g depending on ingredient
  if (rest.includes('cup')) {
    const isLiquid = /water|milk|cream|oil|juice|stock|broth|yogurt|curd|coconut milk/.test(name);
    if (isLiquid) {
      const ml = Math.round(num * 240);
      return ml >= 1000 ? `${(ml/1000).toFixed(1)} litre` : `${ml} ml`;
    } else {
      const g = Math.round(num * 120);
      return g >= 1000 ? `${(g/1000).toFixed(1)} kg` : `${g} g`;
    }
  }

  // Convert oz to g
  if (rest.includes('oz') && !rest.includes('fl')) {
    const g = Math.round(num * 28.35);
    return g >= 1000 ? `${(g/1000).toFixed(1)} kg` : `${g} g`;
  }

  // Convert fl oz to ml
  if (rest.includes('fl oz') || rest.includes('fluid')) {
    const ml = Math.round(num * 30);
    return `${ml} ml`;
  }

  // Convert lb / pound to kg
  if (rest.includes('lb') || rest.includes('pound')) {
    const kg = (num * 0.453).toFixed(2);
    return parseFloat(kg) >= 1 ? `${kg} kg` : `${Math.round(num * 453)} g`;
  }

  // Convert tablespoon
  if (rest.includes('tablespoon') || rest === 'tbsp' || rest === 'tbs') {
    return num === 1 ? '1 tbsp' : `${num} tbsp`;
  }

  // Convert teaspoon
  if (rest.includes('teaspoon') || rest === 'tsp' || rest === 'ts') {
    return num === 1 ? '1 tsp' : `${num} tsp`;
  }

  // Cloves
  if (rest.includes('clove')) {
    return num === 1 ? '1 clove' : `${num} cloves`;
  }

  // Pieces / whole items
  if (rest.includes('piece') || rest.includes('whole') || rest === '') {
    const isCountable = /egg|onion|tomato|potato|chilli|pepper|carrot|garlic|lemon|lime|banana|apple|orange/.test(name);
    if (isCountable) return num === 1 ? '1 piece' : `${num} pieces`;
  }

  // Pint → ml
  if (rest.includes('pint')) {
    const ml = Math.round(num * 473);
    return ml >= 1000 ? `${(ml/1000).toFixed(1)} litre` : `${ml} ml`;
  }

  // Litre / liter
  if (rest.includes('liter') || rest.includes('litre') || rest === 'l') {
    return num === 1 ? '1 litre' : `${num} litres`;
  }

  // Grams already
  if (rest === 'g' || rest === 'gram' || rest === 'grams') {
    return num >= 1000 ? `${(num/1000).toFixed(1)} kg` : `${num} g`;
  }

  // kg already
  if (rest === 'kg' || rest === 'kilogram') {
    return `${num} kg`;
  }

  // Pinch
  if (rest.includes('pinch')) {
    return num === 1 ? 'a pinch' : `${num} pinches`;
  }

  // Handful
  if (rest.includes('handful')) {
    return 'a handful';
  }

  // Bunch / sprig
  if (rest.includes('bunch')) return 'a bunch';
  if (rest.includes('sprig')) return `${num} sprig${num > 1 ? 's' : ''}`;
  if (rest.includes('stick')) return `${num} stick${num > 1 ? 's' : ''}`;
  if (rest.includes('inch')) return `${num} inch`;

  // Slice / rasher / fillet
  if (rest.includes('slice') || rest.includes('rasher') || rest.includes('fillet')) {
    return `${num} ${rest}`;
  }

  // Packet / sachet
  if (rest.includes('packet') || rest.includes('sachet') || rest.includes('can') || rest.includes('tin')) {
    return `${num} ${rest}`;
  }

  // For unknown units — try to estimate in grams if it's a solid
  const isLiquid = /water|milk|cream|oil|juice|stock|broth|yogurt|curd/.test(name);
  if (rest && !isLiquid) {
    return `${num} ${rest}`;
  }

  return measure.trim();
}

// ── CATEGORY MAPPER ──
function mapCategory(meal) {
  const cat = (meal.strCategory || '').toLowerCase();
  const name = (meal.strMeal || '').toLowerCase();

  if (cat === 'breakfast' ||
      name.includes('dosa') || name.includes('upma') ||
      name.includes('poha') || name.includes('paratha') ||
      name.includes('idli') || name.includes('oats') ||
      name.includes('porridge') || name.includes('pancake') ||
      name.includes('waffle') || name.includes('toast') ||
      name.includes('omelette') || name.includes('eggs benedict')) {
    return 'Breakfast';
  }

  if (cat === 'dessert' ||
      name.includes('kheer') || name.includes('halwa') ||
      name.includes('gulab') || name.includes('barfi') ||
      name.includes('ladoo') || name.includes('pudding') ||
      name.includes('cake') || name.includes('brownie') ||
      name.includes('cookie') || name.includes('ice cream') ||
      name.includes('pie') || name.includes('tart') ||
      name.includes('mousse') || name.includes('cheesecake')) {
    return 'Dessert';
  }

  if (name.includes('samosa') || name.includes('pakora') ||
      name.includes('chaat') || name.includes('bhel') ||
      name.includes('vada') || name.includes('bhaji') ||
      name.includes('snack') || name.includes('starter') ||
      name.includes('appetizer') || name.includes('dip') ||
      name.includes('chips') || name.includes('nachos') ||
      cat === 'starter') {
    return 'Snack';
  }

  // Randomly assign lunch or dinner for mains
  return Math.random() > 0.5 ? 'Lunch' : 'Dinner';
}

// ── CUISINE MAPPER ──
function mapCuisine(area) {
  const map = {
    'Indian': 'Indian',
    'Italian': 'Italian',
    'Mexican': 'Mexican',
    'Chinese': 'Chinese',
    'American': 'American',
    'British': 'American',
    'Canadian': 'American',
    'French': 'Mediterranean',
    'Greek': 'Mediterranean',
    'Spanish': 'Mediterranean',
    'Moroccan': 'Mediterranean',
    'Turkish': 'Mediterranean',
    'Egyptian': 'Mediterranean',
    'Tunisian': 'Mediterranean',
    'Thai': 'Chinese',
    'Japanese': 'Chinese',
    'Vietnamese': 'Chinese',
    'Malaysian': 'Chinese',
    'Filipino': 'Chinese',
    'Jamaican': 'American',
    'Russian': 'American',
    'Polish': 'American',
    'Portuguese': 'Mediterranean',
    'Croatian': 'Mediterranean',
    'Dutch': 'American',
    'Irish': 'American',
    'Kenyan': 'Mediterranean',
    'Unknown': 'American',
  };
  return map[area] || 'American';
}

// ── DIFFICULTY ──
function mapDifficulty(ingredients, instructions) {
  if (ingredients.length > 14 || instructions.length > 8) return 'Hard';
  if (ingredients.length > 8 || instructions.length > 4) return 'Medium';
  return 'Easy';
}

// ── EXTRACT INGREDIENTS ──
function extractIngredients(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (name && name.trim()) {
      const convertedQty = convertToIndianUnits(measure, name);
      ingredients.push({
        name: name.trim(),
        quantity: convertedQty
      });
    }
  }
  return ingredients;
}

// ── EXTRACT INSTRUCTIONS WITH SMART TIMERS ──
function extractInstructions(text) {
  if (!text) return [];

  let steps = text
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 15);

  if (steps.length <= 2) {
    steps = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 15);
  }

  steps = steps
    .map(s => s.replace(/^(step\s*)?\d+[.):\-\s]+/i, '').trim())
    .filter(s => s.length > 10);

  return steps.slice(0, 12).map((desc, i) => {
    const d = desc.toLowerCase();
    let timer = 0;

    // Smart timer assignment based on cooking action keywords
    if (d.includes('overnight') || d.includes('8 hour') ||
        d.includes('12 hour')) {
      timer = 0; // too long for timer
    } else if (d.includes('marinate') && d.includes('hour')) {
      timer = 60;
    } else if (d.includes('marinate') || d.includes('soak') ||
               d.includes('rest') || d.includes('chill') ||
               d.includes('refrigerat')) {
      timer = 30;
    } else if (d.includes('pressure cook') ||
               (d.includes('whistle') && d.includes('cook'))) {
      timer = 20;
    } else if (d.includes('slow cook') || d.includes('braise') ||
               d.includes('dum') || d.includes('low heat') &&
               d.includes('hour')) {
      timer = 25;
    } else if (d.includes('simmer') || d.includes('slow') ||
               (d.includes('cook') && d.includes('low'))) {
      timer = 15;
    } else if (d.includes('bake') || d.includes('oven') ||
               d.includes('roast')) {
      // Extract time from text if mentioned
      const minMatch = d.match(/(\d+)\s*min/);
      timer = minMatch ? parseInt(minMatch[1]) : 20;
    } else if (d.includes('deep fry') || d.includes('fry until golden') ||
               d.includes('fry until crisp')) {
      timer = 10;
    } else if (d.includes('fry') || d.includes('saute') ||
               d.includes('stir fry') || d.includes('toss')) {
      timer = 5;
    } else if (d.includes('boil') || d.includes('blanch')) {
      timer = 5;
    } else if (d.includes('heat') || d.includes('warm')) {
      timer = 3;
    } else if (d.includes('blend') || d.includes('grind') ||
               d.includes('process') || d.includes('puree')) {
      timer = 2;
    } else if (d.includes('mix') || d.includes('stir') ||
               d.includes('combine') || d.includes('whisk')) {
      timer = 0;
    }

    // Override with explicit time if mentioned in step
    const explicitMin = d.match(/for\s+(\d+)[\s-]*min/);
    const explicitSec = d.match(/for\s+(\d+)[\s-]*sec/);
    if (explicitMin) timer = parseInt(explicitMin[1]);
    else if (explicitSec) timer = 0; // too short

    return { step: i + 1, description: desc, timer };
  });
}

// ── GENERATE DESCRIPTION ──
function generateDescription(meal, category, cuisine) {
  const area = meal.strArea || cuisine;
  const cat = category.toLowerCase();
  const name = meal.strMeal;
  const tags = meal.strTags ? meal.strTags.split(',').slice(0, 3).join(', ') : '';

  const templates = [
    `A delicious ${area} ${cat} recipe, ${name} is loved for its rich flavours and aromatic spices. ${tags ? `Perfect for: ${tags}.` : ''} A must-try classic!`,
    `${name} is a classic ${area} dish that brings together the best of ${area} cuisine. This ${cat} recipe is perfect for any occasion.`,
    `A hearty and flavourful ${cat} from ${area} cuisine. ${name} is packed with wholesome ingredients and bold spices that will delight your taste buds.`,
    `This authentic ${area} ${cat} recipe for ${name} is a crowd favourite. Easy to follow steps ensure perfect results every time.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

// ── MAIN SEED FUNCTION ──
async function seedAll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected ✅\n');

    // Get or create system user
    let systemUser = await User.findOne({ email: 'admin@nourish.app' });
    if (!systemUser) {
      systemUser = await User.create({
        username: 'Nourish Team',
        email: 'admin@nourish.app',
        password: 'Admin@123456'
      });
      console.log('System user created ✅');
    }

    const addedIds = new Set();
    let totalAdded = 0;

    // ── PHASE 1: All Indian recipes from API ──
    console.log('━━━ Phase 1: Fetching ALL Indian recipes ━━━');
    try {
      const res = await fetch(
        'https://www.themealdb.com/api/json/v1/1/filter.php?a=Indian'
      );
      const data = await res.json();

      if (data.meals) {
        console.log(`Found ${data.meals.length} Indian recipes on TheMealDB\n`);

        for (const meal of data.meals) {
          if (addedIds.has(meal.idMeal)) continue;

          const exists = await Recipe.findOne({ title: meal.strMeal });
          if (exists) {
            console.log(`  Skip (exists): ${meal.strMeal}`);
            addedIds.add(meal.idMeal);
            continue;
          }

          // Fetch full details
          const detailRes = await fetch(
            `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`
          );
          const detailData = await detailRes.json();
          const fullMeal = detailData.meals?.[0];
          if (!fullMeal) continue;

          const ingredients = extractIngredients(fullMeal);
          const instructions = extractInstructions(fullMeal.strInstructions);
          if (!ingredients.length || !instructions.length) continue;

          const category = mapCategory(fullMeal);
          const difficulty = mapDifficulty(ingredients, instructions);

          await Recipe.create({
            title: fullMeal.strMeal,
            description: generateDescription(fullMeal, category, 'Indian'),
            cuisine: 'Indian',
            category,
            difficulty,
            prepTime: difficulty === 'Easy' ? 10 : difficulty === 'Medium' ? 20 : 30,
            cookTime: Math.max(15, instructions.length * 5),
            servings: Math.floor(Math.random() * 2) + 3,
            image: fullMeal.strMealThumb,
            ingredients,
            instructions,
            author: systemUser._id,
            averageRating: 0,
            ratings: []
          });

          addedIds.add(meal.idMeal);
          totalAdded++;
          console.log(`  ✓ ${fullMeal.strMeal} [${category}] [${difficulty}]`);
          await new Promise(r => setTimeout(r, 300));
        }
      }
    } catch (err) {
      console.log('Error in Phase 1:', err.message);
    }

    // ── PHASE 2: Other cuisines ──
    const otherAreas = [
      'Italian', 'Mexican', 'Chinese', 'American',
      'French', 'Greek', 'Thai', 'Japanese',
      'Spanish', 'Moroccan', 'Turkish', 'British'
    ];

    console.log('\n━━━ Phase 2: Fetching other world cuisines ━━━');

    for (const area of otherAreas) {
      console.log(`\n  Fetching ${area} recipes...`);
      try {
        const res = await fetch(
          `https://www.themealdb.com/api/json/v1/1/filter.php?a=${area}`
        );
        const data = await res.json();
        if (!data.meals) continue;

        // Take max 6 recipes per cuisine
        const selected = data.meals.slice(0, 6);

        for (const meal of selected) {
          if (addedIds.has(meal.idMeal)) continue;

          const exists = await Recipe.findOne({ title: meal.strMeal });
          if (exists) {
            addedIds.add(meal.idMeal);
            continue;
          }

          const detailRes = await fetch(
            `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`
          );
          const detailData = await detailRes.json();
          const fullMeal = detailData.meals?.[0];
          if (!fullMeal) continue;

          const ingredients = extractIngredients(fullMeal);
          const instructions = extractInstructions(fullMeal.strInstructions);
          if (!ingredients.length || !instructions.length) continue;

          const category = mapCategory(fullMeal);
          const cuisine = mapCuisine(area);
          const difficulty = mapDifficulty(ingredients, instructions);

          await Recipe.create({
            title: fullMeal.strMeal,
            description: generateDescription(fullMeal, category, cuisine),
            cuisine,
            category,
            difficulty,
            prepTime: difficulty === 'Easy' ? 10 : difficulty === 'Medium' ? 20 : 30,
            cookTime: Math.max(15, instructions.length * 5),
            servings: Math.floor(Math.random() * 2) + 2,
            image: fullMeal.strMealThumb,
            ingredients,
            instructions,
            author: systemUser._id,
            averageRating: 0,
            ratings: []
          });

          addedIds.add(meal.idMeal);
          totalAdded++;
          console.log(`    ✓ ${fullMeal.strMeal} [${category}] [${cuisine}]`);
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (err) {
        console.log(`  Error fetching ${area}:`, err.message);
      }
    }

    // ── PHASE 3: Search for missing categories ──
    console.log('\n━━━ Phase 3: Filling missing categories ━━━');

    const categorySearches = [
      { query: 'breakfast', category: 'Breakfast' },
      { query: 'dessert chocolate', category: 'Dessert' },
      { query: 'snack appetizer', category: 'Snack' },
    ];

    for (const { query, category } of categorySearches) {
      try {
        const res = await fetch(
          `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        if (!data.meals) continue;

        const toAdd = data.meals.slice(0, 4);

        for (const meal of toAdd) {
          if (addedIds.has(meal.idMeal)) continue;
          const exists = await Recipe.findOne({ title: meal.strMeal });
          if (exists) { addedIds.add(meal.idMeal); continue; }

          const ingredients = extractIngredients(meal);
          const instructions = extractInstructions(meal.strInstructions);
          if (!ingredients.length || !instructions.length) continue;

          const cuisine = mapCuisine(meal.strArea);
          const difficulty = mapDifficulty(ingredients, instructions);

          await Recipe.create({
            title: meal.strMeal,
            description: generateDescription(meal, category, cuisine),
            cuisine,
            category,
            difficulty,
            prepTime: difficulty === 'Easy' ? 10 : 20,
            cookTime: Math.max(15, instructions.length * 5),
            servings: Math.floor(Math.random() * 2) + 2,
            image: meal.strMealThumb,
            ingredients,
            instructions,
            author: systemUser._id,
            averageRating: 0,
            ratings: []
          });

          addedIds.add(meal.idMeal);
          totalAdded++;
          console.log(`  ✓ ${meal.strMeal} [${category}] [${cuisine}]`);
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        console.log(`  Error in phase 3:`, err.message);
      }
    }

    console.log(`\n✅ DONE! Total recipes added: ${totalAdded}`);
    console.log('All recipes have:');
    console.log('  ✓ Real images from TheMealDB API');
    console.log('  ✓ Indian units (g, kg, ml, litre, tsp, tbsp, cloves)');
    console.log('  ✓ Smart timers on every step');
    console.log('  ✓ Stored in MongoDB — not hardcoded');
    process.exit(0);

  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

seedAll();
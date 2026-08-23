// A curated "what don't you like" checklist for the profile wizard's Dislikes
// step. This is NOT a reproduction of a clinical picky-eating instrument --
// research turned up none that use a named-food checklist (they're all
// Likert-style behavior questions, e.g. "refuses new foods"). This is a
// consumer-UX pattern instead (closest real analogs: PlateJoy's
// disliked-ingredients step, PickyPal's tile-tapping).
//
// Deliberately broad rather than minimal -- a family's profile is reused for
// every meal suggestion going forward, so completeness matters more here than
// it would for a one-off form. The tap-only interaction (no typing, no
// reading required beyond scanning for a familiar word) is what keeps a ~100
// item list fast to get through despite the size, unlike a form you have to
// read line by line.
export const COMMON_FOOD_CHECKLIST = [
  {
    category: 'Meat & poultry',
    items: ['chicken', 'beef', 'ground beef', 'steak', 'turkey', 'pork', 'bacon', 'sausage', 'ham', 'lamb'],
  },
  {
    category: 'Fish & seafood',
    items: [
      'salmon',
      'tuna',
      'tilapia',
      'cod',
      'trout',
      'catfish',
      'shrimp',
      'crab',
      'lobster',
      'scallops',
      'mussels',
      'clams',
      'sardines',
      'anchovies',
    ],
  },
  {
    category: 'Vegetables',
    items: [
      'broccoli',
      'cauliflower',
      'brussels sprouts',
      'carrots',
      'cabbage',
      'kale',
      'asparagus',
      'green beans',
      'corn',
      'mushrooms',
      'onions',
      'garlic',
      'bell peppers',
      'zucchini',
      'eggplant',
      'spinach',
      'celery',
      'cucumber',
      'tomatoes',
      'sweet potatoes',
      'potatoes',
      'beets',
      'radishes',
      'peas',
    ],
  },
  {
    category: 'Fruits',
    items: [
      'banana',
      'apple',
      'orange',
      'grapes',
      'strawberries',
      'blueberries',
      'pineapple',
      'mango',
      'avocado',
      'lemon',
      'lime',
      'coconut',
      'watermelon',
      'peaches',
      'pears',
      'cherries',
      'kiwi',
      'plums',
    ],
  },
  {
    category: 'Dairy & eggs',
    items: ['milk', 'cheese', 'yogurt', 'butter', 'sour cream', 'cottage cheese', 'cream cheese', 'eggs'],
  },
  {
    category: 'Grains & starches',
    items: ['rice', 'pasta', 'bread', 'quinoa', 'oats', 'couscous', 'tortillas', 'barley'],
  },
  {
    category: 'Legumes & beans',
    items: ['black beans', 'kidney beans', 'pinto beans', 'chickpeas', 'lentils', 'edamame', 'tofu'],
  },
  {
    category: 'Nuts & seeds',
    items: ['peanuts', 'almonds', 'walnuts', 'cashews', 'sesame seeds', 'sunflower seeds'],
  },
  {
    category: 'Bold flavors & condiments',
    items: ['cilantro', 'olives', 'spicy food', 'blue cheese', 'mustard', 'mayonnaise', 'pickles', 'vinegar', 'horseradish'],
  },
];

export const COMMON_FOOD_SET = new Set(COMMON_FOOD_CHECKLIST.flatMap((c) => c.items));

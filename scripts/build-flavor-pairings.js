#!/usr/bin/env node
// Phase 1 of the "Flavors" tab (see the plan reviewed with the Web App Engineer, Gamification
// Designer, and Theo Blue Apron Adventurer): derives seasoning pairings entirely from FoodEnvy's
// own 634-recipe corpus, never from general culinary knowledge. Ingredient-name classification
// (CORE_INGREDIENTS/SEASONING_VOCABULARY below) was built by pulling the real ingredient-name
// frequency table from public/foodenvy-complete-recipes.json (1,460 unique names) and grounding
// every pattern in what actually appears, not guessed -- the same methodology the Web App
// Engineer used to find that raw co-occurrence is dominated by olive oil/garlic/salt/pepper for
// every protein.
//
// Key design decisions, each tied to a specific review finding:
//  - Distinctiveness scoring (lift), not raw frequency: score = (co-occurrence rate with this
//    core ingredient) / (baseline rate across the whole corpus). This is what discounts
//    olive-oil/garlic/salt/pepper-type universals and surfaces what's actually distinctive.
//  - A materially higher confidence bar than a flat "3-4 recipes" floor (Theo Blue Apron
//    Adventurer's correction): a category needs CONFIDENT_CATEGORY_MIN recipes for "normal"
//    confidence, or it's marked 'low' -- a thin category's top pairing can just be one persona's
//    authoring-session habits dressed as a statistic.
//  - Vegetables are scoped to headline ingredients only (broccoli, mushroom, cauliflower,
//    eggplant, zucchini, spinach) -- NOT onion/garlic/celery, which are background aromatics in
//    nearly every dish and would just re-surface the "everything pairs with garlic" problem one
//    level down (Theo's asymmetry finding).
//  - Every pairing carries example recipe names, never a bare count (Theo's "receipt" finding).
//
// Usage: node scripts/build-flavor-pairings.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_PATH = path.join(__dirname, '../public/foodenvy-complete-recipes.json');
const OUTPUT_PATH = path.join(__dirname, '../public/flavor-pairings.json');

// ---- CORE_INGREDIENTS: proteins + headline-only vegetables ----
// Each category: a match regex (tested against the lowercased ingredient name) and an optional
// exclude regex for real false-positive patterns found in the actual name list (e.g. "chicken
// broth" isn't chicken-as-headline-protein; "eggplant"/"egg noodles" aren't egg-as-protein).
const CORE_INGREDIENTS = {
  chicken: { label: 'Chicken', kind: 'protein', match: /\bchicken\b/, exclude: /\b(broth|stock)\b/ },
  beef: { label: 'Beef', kind: 'protein', match: /\bbeef\b|\bsteak\b|\bsirloin\b|\bribeye\b/, exclude: /\b(broth|stock)\b/ },
  pork: { label: 'Pork', kind: 'protein', match: /\bpork\b|\bbacon\b|\bham\b/, exclude: /\b(broth|stock)\b/ },
  fish: { label: 'Fish', kind: 'protein', match: /\bsalmon\b|\bcod\b|\btilapia\b|\btuna\b|white fish/, exclude: null },
  shellfish: { label: 'Shellfish', kind: 'protein', match: /\bshrimp\b/, exclude: null },
  tofu: { label: 'Tofu', kind: 'protein', match: /\btofu\b/, exclude: null },
  // Egg was tried and dropped: unlike chicken/beef/pork/fish/shellfish/tofu, "egg" in an
  // ingredient list doesn't reliably mean egg-as-headline-dish -- it's equally a baking binder
  // (cookies, pavlova, tiramisu, souffle) or an incidental component of an unrelated dish. Naive
  // matching pulled in 233/634 recipes and even filtering out flour+sugar co-occurrence (a crude
  // "this is baking" signal) still left desserts like Creme Brulee at the top, with a nonsense
  // top pairing of "brown sugar." Same headline-vs-background asymmetry Theo flagged for
  // vegetables (see vegetable list below), just for a protein -- honest to exclude, not guess.
  broccoli: { label: 'Broccoli', kind: 'vegetable', match: /\bbroccoli\b|broccolini/, exclude: null },
  mushroom: { label: 'Mushroom', kind: 'vegetable', match: /mushroom/, exclude: null },
  cauliflower: { label: 'Cauliflower', kind: 'vegetable', match: /cauliflower/, exclude: null },
  eggplant: { label: 'Eggplant', kind: 'vegetable', match: /eggplant/, exclude: null },
  zucchini: { label: 'Zucchini', kind: 'vegetable', match: /zucchini/, exclude: null },
  spinach: { label: 'Spinach', kind: 'vegetable', match: /spinach/, exclude: null },
};

// ---- SEASONING_VOCABULARY ----
// Grounded in the real ingredient-frequency table (every entry below actually appears at
// meaningful frequency in the corpus). Deliberately does NOT hand-exclude "generic" items like
// olive oil or salt -- the distinctiveness score is what's supposed to discount those, not a
// pre-filter; excluding them by hand would hide exactly the signal (or lack of it) this feature
// is supposed to surface honestly. A v1 vocabulary (~90 entries): real coverage of the corpus's
// actual seasoning language, not a padded/invented "150-300 entries" list -- expandable later,
// not gold-plated now.
const SEASONING_VOCABULARY = [
  // aromatics
  'garlic', 'ginger', 'onion', 'scallion', 'green onion', 'shallot', 'celery',
  // herbs
  'thyme', 'parsley', 'cilantro', 'basil', 'dill', 'oregano', 'bay leaf', 'bay leaves', 'mint', 'rosemary', 'sage',
  // spices
  'black pepper', 'white pepper', 'smoked paprika', 'paprika', 'cumin', 'chili powder', 'cinnamon',
  'turmeric', 'garam masala', 'cayenne pepper', 'red pepper flakes', 'onion powder', 'garlic powder',
  'coriander', 'cardamom', 'nutmeg', 'clove', 'chili flakes', 'five-spice', 'curry powder', 'za\'atar',
  // sauces / condiments
  'soy sauce', 'fish sauce', 'hot sauce', 'sriracha', 'salsa', 'marinara', 'mirin', 'tahini',
  'dijon mustard', 'mustard', 'mayonnaise', 'miso', 'hoisin', 'worcestershire', 'oyster sauce',
  'gochujang', 'harissa', 'pesto', 'chimichurri', 'aioli', 'bbq sauce', 'barbecue sauce',
  // acids
  'lemon juice', 'lemon zest', 'lemon', 'lime juice', 'lime zest', 'lime', 'apple cider vinegar',
  'red wine vinegar', 'rice vinegar', 'white wine vinegar', 'balsamic vinegar', 'tamarind',
  // oils (flavor-relevant; scoring -- not a hand-filter -- decides if they're distinctive)
  'sesame oil', 'olive oil', 'coconut oil', 'chili oil',
  // sweetener-as-flavor-accent
  'honey', 'maple syrup', 'brown sugar',
  // sesame/finishing
  'sesame seeds', 'toasted sesame seeds', 'everything bagel seasoning',
  // wine/alcohol as flavor
  'white wine', 'red wine', 'sake', 'sherry',
  // dairy-as-flavor (not staple dairy -- these read as flavor accents, not bulk dairy)
  'parmesan', 'feta', 'blue cheese',
];

function normalizeName(rawName) {
  return (rawName || '').toLowerCase().split(',')[0].replace(/\([^)]*\)/g, '').trim();
}

function matchesSeasoning(name) {
  return SEASONING_VOCABULARY.find(s => name.includes(s)) || null;
}

const CONFIDENT_CATEGORY_MIN = 25; // recipes in category for "normal" confidence (Theo's correction)
const MIN_SEASONING_SUPPORT = 3;   // a seasoning must co-occur at least this many times to show at all
const TOP_N = 10;

function main() {
  const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8'));

  // Corpus-wide baseline frequency per seasoning (denominator for the distinctiveness score).
  const baselineCounts = {};
  recipes.forEach(r => {
    const seasoningsInRecipe = new Set();
    (r.ingredients || []).forEach(ing => {
      const name = normalizeName(ing.name);
      const s = matchesSeasoning(name);
      if (s) seasoningsInRecipe.add(s);
    });
    seasoningsInRecipe.forEach(s => { baselineCounts[s] = (baselineCounts[s] || 0) + 1; });
  });
  const totalRecipes = recipes.length;

  const output = { generatedAt: new Date().toISOString(), corpusSize: totalRecipes, categories: {} };

  Object.entries(CORE_INGREDIENTS).forEach(([key, cfg]) => {
    const matched = recipes.filter(r =>
      (r.ingredients || []).some(ing => {
        const name = normalizeName(ing.name);
        return cfg.match.test(name) && !(cfg.exclude && cfg.exclude.test(name));
      })
    );
    const categoryCount = matched.length;

    const seasoningStats = {}; // seasoning -> { count, recipeNames: [], recipeIds: [], tags: Set }
    matched.forEach(r => {
      const seasoningsInRecipe = new Map(); // seasoning -> tags seen on its matching ingredient(s) in this recipe
      (r.ingredients || []).forEach(ing => {
        const name = normalizeName(ing.name);
        const s = matchesSeasoning(name);
        if (!s) return;
        if (!seasoningsInRecipe.has(s)) seasoningsInRecipe.set(s, new Set());
        (ing.tags || []).forEach(t => seasoningsInRecipe.get(s).add(t));
      });
      seasoningsInRecipe.forEach((tags, s) => {
        if (!seasoningStats[s]) seasoningStats[s] = { count: 0, recipeNames: [], recipeIds: [], tags: new Set() };
        seasoningStats[s].count++;
        if (seasoningStats[s].recipeNames.length < 2) seasoningStats[s].recipeNames.push(r.name);
        seasoningStats[s].recipeIds.push(r.id);
        tags.forEach(t => seasoningStats[s].tags.add(t));
      });
    });

    const scored = Object.entries(seasoningStats)
      .filter(([, v]) => v.count >= MIN_SEASONING_SUPPORT)
      .map(([seasoning, v]) => {
        const rateInCategory = v.count / categoryCount;
        const rateBaseline = (baselineCounts[seasoning] || 0) / totalRecipes;
        const distinctiveness = rateBaseline > 0 ? rateInCategory / rateBaseline : rateInCategory * totalRecipes;
        return {
          seasoning, count: v.count, exampleRecipes: v.recipeNames, recipeIds: v.recipeIds,
          allergenTags: Array.from(v.tags), distinctiveness,
        };
      })
      .sort((a, b) => b.distinctiveness - a.distinctiveness)
      .slice(0, TOP_N);

    output.categories[key] = {
      label: cfg.label,
      kind: cfg.kind,
      recipeCount: categoryCount,
      confidence: categoryCount >= CONFIDENT_CATEGORY_MIN ? 'normal' : (categoryCount > 0 ? 'low' : 'none'),
      // recipeIds lets the app render "N recipes using X + Y" by direct ID lookup against the
      // already-loaded recipe data, instead of porting CORE_INGREDIENTS/SEASONING_VOCABULARY's
      // regex classification into the browser as a second, easy-to-drift copy of the same logic.
      pairings: scored.map(s => ({
        seasoning: s.seasoning,
        count: s.count,
        exampleRecipes: s.exampleRecipes,
        recipeIds: s.recipeIds,
        allergenTags: s.allergenTags,
      })),
    };
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');

  console.log('Corpus size:', totalRecipes);
  Object.entries(output.categories).forEach(([key, cat]) => {
    console.log('\n' + cat.label + ' (' + cat.kind + ', ' + cat.recipeCount + ' recipes, confidence=' + cat.confidence + '):');
    if (cat.pairings.length === 0) console.log('  (no pairings clear the support floor)');
    cat.pairings.forEach(p => console.log('  ' + p.seasoning + ' -- ' + p.count + ' recipes, e.g. "' + p.exampleRecipes[0] + '"'));
  });
}

main();

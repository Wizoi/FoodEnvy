#!/usr/bin/env node
// Sources real, openly-licensed photos for recipes missing `imageUrl`, via Openverse's public
// API (structured license metadata, no API key required) -- see the update-app plan for why this
// replaces the old per-recipe WebSearch instruction in find-recipe (0% success rate at scale).
//
// Deliberately does NOT write into public/foodenvy-complete-recipes.json directly. Per the
// allergy-safety/gluten-free/weekend-hobbyist personas' review of this exact plan: a license
// check and a "does this photo actually depict this dish" check are orthogonal. A name-only
// text query can return a photo that's completely unrelated to the dish (confirmed directly:
// querying "spiced candied pecans" returns a "Pumpkin Pie Waffle" photo as the first
// license-clear result). For a technique-driven recipe, a wrong-but-legal photo actively
// misteaches the result -- worse than the honest fallback gradient. So this script only
// produces a reviewable log; merging into the live recipe data is a separate, explicit step
// (scripts/merge-image-backfill.js), which applies its own independent sanity filter.
//
// v2 findings from the first production run (153/634 found, most misses were self-inflicted):
//   - Appending mealType to the query (e.g. "Cheese Quesadilla snack") silently zeroed out
//     results for recipes that have plenty of open-licensed photos under their bare name --
//     confirmed directly ("Cheese Quesadilla snack" -> 0 results, "Cheese Quesadilla" -> 229).
//     mealType is dropped from the query entirely now.
//   - Many recipe names carry meal-kit/technique framing a real photo would never be titled
//     with ("One-Pot ...", "Loaded ...", "... with Herb Butter"). A second, trimmed query
//     variant is tried when the full name comes up empty.
//   - page_size=5 with the license filter applied server-side means a recipe with real
//     open-licensed photos further down the list still read as "no license-clear result".
//     Raised to 15, and results are now scored by title-word overlap rather than taking
//     whichever license-clear photo happened to come first.
//
// v3: two more fallback tiers for recipes where even the trimmed dish name comes up empty
//   (compound meal-kit names, uncommon fusion dishes):
//   - ingredient tier: search the recipe's own headline ingredient (e.g. "salmon", "dark
//     chocolate"), ranked by bulk/importance (see ingredientImportance) rather than just
//     whichever ingredient happens to be listed first -- a minor spice or a single garnish
//     clove shouldn't win over the actual protein or produce the dish is built from.
//   - equipment tier: for a recipe that clearly names a distinctive cooking vessel/method
//     (slow cooker, cast iron, wok, grill...), search the vessel/appliance itself. Deliberately
//     narrow and literal (never "slow cooker meal" or similar) -- a photo of some OTHER dish
//     sitting in the vessel would read as "here's tonight's dinner" and risks being mistaken
//     for a real (wrong) match, which is exactly the confusion this whole approach is trying
//     to avoid.
//   Neither tier is a photo of the finished dish -- both are logged with a `matchType` so they
//   stay distinguishable from a real dish-name match rather than silently blending in.
//
// Usage: node scripts/backfill-recipe-images.js [--limit N]
//   --limit N   only process the first N recipes missing an image (for a quick test run)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_PATH = path.join(__dirname, '../public/foodenvy-complete-recipes.json');
const LOG_PATH = path.join(__dirname, 'image-backfill-log.json');

const ALLOWED_LICENSES = ['cc0', 'pdm', 'by', 'by-sa'];
const OPENVERSE_URL = 'https://api.openverse.org/v1/images/';

// Meal-kit/technique framing that shows up constantly in this library's recipe names but never
// in how a real photo gets titled -- stripping these as a leading run of words turns a
// zero-result search into a real one far more often than searching the full name.
const FILLER_PREFIXES = new Set([
  'one-pot', 'one-pan', 'one-tray', 'one-bowl', 'one-skillet', 'one-jar', 'sheet-pan',
  'no-bake', 'no-cook', 'loaded', 'classic', 'homemade', 'easy', 'quick', 'simple',
  'instant-pot', 'slow-cooker', 'air-fryer', 'the-best', 'ultimate', 'perfect',
  'better-than-takeout', '5-ingredient', 'make-ahead', 'weeknight',
]);

const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

// A recipe name's meal-kit staging clause (", Split at the Starch") or subtitle (": a family
// favorite") never describes the dish itself -- only the part before it is worth searching on.
function coreName(name) {
  return name.split(/[,:]/)[0].trim();
}

function stripFillerPrefixes(name) {
  let words = name.split(/\s+/);
  while (words.length > 1 && FILLER_PREFIXES.has(words[0].toLowerCase().replace(/[^a-z0-9-]/g, ''))) {
    words = words.slice(1);
  }
  return words.join(' ');
}

// "with X" almost always introduces a garnish/sauce/side a real photo's title would never
// mention ("... with Herb Butter", "... with Quick-Pickled Red Onion") -- cutting it off turns
// a specific-but-unsearched phrase into the actual dish name. Deliberately NOT splitting on
// "and"/"&": those routinely ARE the dish name ("Beef and Broccoli", "Mac and Cheese").
function dropWithClause(name) {
  return name.split(/\bwith\b/i)[0].trim();
}

// Presentation-format words that describe how the dish is SERVED, not what it IS -- a photo
// would never be titled "... Bar" or "... Platter" even for a dish that really is served that
// way. Deliberately narrow (unlike "bites"/"skewers"/"wedges", which are often the recognizable
// dish name itself, e.g. "Chicken Skewers" is a perfectly real, searchable dish).
const GENERIC_SUFFIXES = new Set(['bar', 'platter', 'board', 'spread', 'buffet']);

function stripGenericSuffixes(name) {
  let words = name.split(/\s+/);
  while (words.length > 1 && GENERIC_SUFFIXES.has(words[words.length - 1].toLowerCase().replace(/[^a-z0-9-]/g, ''))) {
    words = words.slice(0, -1);
  }
  return words.join(' ');
}

// Confirmed directly: "Backyard Sundae Bar" (the full name) returns 0 Openverse results, but
// "Sundae Bar" returns 61 and bare "Sundae" returns 240 -- an unanticipated leading modifier
// ("Backyard") can kill a search just as badly as the known filler-prefix list, and there's no
// way to enumerate every such modifier in advance. So once the known strips are applied, keep
// dropping the leftmost word and trying again. Floor of 1 word, but only when that last word is
// long enough (>=5 chars) to still be a distinctive-enough search term on its own -- correctness
// is still gated by the independent title-sanity check in merge-image-backfill.js, so a broader
// net here is safe: worst case it finds nothing better than the tiers already tried.
function progressiveLeadingDrops(name) {
  const variants = [];
  let words = name.split(/\s+/);
  while (words.length > 1) {
    words = words.slice(1);
    if (words.length === 1 && words[0].length < 5) break;
    variants.push(stripGenericSuffixes(words.join(' ')));
  }
  return variants;
}

function queryVariants(recipeName) {
  const core = coreName(recipeName);
  const trimmed = stripGenericSuffixes(dropWithClause(stripFillerPrefixes(core)));
  const progressive = progressiveLeadingDrops(trimmed);
  return [...new Set([core, trimmed, ...progressive])].filter(Boolean);
}

// Pantry staples that appear in nearly every recipe and never make a useful search term on
// their own -- searching "salt" or "olive oil" just returns generic stock-photography, not
// anything that reads as belonging to this dish.
const PANTRY_STAPLES = new Set([
  'salt', 'kosher salt', 'sea salt', 'pepper', 'black pepper', 'ground black pepper',
  'olive oil', 'extra-virgin olive oil', 'vegetable oil', 'canola oil', 'oil', 'cooking spray',
  'butter', 'unsalted butter', 'salted butter', 'sugar', 'granulated sugar', 'brown sugar',
  'flour', 'all-purpose flour', 'water', 'baking powder', 'baking soda', 'cornstarch',
  'vanilla extract', 'garlic powder', 'onion powder',
]);

// Units that mark a small accent quantity (a spice, a splash, a garnish) rather than a bulk
// component of the dish -- per direction, the ingredient photo should lean on what the dish is
// actually built from, not a minor seasoning that happens to be listed early.
const MINOR_UNITS = new Set([
  'tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons', 'pinch', 'pinches',
  'dash', 'dashes', 'drop', 'drops', 'sprig', 'sprigs', 'clove', 'cloves', 'leaf', 'leaves',
  'stick', 'sticks',
]);

// The canonical allergen/diet tag vocabulary (src/domain/tags.js) doubles as a solid proxy for
// "this is the headline ingredient" -- the protein or defining allergen, not a minor seasoning.
const HEADLINE_TAGS = new Set([
  'dairy', 'gluten', 'nuts', 'shellfish', 'egg', 'soy', 'sesame', 'meat', 'pork', 'beef', 'fish',
]);

function ingredientImportance(ing) {
  const unit = (ing.unit || '').toLowerCase().trim();
  let score = 0;
  if (unit && !MINOR_UNITS.has(unit)) score += 2; // a bulk unit (cup, lb, whole, piece, oz...)
  if ((ing.tags || []).some(t => HEADLINE_TAGS.has(t))) score += 1; // likely the protein/anchor
  return score;
}

// Ingredient names routinely carry a cooking-state clause ("Unsalted butter, melted", "Onion,
// diced") that's irrelevant to both the pantry-staple check and the search query itself --
// without stripping it, "unsalted butter, melted" doesn't match the plain "unsalted butter"
// staple entry and slips through as if it were a headline ingredient.
function ingredientSearchName(rawName) {
  return rawName.split(',')[0].replace(/\([^)]*\)/g, '').trim();
}

// Picks up to `count` ingredient names worth using as a photo search term, ranked by how much
// they read as "what this dish is actually built from" rather than a minor accent: skips
// pantry staples, favors bulk-quantity units and tagged protein/allergen ingredients over a
// pinch of spice or a clove of garlic, and falls back to listed order as a tiebreaker (ingredient
// lists tend to name the headline component first anyway).
function headlineIngredients(recipe, count) {
  const candidates = (recipe.ingredients || [])
    .map((ing, index) => ({ name: ingredientSearchName(ing.name || ''), index, importance: ingredientImportance(ing) }))
    .filter(c => c.name && !PANTRY_STAPLES.has(c.name.toLowerCase()));
  candidates.sort((a, b) => b.importance - a.importance || a.index - b.index);
  return candidates.slice(0, count).map(c => c.name);
}

// Equipment/technique fallback: only reached when neither the dish name nor its headline
// ingredients turn up a match. Deliberately narrow and literal (the vessel/appliance itself,
// e.g. "cast iron skillet"), never a phrase implying a finished dish in it -- a photo of some
// OTHER dish sitting in a slow cooker would read as "here's tonight's dinner" and could be
// mistaken for a real (wrong) match, which is exactly the confusion to avoid here.
const EQUIPMENT_PATTERNS = [
  { re: /\bslow[- ]cooker\b|\bcrock[- ]?pot\b/i, query: 'slow cooker' },
  { re: /\binstant pot\b|\bpressure cooker\b/i, query: 'pressure cooker' },
  { re: /\bdutch oven\b/i, query: 'dutch oven' },
  { re: /\bcast[- ]iron\b/i, query: 'cast iron skillet' },
  { re: /\bwok\b/i, query: 'wok' },
  { re: /\bair[- ]fryer\b/i, query: 'air fryer' },
  { re: /\bsous vide\b/i, query: 'sous vide' },
  { re: /\bgriddle\b/i, query: 'griddle' },
  { re: /\bsmoker\b/i, query: 'meat smoker' },
  { re: /\bgrill(ed|ing)?\b/i, query: 'grill grates' },
];

function equipmentQuery(recipe) {
  const haystack = [recipe.name, ...(recipe.tags || []), ...(recipe.steps || [])].join(' ');
  for (const { re, query } of EQUIPMENT_PATTERNS) {
    if (re.test(haystack)) return query;
  }
  return null;
}

const STOPWORDS = new Set([
  'and', 'the', 'with', 'for', 'from', 'a', 'an', 'of', 'in', 'on', 'at', 'to',
]);

function significantWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

// Score a candidate by how many of the query's significant words show up in its title -- used
// to pick the best of up to 15 license-clear results instead of whichever came first.
function scoreCandidate(queryWords, title) {
  if (!title) return 0;
  const t = title.toLowerCase();
  return queryWords.filter(w => t.includes(w)).length;
}

// Quote marks (straight or curly) inside a query -- e.g. an air-quote recipe name like
// 'Instant Mac and "Cheese" Bowl' -- appear to make Openverse's search parser treat them as
// phrase-search syntax, silently zeroing results even for an otherwise-common dish: confirmed
// directly, 'Instant Mac and "Cheese" Bowl' returns 0 results, 'Instant Mac and Cheese Bowl'
// returns 240 with several open-licensed. Quotes never help a search here, so strip them
// wherever a query is actually sent, regardless of which tier/variant produced it.
function sanitizeForSearch(query) {
  return query.replace(/["'‘’“”]/g, '').replace(/\s+/g, ' ').trim();
}

async function queryOpenverse(query) {
  const url = OPENVERSE_URL + '?q=' + encodeURIComponent(sanitizeForSearch(query)) +
    '&license=' + ALLOWED_LICENSES.join(',') +
    '&page_size=15';
  const resp = await fetch(url, { headers: { 'User-Agent': 'FoodEnvy-recipe-backfill/1.0' } });
  if (!resp.ok) {
    throw new Error('Openverse request failed: ' + resp.status + ' ' + resp.statusText);
  }
  const data = await resp.json();
  return data.results || [];
}

async function bestCandidateForQuery(query) {
  const candidates = await queryOpenverse(query);
  await new Promise(res => setTimeout(res, 200));
  const licensed = candidates.filter(c => ALLOWED_LICENSES.includes((c.license || '').toLowerCase()) && c.url);
  if (licensed.length === 0) return null;
  const queryWords = significantWords(query);
  let best = licensed[0], bestScore = scoreCandidate(queryWords, licensed[0].title);
  for (const c of licensed.slice(1)) {
    const s = scoreCandidate(queryWords, c.title);
    if (s > bestScore) { best = c; bestScore = s; }
  }
  return { match: best, query, score: bestScore };
}

async function bestMatchForRecipe(recipe) {
  for (const query of queryVariants(recipe.name)) {
    const result = await bestCandidateForQuery(query);
    if (result) return { ...result, tier: 'dish' };
  }
  // Dish-name search came up empty -- fall back to the recipe's own headline ingredient(s).
  // Not a photo of the finished dish, just something food-relevant instead of a flat gradient.
  for (const query of headlineIngredients(recipe, 2)) {
    const result = await bestCandidateForQuery(query);
    if (result) return { ...result, tier: 'ingredient' };
  }
  // Last resort: the cooking vessel/appliance itself, only for recipes that clearly name one.
  const eq = equipmentQuery(recipe);
  if (eq) {
    const result = await bestCandidateForQuery(eq);
    if (result) return { ...result, tier: 'equipment' };
  }
  return null;
}

async function main() {
  const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8'));
  const missing = recipes.filter(r => !r.imageUrl || !r.imageUrl.trim());
  const toProcess = missing.slice(0, LIMIT);

  console.log('Recipes missing an image: ' + missing.length);
  console.log('Processing this run: ' + toProcess.length + (LIMIT !== Infinity ? ' (--limit ' + LIMIT + ')' : ''));

  const results = [];
  let found = 0, notFound = 0, errored = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const recipe = toProcess[i];
    process.stdout.write('[' + (i + 1) + '/' + toProcess.length + '] ' + recipe.name + ' ... ');
    try {
      const result = await bestMatchForRecipe(recipe);
      if (result) {
        found++;
        const { match, query, score, tier } = result;
        console.log('found [' + tier + '] (' + match.license + ', ' + match.source + ', score ' + score + ', "' + query + '")');
        results.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          mealType: recipe.mealType,
          query,
          matchType: tier,
          imageUrl: match.url,
          foreignLandingUrl: match.foreign_landing_url,
          license: match.license,
          licenseVersion: match.license_version,
          source: match.source || match.provider,
          creator: match.creator || null,
          title: match.title || null,
        });
      } else {
        notFound++;
        console.log('no license-clear result');
        const eq = equipmentQuery(recipe);
        const triedQueries = [...queryVariants(recipe.name), ...headlineIngredients(recipe, 2), ...(eq ? [eq] : [])];
        results.push({ recipeId: recipe.id, recipeName: recipe.name, mealType: recipe.mealType, query: triedQueries.join(' | '), imageUrl: null, reason: 'no license-clear result' });
      }
    } catch (e) {
      errored++;
      console.log('ERROR: ' + e.message);
      results.push({ recipeId: recipe.id, recipeName: recipe.name, mealType: recipe.mealType, imageUrl: null, reason: 'error: ' + e.message });
    }
  }

  // Merge with any prior log entries for recipes not touched this run (e.g. a --limit run),
  // so re-running the script never loses earlier candidates.
  let priorLog = [];
  if (fs.existsSync(LOG_PATH)) {
    try { priorLog = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); } catch { /* ignore corrupt/empty */ }
  }
  const touchedIds = new Set(results.map(r => r.recipeId));
  const merged = [...priorLog.filter(e => !touchedIds.has(e.recipeId)), ...results];

  fs.writeFileSync(LOG_PATH, JSON.stringify(merged, null, 2) + '\n');
  console.log('');
  console.log('Found: ' + found + '  No match: ' + notFound + '  Errors: ' + errored);
  console.log('Log written to: ' + LOG_PATH + ' (' + merged.length + ' total entries)');
  console.log('');
  console.log('This is a REVIEW LOG, not applied to the live recipe data. Run');
  console.log('scripts/merge-image-backfill.js to apply its sanity-filtered subset.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

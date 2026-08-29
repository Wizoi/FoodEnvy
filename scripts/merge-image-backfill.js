#!/usr/bin/env node
// Applies scripts/image-backfill-log.json to public/foodenvy-complete-recipes.json.
//
// The log's matches are license-clear but NOT dish-verified (Openverse is a text search, not an
// image-recognition match -- see the plan notes: "spiced candied pecans" returned a pumpkin pie
// waffle photo as the top license-clear hit). Per explicit direction, this does NOT gate on a
// human reviewing all ~150 hits one by one. Instead it applies a cheap automated sanity filter:
// require the photo's title to share EITHER two significant words with the recipe name, OR one
// strongly distinctive word (length >= 7, e.g. "quesadilla", "carbonara") -- e.g. "Overnight
// Oats" / "...Bircher Muesli (Overnight Oats)" passes on both words, "Beef Stir-Fry" /
// "Kheema (spicy mince)" fails outright, and a single generic-word coincidence like "Beef" /
// "Beef Stew" (a real but wrong dish) no longer passes on its own. v2's backfill script
// sometimes searches on a trimmed/shortened dish name, which raises exactly this single-generic-
// word risk, hence the stricter two-tier bar here. This won't catch every mismatch (a
// coincidentally-titled wrong photo can still slip through) but it is a real, checkable signal.
//
// v3 entries (`matchType: 'ingredient'` or `'equipment'`) are a different kind of match on
// purpose -- not the finished dish, just the recipe's own headline ingredient or cooking vessel,
// used only when a real dish-name match couldn't be found. Their title only needs to contain
// the searched word itself (that word IS the query, so "does it show up" is close to guaranteed
// and isn't a meaningful signal on its own); the field is carried into imageAttribution so
// these tiers stay distinguishable from a genuine dish-name match rather than silently blending
// in.
//
// Usage: node scripts/merge-image-backfill.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_PATH = path.join(__dirname, '../public/foodenvy-complete-recipes.json');
const LOG_PATH = path.join(__dirname, 'image-backfill-log.json');
const REJECTED_LOG_PATH = path.join(__dirname, 'image-backfill-rejected.json');

const STOPWORDS = new Set([
  'and', 'the', 'with', 'for', 'from', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'split', 'before',
  'entirely', 'same', 'parallel', 'night', 'bar', 'off', 'first', 'over',
]);

function significantWords(name) {
  // Drop parenthetical/comma-clause descriptors like ", Split at the Starch" -- those are
  // meal-kit staging instructions, not food words, and never appear in a stock-photo title.
  const core = name.split(/[,:]/)[0];
  return core
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

function titleMatches(recipeName, title) {
  if (!title) return false;
  const words = significantWords(recipeName);
  if (words.length === 0) return false;
  const t = title.toLowerCase();
  const hits = words.filter(w => t.includes(w));
  if (hits.length >= 2) return true;
  return hits.length === 1 && hits[0].length >= 7;
}

// Ingredient/equipment tier: the query itself IS the searched word, so just confirm the photo's
// title actually contains it -- a much lower bar than dish-tier, since this was never meant to
// depict the finished dish in the first place.
function literalQueryMatches(query, title) {
  if (!title) return false;
  const words = significantWords(query);
  if (words.length === 0) return false;
  const t = title.toLowerCase();
  return words.some(w => t.includes(w));
}

function main() {
  const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8'));
  const log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  const byId = new Map(recipes.map(r => [r.id, r]));

  const accepted = [];
  const rejected = [];

  for (const entry of log) {
    if (!entry.imageUrl) continue;
    const isDishTier = !entry.matchType || entry.matchType === 'dish';
    const passes = isDishTier
      ? titleMatches(entry.recipeName, entry.title)
      : literalQueryMatches(entry.query, entry.title);
    if (passes) {
      accepted.push(entry);
    } else {
      rejected.push(entry);
    }
  }

  for (const entry of accepted) {
    const recipe = byId.get(entry.recipeId);
    if (!recipe) continue;
    recipe.imageUrl = entry.imageUrl;
    recipe.imageAttribution = {
      source: entry.source,
      url: entry.foreignLandingUrl,
      license: entry.license + (entry.licenseVersion ? ' ' + entry.licenseVersion : ''),
      creator: entry.creator || null,
      matchType: entry.matchType || 'dish',
    };
  }

  fs.writeFileSync(RECIPES_PATH, JSON.stringify(recipes, null, 2) + '\n');
  fs.writeFileSync(REJECTED_LOG_PATH, JSON.stringify(rejected, null, 2) + '\n');

  const totalMissing = recipes.filter(r => !r.imageUrl).length;
  const tierCounts = {};
  accepted.forEach(e => { const t = e.matchType || 'dish'; tierCounts[t] = (tierCounts[t] || 0) + 1; });
  const tierSummary = Object.entries(tierCounts).map(([t, c]) => c + ' ' + t).join(', ');
  console.log('Log entries with a candidate image: ' + log.filter(e => e.imageUrl).length);
  console.log('Accepted (title sanity check passed): ' + accepted.length + ' (' + tierSummary + ')');
  console.log('Rejected (likely mismatch, title check failed): ' + rejected.length + ' -- see ' + REJECTED_LOG_PATH);
  console.log('Merged into: ' + RECIPES_PATH);
  console.log('Recipes still without an image: ' + totalMissing + ' / ' + recipes.length);
}

main();

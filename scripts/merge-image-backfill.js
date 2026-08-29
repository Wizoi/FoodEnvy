#!/usr/bin/env node
// Applies scripts/image-backfill-log.json to public/foodenvy-complete-recipes.json.
//
// The log's matches are license-clear but NOT dish-verified (Openverse is a text search, not an
// image-recognition match -- see the plan notes: "spiced candied pecans" returned a pumpkin pie
// waffle photo as the top license-clear hit). Per explicit direction, this does NOT gate on a
// human reviewing all ~150 hits one by one. Instead it applies a cheap automated sanity filter:
// keep a match only if a real, non-generic word from the recipe's own name also appears in the
// matched photo's title -- e.g. "Overnight Oats" / "...Bircher Muesli (Overnight Oats)" passes,
// "Beef Stir-Fry" / "Kheema (spicy mince)" does not. This won't catch every mismatch (a
// coincidentally-titled wrong photo still slips through) but it is a real, checkable signal
// that filtered out several actually-wrong matches when spot-checked against this run's data.
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
    if (titleMatches(entry.recipeName, entry.title)) {
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
    };
  }

  fs.writeFileSync(RECIPES_PATH, JSON.stringify(recipes, null, 2) + '\n');
  fs.writeFileSync(REJECTED_LOG_PATH, JSON.stringify(rejected, null, 2) + '\n');

  const totalMissing = recipes.filter(r => !r.imageUrl).length;
  console.log('Log entries with a candidate image: ' + log.filter(e => e.imageUrl).length);
  console.log('Accepted (title sanity check passed): ' + accepted.length);
  console.log('Rejected (likely mismatch, title check failed): ' + rejected.length + ' -- see ' + REJECTED_LOG_PATH);
  console.log('Merged into: ' + RECIPES_PATH);
  console.log('Recipes still without an image: ' + totalMissing + ' / ' + recipes.length);
}

main();

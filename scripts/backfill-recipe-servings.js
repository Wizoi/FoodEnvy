#!/usr/bin/env node
// One-time backfill of servings/yield data across all 634 recipes -- see the "Backfill
// servings/yield data" plan reviewed with the Web App Engineer, Gamification Designer,
// Amara Chen, and Lucia Alvarez. No recipe previously had any servings/yield field at all,
// which blocked shopping-list scaling (shipped with an explicit "not scaled to your household
// size" disclaimer) and any future calorie/nutrition display.
//
// Adds `yield: { min, max, unit }` and `yieldSource: 'stated' | 'inferred'` per recipe.
// `min`/`max` represent a range of ADULT-EQUIVALENT portions (not literal headcount) -- an
// explicit, named assumption per Amara Chen's review, since most recipe-writing (and this
// hand-review) implicitly assumes adult portions. `yieldSource: 'stated'` means the recipe's
// own ingredients/steps explicitly state a count; `'inferred'` means the reviewer judged it
// from ingredient quantities with nothing explicit in the source text -- expect the majority
// of values to be 'inferred', that's the honest default for a hand-review pass, not a failure.
// Recipes tagged batch-cook/freezer-friendly/make-ahead were reviewed against their actual
// full stated batch size (e.g. 8 burritos to freeze), not a single-meal-sized guess.
//
// Data was produced in one review pass per persona-author batch (14 batches: the 13 cook/
// dietary-specialist personas' recipe sets plus the legacy user-submitted set), each batch's
// recipes read in full (ingredients + steps + description) rather than guessed from the name --
// mirrors the existing backfill-user-submitted-tags.js precedent. Held in a sibling JSON file
// (recipe-servings-data.json) rather than inlined here given its size (634 entries).
//
// Some recipes are intentionally absent from the data file (e.g. a spice blend/condiment with
// no defensible yield) -- those are left without a `yield` field entirely, not a guessed one.
//
// Usage: node scripts/backfill-recipe-servings.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_PATH = path.join(__dirname, '../public/foodenvy-complete-recipes.json');
const DATA_PATH = path.join(__dirname, 'recipe-servings-data.json');

function main() {
  const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8'));
  const yields = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const byId = new Map(recipes.map(r => [r.id, r]));

  let updated = 0;
  const missing = [];

  for (const [id, data] of Object.entries(yields)) {
    const r = byId.get(id);
    if (!r) { missing.push(id); continue; }
    r.yield = { min: data.min, max: data.max, unit: data.unit };
    r.yieldSource = data.yieldSource;
    updated++;
  }

  fs.writeFileSync(RECIPES_PATH, JSON.stringify(recipes, null, 2) + '\n');

  const withoutYield = recipes.filter(r => !r.yield);
  const badSource = recipes.filter(r => r.yield && r.yieldSource !== 'stated' && r.yieldSource !== 'inferred');

  console.log('Total recipes: ' + recipes.length);
  console.log('Updated with yield: ' + updated + ' / ' + Object.keys(yields).length + ' data entries');
  if (missing.length) console.log('Not found (id mismatch?): ' + missing.join(', '));
  console.log('Recipes without a yield field (intentionally omitted): ' + withoutYield.length);
  if (withoutYield.length) console.log('  ' + withoutYield.map(r => r.id).join(', '));
  if (badSource.length) console.log('WARNING: bad yieldSource on: ' + badSource.map(r => r.id).join(', '));
}

main();

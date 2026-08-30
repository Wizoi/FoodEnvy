#!/usr/bin/env node
// One-time backfill for the 40 legacy 'user-submitted' recipes, which carry only a single
// mealType-duplicate tag each (avg 1.1 tags/recipe vs 3.0-4.9 for every persona-authored batch --
// confirmed directly by querying the live corpus). This is the actual root cause behind the Help
// tab's mood-tile dead-ends, not the tile selection itself -- see docs/personas/technical/
// gamification-designer.yaml and web-app-engineer.yaml notes on the tile co-occurrence check.
//
// Tags below were hand-assigned per recipe from its own ingredients/description (all 40 already
// have good persona-voice descriptions from an earlier backfill pass -- tags were simply never
// part of that pass). Reuses the existing 408-value corpus vocabulary rather than inventing new
// terms. Diet-adjacent tags (vegetarian/vegan/gluten-free) were only added where the ingredient
// list actually supports the claim -- these are descriptive/browsing tags, not the allergen-chip
// system (which reads per-ingredient tags separately), but a wrong claim here would still mislead
// browsing, so each one was checked against the real ingredient list, not assumed from the dish
// name.
//
// Usage: node scripts/backfill-user-submitted-tags.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_PATH = path.join(__dirname, '../public/foodenvy-complete-recipes.json');

const TAGS = {
  'recipe-98403f87-b24a-47c7-8ea2-ff91a85ee5ff': ['dessert', 'snack', 'candy', 'stovetop', 'technique'],
  'recipe-71dc583a-72ae-489e-b897-efdb73f64de2': ['dessert', 'snack', 'baking', 'chocolate', 'classic', 'comfort-food'],
  'recipe-7a410946-77e7-4747-8a6a-180cbea5ae87': ['snack', 'baking', 'weekend-project', 'technique', 'yeasted-dough'],
  'recipe-48325d5e-1210-4471-b417-d0b7ff6f3b90': ['dessert', 'snack', 'nuts', 'technique', 'make-ahead'],
  'recipe-e71577b5-572e-46e8-a71f-2a253569707c': ['dessert', 'snack', 'candy', 'technique', 'make-ahead'],
  'recipe-a2289f4d-4717-4ab0-8714-27de23008970': ['dessert', 'snack', 'candy', 'technique', 'make-ahead'],
  'recipe-0451e4f5-aa66-4f45-8c18-bfaabc9cf640': ['dessert', 'custard', 'make-ahead', 'technique', 'no-bake', 'gluten-free'],
  'recipe-52ccef45-6ebd-4f90-9973-ce8c49dba50d': ['dessert', 'chocolate', 'baking', 'technique', 'special-occasion'],
  'recipe-edcdc5d7-c315-43c4-931d-01e0f7d50879': ['dessert', 'baking', 'technique', 'special-occasion', 'gluten-free'],
  'recipe-29aa3213-1e33-48c1-a5f4-80ebb014bcad': ['dessert', 'baking', 'weekend-project', 'technique', 'nuts'],
  'recipe-131ee97d-795b-4f06-8c50-1c573000787a': ['dessert', 'no-bake', 'make-ahead', 'italian-inspired', 'classic'],
  'recipe-3936425a-7d14-4d6f-8b2b-6f7d0141de05': ['dessert', 'baking', 'technique', 'weekend-project'],
  'recipe-47dd089a-a575-4e71-8286-60eea27bb618': ['dessert', 'chocolate', 'technique', 'special-occasion'],
  'recipe-1cce4f6d-9d78-49c1-a116-d2c24d74f43b': ['dessert', 'custard', 'technique', 'make-ahead', 'gluten-free'],
  'recipe-de1a324e-eb49-4edb-9758-b50244575804': ['dinner', 'technique', 'weekend-project', 'make-ahead'],
  'recipe-e5c0d898-76e5-4e36-9c3a-4d5eef22bf52': ['dinner', 'seafood', 'weeknight', 'asian-inspired', 'high-protein'],
  'recipe-99ee5f44-24d3-46ec-8deb-2fc5011f3ced': ['dinner', 'seafood', 'asian-inspired', 'spice-blend', 'gluten-free'],
  'recipe-7f7631ac-b9cd-4d8a-aa39-67feeed771be': ['dinner', 'italian-inspired', 'technique', 'weekend-project', 'vegetarian'],
  'recipe-30371f7e-7555-4212-b527-d1a10830f273': ['dinner', 'comfort-food', 'braise', 'weekend-project', 'high-protein'],
  'recipe-6b7cbc3c-2b10-48de-8494-5e4b81d1f6f6': ['dinner', 'seafood', 'weekend-project', 'technique'],
  'recipe-c015f5d5-b569-44f7-a38c-b6f37f825982': ['dinner', 'weeknight', 'technique', 'classic', 'high-protein'],
  'recipe-d18fcd80-9d1e-4761-8351-681942e0a917': ['dinner', 'vegetarian', 'italian-inspired', 'technique', 'comfort-food'],
  'recipe-b343a279-65e9-4940-a0b1-c2a3dcef3da0': ['dinner', 'braise', 'weekend-project', 'classic'],
  'recipe-84bf2ec6-a1d0-4411-8dbf-9707593950de': ['dinner', 'technique', 'classic', 'high-protein'],
  'recipe-2637511b-22c4-41b1-961a-5a05eecac8aa': ['lunch', 'vegetarian', 'vegan', 'technique'],
  'recipe-9eeeb3fa-b2fd-4742-9d81-4f92fc32560f': ['lunch', 'italian-inspired', 'classic', 'quick', 'high-protein'],
  'recipe-c982b725-03e0-430d-862a-fe241421f145': ['lunch', 'asian-inspired', 'gluten-free', 'quick'],
  'recipe-9397b794-cb7a-4a5a-9a3a-f5fdea1f98c3': ['lunch', 'seafood', 'sandwich', 'comfort-food', 'fried'],
  'recipe-37ea4f63-bacf-47ce-a554-5e0039e8ff0c': ['lunch', 'asian-inspired', 'weekend-project', 'technique', 'make-ahead'],
  'recipe-27a977a3-685b-448e-9f40-5e3df17b83ab': ['lunch', 'seafood', 'salad', 'high-protein', 'gluten-free'],
  'recipe-a4a07ef9-c3ce-4853-8a2b-bac2614a942a': ['lunch', 'classic', 'comfort-food', 'weekend-project'],
  'recipe-8621bc1e-58f8-4c42-9e88-cb431193a70c': ['lunch', 'sandwich', 'asian-inspired', 'technique'],
  'recipe-6982aa15-066e-4983-b71e-447bfd145947': ['breakfast', 'vegetarian', 'one-pan', 'comfort-food', 'spice-blend'],
  'recipe-f771864d-5606-453e-b7bf-99364292e167': ['breakfast', 'classic', 'kid-friendly', 'vegetarian', 'quick'],
  'recipe-88d079d7-0567-405f-8cf6-63442e9d3dec': ['breakfast', 'make-ahead', 'comfort-food', 'baking'],
  'recipe-8c353b7e-2778-4233-90e2-cb9fa3af6d90': ['breakfast', 'asian-inspired', 'one-pot'],
  'recipe-78419866-345e-4aba-bbd6-e47a04c16ab6': ['breakfast', 'seafood', 'quick'],
  'recipe-d9c7f31a-aab4-4755-9e72-534cbbfadcb1': ['breakfast', 'weekend-project', 'high-protein', 'spice-blend'],
  'recipe-0a092665-105a-452d-a09f-a245fff87ac6': ['breakfast', 'technique', 'quick', 'vegetarian', 'gluten-free'],
  'recipe-db63ebef-f12e-4e83-9a95-71e20015258a': ['breakfast', 'baking', 'quick', 'vegetarian'],
};

function main() {
  const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8'));
  const byId = new Map(recipes.map(r => [r.id, r]));
  let updated = 0, missing = [];

  for (const [id, tags] of Object.entries(TAGS)) {
    const r = byId.get(id);
    if (!r) { missing.push(id); continue; }
    r.tags = tags;
    updated++;
  }

  fs.writeFileSync(RECIPES_PATH, JSON.stringify(recipes, null, 2) + '\n');
  console.log('Updated: ' + updated + ' / ' + Object.keys(TAGS).length);
  if (missing.length) console.log('Not found (id mismatch?): ' + missing.join(', '));

  const stillThin = recipes.filter(r => r.persona === 'user-submitted' && (r.tags || []).length < 3);
  console.log('user-submitted recipes still under 3 tags: ' + stillThin.length);
}

main();

import { getAll, put, remove, count, STORES } from './database.js';
import seedRecipes from '../domain/seedRecipes.json';

export function listRecipes() {
  return getAll(STORES.RECIPES);
}

export function saveRecipe(recipe) {
  const record = recipe.id ? recipe : { ...recipe, id: crypto.randomUUID() };
  return put(STORES.RECIPES, record).then(() => record);
}

export function deleteRecipe(id) {
  return remove(STORES.RECIPES, id);
}

// Loads the starter recipe set on first run only -- once a user has any
// recipes (seeded or their own), this is a no-op so it never clobbers edits.
export async function seedRecipesIfEmpty() {
  const existing = await count(STORES.RECIPES);
  if (existing > 0) return;
  await Promise.all(seedRecipes.map((recipe) => put(STORES.RECIPES, recipe)));
}

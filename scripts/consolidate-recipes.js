#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load existing recipes
const seedRecipesPath = path.join(__dirname, '../src/domain/seedRecipes.json');
const publicRecipesPath = path.join(__dirname, '../public/foodenvy-complete-recipes.json');
const seedRecipes = JSON.parse(fs.readFileSync(seedRecipesPath, 'utf8'));
const publicRecipes = JSON.parse(fs.readFileSync(publicRecipesPath, 'utf8'));

// Transform public recipes to add missing fields
const transformed = publicRecipes.map(recipe => ({
  id: `recipe-${randomUUID()}`,
  name: recipe.name,
  mealType: recipe.mealType,
  difficulty: recipe.difficulty || 'beginner-plus',
  prepMinutes: recipe.prepMinutes || 15,
  cookMinutes: recipe.cookMinutes || 30,
  description: recipe.description || '',
  imageUrl: recipe.imageUrl || '',
  persona: recipe.persona || 'user-submitted',
  ingredients: recipe.ingredients || [],
  steps: recipe.steps || [],
  tags: recipe.tags || deriveTagsFromMealType(recipe.mealType),
}));

function deriveTagsFromMealType(mealType) {
  const tagMap = {
    breakfast: ['breakfast'],
    lunch: ['lunch'],
    dinner: ['dinner'],
    dessert: ['dessert'],
    snack: ['snack'],
    treat: ['dessert', 'snack'],
  };
  return tagMap[mealType] || [];
}

// Combine: keep seed recipes as-is, add transformed public recipes
const consolidated = [
  ...seedRecipes,
  ...transformed,
];

console.log(`Consolidated ${seedRecipes.length} seed recipes + ${transformed.length} public recipes`);
console.log(`Total: ${consolidated.length} recipes`);

// Write back to seedRecipes.json (this is what the app loads)
fs.writeFileSync(seedRecipesPath, JSON.stringify(consolidated, null, 2));
console.log(`✅ Updated ${seedRecipesPath}`);

// Also update public version for reference
fs.writeFileSync(publicRecipesPath, JSON.stringify(consolidated, null, 2));
console.log(`✅ Updated ${publicRecipesPath}`);

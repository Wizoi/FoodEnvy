import { describe, it, expect } from 'vitest';
import { suggestMeals, getMissingIngredients, buildShoppingList } from './matcher.js';

const peanutRecipe = {
  id: 'r1',
  name: 'PB Sandwich',
  ingredients: [
    { name: 'bread', tags: ['gluten'] },
    { name: 'peanut butter', tags: ['nuts'] },
  ],
};

const veggieRecipe = {
  id: 'r2',
  name: 'Veggie Bowl',
  ingredients: [
    { name: 'rice', tags: [] },
    { name: 'broccoli', tags: [] },
  ],
};

describe('suggestMeals', () => {
  it('excludes a recipe when every family member has a strict conflict with it', () => {
    const members = [
      { id: 'm1', name: 'Alex', restrictions: [{ category: 'allergy', value: 'nuts', severity: 'strict' }] },
    ];
    const { ready, almost } = suggestMeals(members, [], [peanutRecipe, veggieRecipe]);
    const allIds = [...ready, ...almost].map((s) => s.recipe.id);
    expect(allIds).not.toContain('r1');
    expect(allIds).toContain('r2');
  });

  it('keeps a recipe eligible for members without the conflicting restriction', () => {
    const members = [
      { id: 'm1', name: 'Alex', restrictions: [{ category: 'allergy', value: 'nuts', severity: 'strict' }] },
      { id: 'm2', name: 'Sam', restrictions: [] },
    ];
    const { almost } = suggestMeals(members, [], [peanutRecipe]);
    const suggestion = almost.find((s) => s.recipe.id === 'r1');
    expect(suggestion).toBeTruthy();
    expect(suggestion.eligibleMembers).toEqual(['m2']);
    expect(suggestion.ineligibleMembers).toEqual(['m1']);
  });

  it('marks a recipe ready when all ingredients are in inventory, almost otherwise', () => {
    const members = [{ id: 'm1', name: 'Alex', restrictions: [] }];
    const inventory = [
      { id: 'i1', name: 'rice' },
      { id: 'i2', name: 'broccoli' },
    ];
    const { ready, almost } = suggestMeals(members, inventory, [veggieRecipe]);
    expect(ready.map((s) => s.recipe.id)).toContain('r2');
    expect(almost).toHaveLength(0);
  });

  it('a soft dislike lowers rank but does not exclude the recipe', () => {
    const members = [
      {
        id: 'm1',
        name: 'Alex',
        restrictions: [{ category: 'dislike', value: 'broccoli', severity: 'soft' }],
      },
    ];
    const { almost } = suggestMeals(members, [], [veggieRecipe]);
    const suggestion = almost.find((s) => s.recipe.id === 'r2');
    expect(suggestion.eligibleMembers).toEqual(['m1']);
    expect(suggestion.dislikeScore).toBeGreaterThan(0);
  });
});

describe('getMissingIngredients', () => {
  it('treats simple plurals as matching (eggs vs egg)', () => {
    const recipe = { ingredients: [{ name: 'egg', tags: ['egg'] }] };
    const inventory = [{ id: 'i1', name: 'eggs' }];
    expect(getMissingIngredients(recipe, inventory)).toHaveLength(0);
  });
});

describe('buildShoppingList', () => {
  it('de-duplicates missing ingredients across suggestions', () => {
    const suggestions = [
      { missingIngredients: [{ name: 'rice' }, { name: 'lime' }] },
      { missingIngredients: [{ name: 'rice' }, { name: 'avocado' }] },
    ];
    expect(buildShoppingList(suggestions)).toEqual(['rice', 'lime', 'avocado']);
  });
});

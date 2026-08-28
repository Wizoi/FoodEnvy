import { describe, it, expect } from 'vitest';
import {
  suggestMeals,
  getMissingIngredients,
  buildShoppingList,
  evaluateRecipeForSlot,
  buildUsageTrackedShoppingList,
  computeProteinTally,
  describeRepeats,
} from './matcher.js';

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

describe('evaluateRecipeForSlot', () => {
  it('recomputes eligibility and status against the members/inventory passed in, not a stale snapshot', () => {
    const members = [
      { id: 'm1', name: 'Alex', restrictions: [{ category: 'allergy', value: 'nuts', severity: 'strict' }] },
    ];
    const result = evaluateRecipeForSlot(peanutRecipe, members, []);
    expect(result.eligibleMembers).toEqual([]);
    expect(result.ineligibleMembers).toEqual(['m1']);
    expect(result.status).toBe('almost');

    // Same recipe, member's restriction lifted (e.g. profile edited since the plan was made).
    const updatedMembers = [{ id: 'm1', name: 'Alex', restrictions: [] }];
    const inventory = [{ id: 'i1', name: 'bread' }, { id: 'i2', name: 'peanut butter' }];
    const afterEdit = evaluateRecipeForSlot(peanutRecipe, updatedMembers, inventory);
    expect(afterEdit.eligibleMembers).toEqual(['m1']);
    expect(afterEdit.status).toBe('ready');
  });
});

describe('buildUsageTrackedShoppingList', () => {
  it('tracks which slots need each item so a swap can show its ripple effect', () => {
    const slots = [
      { slotId: 'mon-dinner', missingIngredients: [{ name: 'bell pepper' }, { name: 'rice' }] },
      { slotId: 'thu-dinner', missingIngredients: [{ name: 'bell pepper' }] },
    ];
    const list = buildUsageTrackedShoppingList(slots);
    const pepper = list.find((i) => i.name === 'bell pepper');
    expect(pepper.usedBy).toEqual(['mon-dinner', 'thu-dinner']);
    const rice = list.find((i) => i.name === 'rice');
    expect(rice.usedBy).toEqual(['mon-dinner']);
  });
});

describe('computeProteinTally / describeRepeats', () => {
  it('flags a protein source repeated 3+ times across the week', () => {
    const chickenDinner = { ingredients: [{ name: 'chicken', tags: ['meat'] }] };
    const tally = computeProteinTally([chickenDinner, chickenDinner, chickenDinner, veggieRecipe]);
    expect(tally.meat).toBe(3);
    expect(describeRepeats(tally)).toEqual(['meat appears in 3 meals this week']);
  });

  it('reports no repeats when nothing hits 3', () => {
    const tally = computeProteinTally([peanutRecipe, veggieRecipe]);
    expect(describeRepeats(tally)).toEqual([]);
  });
});

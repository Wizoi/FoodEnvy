import { describe, it, expect } from 'vitest';
import { parsePlanExport } from './planImport.js';

function validPlan() {
  return {
    foodEnvyPlanExport: true,
    version: 1,
    exportedAt: '2026-08-24T00:00:00.000Z',
    label: 'Week of Aug 24',
    forMemberIds: ['m1'],
    days: [
      {
        day: 'Monday',
        slots: [
          {
            slotId: 'mon-dinner',
            mealType: 'dinner',
            recipe: { name: 'Beef Stir-Fry', ingredients: [{ name: 'beef', tags: ['beef', 'meat'] }], steps: ['Cook it.'] },
            eligibleMembers: ['m1'],
            ineligibleMembers: [],
            status: 'ready',
            missingIngredients: [],
            alternates: [
              {
                recipe: { name: 'Tofu Curry', ingredients: [{ name: 'tofu', tags: ['soy'] }], steps: ['Simmer it.'] },
              },
            ],
            memberForks: [{ memberId: 'm1', forkAt: 'starch', instructions: 'Use rice instead of noodles.' }],
          },
        ],
      },
    ],
    shoppingList: [{ name: 'beef', usedBy: ['mon-dinner'] }],
  };
}

describe('parsePlanExport', () => {
  it('accepts a well-formed plan and assigns a fresh id', () => {
    const parsed = parsePlanExport(validPlan());
    expect(parsed.id).toBeTruthy();
    expect(parsed.days).toHaveLength(1);
  });

  it('rejects a file missing the export marker', () => {
    const plan = validPlan();
    delete plan.foodEnvyPlanExport;
    expect(() => parsePlanExport(plan)).toThrow(/Not a FoodEnvy plan export/);
  });

  it('rejects a plan with no days', () => {
    const plan = validPlan();
    plan.days = [];
    expect(() => parsePlanExport(plan)).toThrow(/no days/);
  });

  it('accepts a slot with mealName instead of full recipe', () => {
    const plan = validPlan();
    const slot = plan.days[0].slots[0];
    delete slot.recipe;
    slot.mealName = 'Grilled Chicken';
    expect(() => parsePlanExport(plan)).not.toThrow();
  });

  it('rejects a slot missing both recipe and mealName', () => {
    const plan = validPlan();
    delete plan.days[0].slots[0].recipe;
    expect(() => parsePlanExport(plan)).toThrow(/mealName is required/);
  });

  it('rejects an alternate missing ingredients', () => {
    const plan = validPlan();
    delete plan.days[0].slots[0].alternates[0].recipe.ingredients;
    expect(() => parsePlanExport(plan)).toThrow(/ingredients must be an array/);
  });

  it('rejects a member fork missing instructions', () => {
    const plan = validPlan();
    delete plan.days[0].slots[0].memberForks[0].instructions;
    expect(() => parsePlanExport(plan)).toThrow(/instructions is required/);
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildPlanPrompt,
  MissingApiKeyError,
  generateWeeklyPlan,
  PLAN_RESPONSE_SCHEMA,
} from './claudePlanClient.js';

describe('claudePlanClient', () => {
  describe('buildPlanPrompt', () => {
    it('should include allergy and diet restrictions in prompt', () => {
      const members = [
        {
          id: '1',
          name: 'Alice',
          selected: true,
          restrictions: [
            { category: 'allergy', value: 'peanuts', severity: 'strict' },
            { category: 'diet', value: 'dairy', severity: 'strict' },
          ],
        },
      ];
      const inventory = [{ name: 'chicken' }];
      const recipePool = [{ name: 'Simple Pasta' }];

      const { system, user } = buildPlanPrompt({
        members,
        inventory,
        recipePool,
        mealScope: 'breakfast, lunch, dinner',
        timeBudget: '30 minutes',
        involvement: 'beginner',
      });

      expect(system).toContain('CRITICAL SAFETY GATES');
      expect(system).toContain('BALANCE AND CONSOLIDATION');
      expect(user).toContain('Alice');
      expect(user).toContain('chicken');
    });

    it('should handle empty inventory', () => {
      const members = [{ id: '1', name: 'Alice', selected: true, restrictions: [] }];
      const { user } = buildPlanPrompt({
        members,
        inventory: [],
        recipePool: [],
        mealScope: 'dinner',
        timeBudget: '45 minutes',
        involvement: 'intermediate',
      });

      expect(user).toContain('(empty)');
    });

    it('should only include selected members', () => {
      const members = [
        { id: '1', name: 'Alice', selected: true, restrictions: [] },
        { id: '2', name: 'Bob', selected: false, restrictions: [] },
      ];
      const { user } = buildPlanPrompt({
        members,
        inventory: [],
        recipePool: [],
        mealScope: 'dinner',
        timeBudget: '30 minutes',
        involvement: 'easy',
      });

      expect(user).toContain('Alice');
      expect(user).not.toContain('Bob');
    });

    it('should include meal scope, time budget, and involvement', () => {
      const { system } = buildPlanPrompt({
        members: [],
        inventory: [],
        recipePool: [],
        mealScope: 'breakfast and lunch',
        timeBudget: '20 minutes',
        involvement: 'advanced',
      });

      expect(system).toContain('breakfast and lunch');
      expect(system).toContain('20 minutes');
      expect(system).toContain('advanced');
    });

    it('should limit recipe names to first 10', () => {
      const recipes = Array.from({ length: 15 }, (_, i) => ({ name: `Recipe ${i + 1}` }));
      const { user } = buildPlanPrompt({
        members: [],
        inventory: [],
        recipePool: recipes,
        mealScope: 'dinner',
        timeBudget: '30 minutes',
        involvement: 'easy',
      });

      expect(user).toContain('Recipe 1');
      expect(user).toContain('Recipe 10');
      expect(user).not.toContain('Recipe 11');
    });
  });

  describe('MissingApiKeyError', () => {
    it('should be throwable', () => {
      expect(() => {
        throw new MissingApiKeyError();
      }).toThrow(MissingApiKeyError);
    });

    it('should have correct name', () => {
      const err = new MissingApiKeyError();
      expect(err.name).toBe('MissingApiKeyError');
    });
  });

  describe('generateWeeklyPlan', () => {
    it('should throw MissingApiKeyError when no key provided', async () => {
      await expect(
        generateWeeklyPlan(null, {
          members: [],
          inventory: [],
          recipePool: [],
          mealScope: 'dinner',
          timeBudget: '30 minutes',
          involvement: 'easy',
        }),
      ).rejects.toThrow(MissingApiKeyError);
    });

    it('should throw MissingApiKeyError when empty key provided', async () => {
      await expect(
        generateWeeklyPlan('', {
          members: [],
          inventory: [],
          recipePool: [],
          mealScope: 'dinner',
          timeBudget: '30 minutes',
          involvement: 'easy',
        }),
      ).rejects.toThrow(MissingApiKeyError);
    });
  });

  describe('PLAN_RESPONSE_SCHEMA', () => {
    it('should define schema with required fields', () => {
      expect(PLAN_RESPONSE_SCHEMA.required).toContain('foodEnvyPlanExport');
      expect(PLAN_RESPONSE_SCHEMA.required).toContain('days');
    });

    it('should have days array items with required fields', () => {
      const dayItem = PLAN_RESPONSE_SCHEMA.properties.days.items;
      expect(dayItem.required).toContain('day');
      expect(dayItem.required).toContain('slots');
    });
  });
});

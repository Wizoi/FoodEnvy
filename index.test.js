// Real coverage over index.html's matching/filtering/plan-generation logic. The app is a single
// inline <script> with no modules to import (see CLAUDE.md "Working conventions"), so this loads
// the actual shipped file into jsdom and exercises its global functions directly -- testing the
// real code, not a parallel reimplementation, with zero changes to how the app itself is built.
//
// recipe-browser.html is a byte-identical duplicate of index.html (enforced manually, see
// CLAUDE.md) -- these tests exercise index.html only, on the assumption the two stay in sync.
import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let window;

beforeAll(async () => {
  const dom = await JSDOM.fromFile(path.resolve(__dirname, 'index.html'), {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    beforeParse(win) {
      // Neither is relevant to the logic under test; stub both so init doesn't throw/log noise.
      win.matchMedia = () => ({
        matches: false,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
      });
      win.fetch = () => Promise.resolve({ json: () => Promise.resolve([]) });
    },
  });
  window = dom.window;
});

function seed({ profiles = [], allRecipes = [] } = {}) {
  // Top-level `let profiles`/`allRecipes` in index.html's classic (non-module) script aren't
  // window properties, but a same-realm eval() shares the global lexical environment with them
  // -- this is how tests inject fixtures without the app exposing any test-only seam.
  window.eval(`profiles = ${JSON.stringify(profiles)}; allRecipes = ${JSON.stringify(allRecipes)};`);
}

function member(name, restrictions) {
  return { id: name, name, restrictions };
}

function ingredient(name, tags = []) {
  return { name, tags };
}

describe('getConflictingRestrictions', () => {
  it('flags a tag shared between a strict restriction and an ingredient', () => {
    const profile = member('Alex', [{ category: 'allergy', value: 'shellfish', severity: 'strict' }]);
    const recipe = { ingredients: [ingredient('shrimp', ['shellfish']), ingredient('rice')] };
    expect(window.getConflictingRestrictions(recipe, profile)).toEqual(['shellfish']);
  });

  it('ignores dislike restrictions entirely -- they are a separate, soft path', () => {
    const profile = member('Alex', [{ category: 'dislike', value: 'Shrimp', severity: 'soft' }]);
    const recipe = { ingredients: [ingredient('shrimp', ['shellfish'])] };
    expect(window.getConflictingRestrictions(recipe, profile)).toEqual([]);
  });

  it('returns no conflicts when no ingredient carries the restricted tag', () => {
    const profile = member('Alex', [{ category: 'diet', value: 'meat', severity: 'strict' }]);
    const recipe = { ingredients: [ingredient('tofu', ['soy'])] };
    expect(window.getConflictingRestrictions(recipe, profile)).toEqual([]);
  });
});

describe('getProfileAdaptationStatus', () => {
  it('excludes (unresolved) a strict conflict with no matching adaptation', () => {
    seed({ profiles: [member('Alex', [{ category: 'allergy', value: 'nuts', severity: 'strict' }])] });
    const recipe = { ingredients: [ingredient('peanuts', ['nuts'])], adaptations: [] };
    const status = window.getProfileAdaptationStatus(recipe, ['Alex']);
    expect(status.unresolved).toHaveLength(1);
    expect(status.resolved).toHaveLength(0);
  });

  it('resolves a strict conflict when a safe adaptation exists', () => {
    seed({ profiles: [member('Alex', [{ category: 'allergy', value: 'shellfish', severity: 'strict' }])] });
    const recipe = {
      ingredients: [ingredient('shrimp', ['shellfish'])],
      adaptations: [{ forRestriction: 'shellfish', type: 'alternateRecipe', alternateRecipe: { ingredients: [ingredient('chicken', ['meat'])] } }],
    };
    const status = window.getProfileAdaptationStatus(recipe, ['Alex']);
    expect(status.unresolved).toHaveLength(0);
    expect(status.resolved).toHaveLength(1);
    expect(status.resolved[0].tag).toBe('shellfish');
  });

  it('treats an adaptation as unresolved if the alternate introduces a new conflict for the same profile', () => {
    seed({
      profiles: [member('Alex', [
        { category: 'allergy', value: 'shellfish', severity: 'strict' },
        { category: 'allergy', value: 'nuts', severity: 'strict' },
      ])],
    });
    const recipe = {
      ingredients: [ingredient('shrimp', ['shellfish'])],
      adaptations: [{ forRestriction: 'shellfish', type: 'alternateRecipe', alternateRecipe: { ingredients: [ingredient('peanuts', ['nuts'])] } }],
    };
    const status = window.getProfileAdaptationStatus(recipe, ['Alex']);
    expect(status.unresolved).toHaveLength(1);
    expect(status.resolved).toHaveLength(0);
  });
});

describe('getDislikedIngredients / getDislikeStatus', () => {
  it('matches a disliked food name against an ingredient name, case-insensitively', () => {
    const profile = member('Alex', [{ category: 'dislike', value: 'Shrimp', severity: 'soft' }]);
    const recipe = { ingredients: [ingredient('Large shrimp, peeled and deveined')] };
    expect(window.getDislikedIngredients(recipe, profile)).toEqual(['Shrimp']);
  });

  it('never reports a dislike match for a strict-category restriction', () => {
    const profile = member('Alex', [{ category: 'allergy', value: 'shellfish', severity: 'strict' }]);
    const recipe = { ingredients: [ingredient('shrimp', ['shellfish'])] };
    expect(window.getDislikedIngredients(recipe, profile)).toEqual([]);
  });

  it('aggregates dislike matches across selected profiles by name', () => {
    seed({
      profiles: [
        member('Alex', [{ category: 'dislike', value: 'Mushrooms', severity: 'soft' }]),
        member('Sam', [{ category: 'dislike', value: 'Mushrooms', severity: 'soft' }]),
      ],
    });
    const recipe = { ingredients: [ingredient('sliced mushrooms')] };
    const status = window.getDislikeStatus(recipe, ['Alex', 'Sam']);
    expect(status).toHaveLength(1);
    expect(status[0].profileNames.sort()).toEqual(['Alex', 'Sam']);
  });
});

describe('generateWeekPlan', () => {
  it('never places a recipe with an unresolved conflict into a slot', () => {
    const nutAllergy = member('Alex', [{ category: 'allergy', value: 'nuts', severity: 'strict' }]);
    const unsafe = { id: 'r-unsafe', mealType: 'dinner', ingredients: [ingredient('peanuts', ['nuts'])], adaptations: [] };
    const safe = { id: 'r-safe', mealType: 'dinner', ingredients: [ingredient('rice')], adaptations: [] };
    seed({ profiles: [nutAllergy], allRecipes: [unsafe, safe] });

    const plan = window.generateWeekPlan(['Alex']);
    const chosenIds = Object.values(plan.slots).map(s => s.recipeId).filter(Boolean);
    expect(chosenIds).not.toContain('r-unsafe');
  });

  it('leaves a slot with no eligible recipe as unfilled rather than guessing', () => {
    seed({ profiles: [], allRecipes: [] });
    const plan = window.generateWeekPlan([]);
    const filled = Object.values(plan.slots).filter(s => s.recipeId);
    expect(filled).toHaveLength(0);
  });

  it('records the requested profileIds on the generated plan', () => {
    seed({ profiles: [member('Alex', [])], allRecipes: [{ id: 'r1', mealType: 'dinner', ingredients: [] }] });
    const plan = window.generateWeekPlan(['Alex']);
    expect(plan.profileIds).toEqual(['Alex']);
  });
});

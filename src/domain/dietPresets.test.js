import { describe, it, expect } from 'vitest';
import { restrictionsForDiet } from './dietPresets.js';

describe('restrictionsForDiet', () => {
  it('vegan excludes meat, fish, dairy, and egg -- not just meat', () => {
    const tags = restrictionsForDiet('vegan').map((r) => r.value);
    expect(tags).toEqual(expect.arrayContaining(['meat', 'fish', 'dairy', 'egg']));
  });

  it('vegetarian excludes meat and fish but not dairy or egg', () => {
    const tags = restrictionsForDiet('vegetarian').map((r) => r.value);
    expect(tags).toEqual(expect.arrayContaining(['meat', 'fish']));
    expect(tags).not.toContain('dairy');
    expect(tags).not.toContain('egg');
  });

  it('dairy-free excludes only dairy, not meat or fish', () => {
    const tags = restrictionsForDiet('dairyFree').map((r) => r.value);
    expect(tags).toEqual(['dairy']);
  });

  it('every generated restriction is strict diet-category', () => {
    for (const r of restrictionsForDiet('pescatarian')) {
      expect(r.category).toBe('diet');
      expect(r.severity).toBe('strict');
    }
  });

  it('returns an empty list for an unknown or "none"/"other" key', () => {
    expect(restrictionsForDiet('none')).toEqual([]);
    expect(restrictionsForDiet('other')).toEqual([]);
    expect(restrictionsForDiet('not-a-real-diet')).toEqual([]);
  });
});

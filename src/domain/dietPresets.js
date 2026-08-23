// One-tap diet-type shortcuts for the profile wizard. Each preset expands to
// the strict 'diet' restrictions that keep matcher.js's exclusion logic
// consistent with what a Vegan/Vegetarian/Pescatarian/Gluten-Free/Dairy-Free
// specialist would actually require (see docs/personas.md) -- e.g. vegan
// excludes dairy and egg, not just meat and fish.
export const DIET_PRESETS = {
  vegetarian: ['meat', 'pork', 'beef', 'fish'],
  vegan: ['meat', 'pork', 'beef', 'fish', 'dairy', 'egg'],
  pescatarian: ['meat', 'pork', 'beef'],
  glutenFree: ['gluten'],
  dairyFree: ['dairy'],
};

export const DIET_PRESET_OPTIONS = [
  { key: 'none', label: 'None', description: 'No specific diet -- eats everything.' },
  { key: 'vegetarian', label: 'Vegetarian', description: 'No meat or fish. Dairy and eggs are OK.' },
  { key: 'vegan', label: 'Vegan', description: 'No meat, fish, dairy, or eggs.' },
  { key: 'pescatarian', label: 'Pescatarian', description: 'No meat, but fish and seafood are OK.' },
  { key: 'glutenFree', label: 'Gluten-Free', description: 'No wheat, barley, rye, or other gluten sources.' },
  { key: 'dairyFree', label: 'Dairy-Free', description: 'No milk, cheese, or other dairy.' },
  {
    key: 'other',
    label: 'Other',
    description:
      "Something else (e.g. keto, paleo, halal, kosher, low-FODMAP, Mediterranean) -- describe it below. We'll save it for reference, but won't auto-filter recipes by it yet.",
  },
];

export function restrictionsForDiet(dietKey) {
  const tags = DIET_PRESETS[dietKey];
  if (!tags) return [];
  return tags.map((tag) => ({ category: 'diet', value: tag, severity: 'strict' }));
}

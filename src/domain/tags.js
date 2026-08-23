// Canonical vocabulary shared by FamilyMember restrictions and Recipe ingredient
// tags, so a strict allergy/diet restriction can be checked against a recipe by
// simple tag intersection instead of free-text ingredient name matching.
export const ALLERGEN_TAGS = ['dairy', 'gluten', 'nuts', 'shellfish', 'egg', 'soy', 'sesame'];
export const DIET_TAGS = ['meat', 'pork', 'beef', 'fish'];

export const ALL_TAGS = [...ALLERGEN_TAGS, ...DIET_TAGS];

export const RESTRICTION_CATEGORIES = ['allergy', 'diet', 'dislike', 'goal'];
export const RESTRICTION_SEVERITIES = ['strict', 'soft'];

// The FDA's "Big 9" major food allergens, mapped to our tag vocabulary. Tree
// nuts and peanuts share the single 'nuts' tag rather than being split, since
// that's the granularity the rest of the app (ingredient tags, matcher.js)
// works at.
export const BIG9_ALLERGENS = [
  { label: 'Milk / Dairy', tag: 'dairy' },
  { label: 'Egg', tag: 'egg' },
  { label: 'Fish', tag: 'fish' },
  { label: 'Shellfish', tag: 'shellfish' },
  { label: 'Tree nuts & peanuts', tag: 'nuts' },
  { label: 'Wheat / Gluten', tag: 'gluten' },
  { label: 'Soy', tag: 'soy' },
  { label: 'Sesame', tag: 'sesame' },
];

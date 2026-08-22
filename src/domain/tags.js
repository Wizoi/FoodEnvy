// Canonical vocabulary shared by FamilyMember restrictions and Recipe ingredient
// tags, so a strict allergy/diet restriction can be checked against a recipe by
// simple tag intersection instead of free-text ingredient name matching.
export const ALLERGEN_TAGS = ['dairy', 'gluten', 'nuts', 'shellfish', 'egg', 'soy'];
export const DIET_TAGS = ['meat', 'pork', 'beef', 'fish'];

export const ALL_TAGS = [...ALLERGEN_TAGS, ...DIET_TAGS];

export const RESTRICTION_CATEGORIES = ['allergy', 'diet', 'dislike', 'goal'];
export const RESTRICTION_SEVERITIES = ['strict', 'soft'];

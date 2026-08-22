// Core suggestion engine: given family members, current inventory, and known
// recipes, work out which recipes are safe for whom, what's missing from the
// pantry, and rank the results. Pure functions, no I/O -- the db/ layer feeds
// this data in and the components/meals/ UI renders what comes out.

function normalize(str) {
  return str.trim().toLowerCase().replace(/e?s$/, '');
}

function inventoryHasIngredient(ingredientName, inventory) {
  const target = normalize(ingredientName);
  return inventory.some((item) => {
    const name = normalize(item.name);
    return name === target || name.includes(target) || target.includes(name);
  });
}

function violatesStrictRestriction(ingredient, member) {
  return member.restrictions.some(
    (r) =>
      r.severity === 'strict' &&
      (r.category === 'allergy' || r.category === 'diet') &&
      ingredient.tags?.includes(r.value),
  );
}

function countDislikeMatches(ingredient, member) {
  return member.restrictions.filter(
    (r) =>
      r.category === 'dislike' &&
      (ingredient.tags?.includes(r.value) || normalize(ingredient.name) === normalize(r.value)),
  ).length;
}

// Splits members into who can safely eat this recipe vs. who has a strict
// allergy/diet conflict with one of its ingredients.
export function getRecipeEligibility(recipe, members) {
  const eligibleMembers = [];
  const ineligibleMembers = [];
  for (const member of members) {
    const conflicts = recipe.ingredients.some((ing) => violatesStrictRestriction(ing, member));
    (conflicts ? ineligibleMembers : eligibleMembers).push(member.id);
  }
  return { eligibleMembers, ineligibleMembers };
}

export function getMissingIngredients(recipe, inventory) {
  return recipe.ingredients.filter((ing) => !inventoryHasIngredient(ing.name, inventory));
}

// Lower is better -- counts how many ingredients trip a "dislike" (soft)
// restriction for members who are otherwise eligible to eat this recipe.
export function scoreDislikes(recipe, members, eligibleMemberIds) {
  const eligible = members.filter((m) => eligibleMemberIds.includes(m.id));
  let count = 0;
  for (const ing of recipe.ingredients) {
    for (const member of eligible) {
      count += countDislikeMatches(ing, member);
    }
  }
  return count;
}

// Returns { ready: [...], almost: [...] }, each entry shaped as:
// { recipe, eligibleMembers, ineligibleMembers, missingIngredients, dislikeScore, status }
// Recipes nobody in the family can safely eat are dropped entirely.
export function suggestMeals(members, inventory, recipes) {
  const suggestions = recipes
    .map((recipe) => {
      const { eligibleMembers, ineligibleMembers } = getRecipeEligibility(recipe, members);
      const missingIngredients = getMissingIngredients(recipe, inventory);
      const dislikeScore = scoreDislikes(recipe, members, eligibleMembers);
      return {
        recipe,
        eligibleMembers,
        ineligibleMembers,
        missingIngredients,
        dislikeScore,
        status: missingIngredients.length === 0 ? 'ready' : 'almost',
      };
    })
    .filter((s) => s.eligibleMembers.length > 0)
    .sort((a, b) => {
      if (a.missingIngredients.length !== b.missingIngredients.length) {
        return a.missingIngredients.length - b.missingIngredients.length;
      }
      return a.dislikeScore - b.dislikeScore;
    });

  return {
    ready: suggestions.filter((s) => s.status === 'ready'),
    almost: suggestions.filter((s) => s.status === 'almost'),
  };
}

// De-duplicated shopping list built from the missing ingredients of a set of
// "almost" suggestions (typically the ones the user picked to make).
export function buildShoppingList(almostSuggestions) {
  const seen = new Map();
  for (const suggestion of almostSuggestions) {
    for (const ing of suggestion.missingIngredients) {
      const key = normalize(ing.name);
      if (!seen.has(key)) seen.set(key, ing.name);
    }
  }
  return [...seen.values()];
}

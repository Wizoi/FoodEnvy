// Validates a weekly-plan JSON produced by the Claude plan generation.
// Supports both full-recipe format (for backward compatibility) and
// simplified meal-name-only format (for faster generation).
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateRecipe(recipe, path) {
  assert(recipe && typeof recipe.name === 'string', `${path}.recipe.name is required`);
  assert(Array.isArray(recipe.ingredients), `${path}.recipe.ingredients must be an array`);
  assert(Array.isArray(recipe.steps), `${path}.recipe.steps must be an array`);
}

function validateSlot(slot, path) {
  assert(typeof slot.slotId === 'string', `${path}.slotId is required`);
  assert(typeof slot.mealType === 'string', `${path}.mealType is required`);
  assert(Array.isArray(slot.eligibleMembers), `${path}.eligibleMembers must be an array`);
  assert(Array.isArray(slot.ineligibleMembers), `${path}.ineligibleMembers must be an array`);

  // Support both formats: full recipe or just mealName
  if (slot.recipe) {
    validateRecipe(slot.recipe, path);
  } else {
    assert(typeof slot.mealName === 'string', `${path}.mealName is required if recipe not provided`);
  }

  for (const [i, alt] of (slot.alternates ?? []).entries()) {
    validateRecipe(alt.recipe, `${path}.alternates[${i}]`);
  }
  for (const [i, fork] of (slot.memberForks ?? []).entries()) {
    assert(typeof fork.memberId === 'string', `${path}.memberForks[${i}].memberId is required`);
    assert(typeof fork.instructions === 'string', `${path}.memberForks[${i}].instructions is required`);
  }
}

// Throws a descriptive error if `data` isn't a valid plan export; otherwise
// returns it with a fresh id (so importing twice, or on a different device,
// never collides with an existing saved plan).
export function parsePlanExport(data) {
  assert(data && data.foodEnvyPlanExport === true, 'Not a FoodEnvy plan export file.');
  assert(Array.isArray(data.days) && data.days.length > 0, 'Plan has no days.');

  for (const [dayIndex, day] of data.days.entries()) {
    assert(typeof day.day === 'string', `days[${dayIndex}].day is required`);
    assert(Array.isArray(day.slots) && day.slots.length > 0, `days[${dayIndex}] has no meal slots`);
    day.slots.forEach((slot, slotIndex) => validateSlot(slot, `days[${dayIndex}].slots[${slotIndex}]`));
  }

  return { ...data, id: crypto.randomUUID() };
}

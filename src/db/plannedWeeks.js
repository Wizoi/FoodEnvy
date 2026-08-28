import { getAll, put, remove, STORES } from './database.js';
import { evaluateRecipeForSlot } from '../domain/matcher.js';

export function listPlannedWeeks() {
  return getAll(STORES.PLANS);
}

export function savePlannedWeek(plan) {
  const record = plan.id ? plan : { ...plan, id: crypto.randomUUID() };
  return put(STORES.PLANS, record).then(() => record);
}

export function deletePlannedWeek(id) {
  return remove(STORES.PLANS, id);
}

// Swaps a slot's recipe for one of its pre-generated alternates ("I don't
// want this dish"), then re-validates the new recipe against the CURRENT
// members/inventory rather than trusting whatever the plan-meal skill
// computed at generation time -- a plan is a snapshot, restrictions and
// inventory aren't (see Aisha Rahman's persona finding). Returns a new plan
// object; does not mutate the one passed in.
export function swapMealSlot(plan, dayIndex, slotId, alternateIndex, members, inventory) {
  const days = plan.days.map((day, i) => {
    if (i !== dayIndex) return day;
    return {
      ...day,
      slots: day.slots.map((slot) => {
        if (slot.slotId !== slotId) return slot;
        const chosen = slot.alternates?.[alternateIndex];
        if (!chosen) throw new Error(`No alternate ${alternateIndex} for slot ${slotId}`);
        const evaluated = evaluateRecipeForSlot(chosen.recipe, members, inventory);
        // The alternate becomes the new slot; the previous winning recipe
        // rejoins the alternates list so a swap is never a one-way door.
        const remainingAlternates = slot.alternates.filter((_, i2) => i2 !== alternateIndex);
        return {
          ...slot,
          ...evaluated,
          alternates: [{ recipe: slot.recipe }, ...remainingAlternates],
          memberForks: chosen.memberForks ?? [],
        };
      }),
    };
  });
  return { ...plan, days };
}

// Re-validates every slot's eligibility against the CURRENT members/
// inventory -- covers the staleness risk for meals that were never swapped
// too (a restriction added after the plan was generated shouldn't only be
// caught when the user happens to swap that specific meal).
export function revalidatePlan(plan, members, inventory) {
  const days = plan.days.map((day) => ({
    ...day,
    slots: day.slots.map((slot) => ({ ...slot, ...evaluateRecipeForSlot(slot.recipe, members, inventory) })),
  }));
  return { ...plan, days };
}

// Marks that a member should get a slot's same-dish fork (e.g. gluten-free
// starch swap) rather than the shared recipe as-is. This never changes
// eligibility/status -- a fork exists specifically because the shared
// recipe would otherwise be ineligible for that member.
export function applyMemberFork(plan, dayIndex, slotId, memberId) {
  const days = plan.days.map((day, i) => {
    if (i !== dayIndex) return day;
    return {
      ...day,
      slots: day.slots.map((slot) => {
        if (slot.slotId !== slotId) return slot;
        const appliedForkMemberIds = [...new Set([...(slot.appliedForkMemberIds ?? []), memberId])];
        return { ...slot, appliedForkMemberIds };
      }),
    };
  });
  return { ...plan, days };
}

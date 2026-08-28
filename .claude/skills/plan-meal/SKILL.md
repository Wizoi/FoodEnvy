---
name: plan-meal
description: Have FoodEnvy's cook and nutrition personas review a family's profiles and current inventory together and work out a week of meals -- fusion ideas welcome -- that fit within everyone's dietary constraints. Use whenever the user asks to plan meals, build a menu, or figure out what to cook for the week.
---

# Plan meal

Runs FoodEnvy's cook + nutrition personas (see [docs/personas.md](../../../docs/personas.md) for
the roster, or `docs/personas/` directly) against a family's actual profiles and pantry, and
produces one week's meal plan with a shopping list. The personas genuinely collaborate here --
including proposing fusion ideas that combine well with what another persona would suggest -- not
just each giving an isolated opinion.

## When to use this

Any time the user asks to plan meals, build a menu, figure out what to cook this week, or
similar -- "plan meals for the week," "what should we make for dinner this week," "build a menu."

## Steps

1. **Ask the clarifying questions** (via `AskUserQuestion`) if the user's request didn't already
   answer them:
   - **Who is this for?** All family members, or a specific subset?
   - **What meals?** Dinner only, or a fuller menu (breakfast/lunch/dinner/snacks)?
   - **Target average prep + cook time?** (e.g. under 20 min weeknight-quick, 20-40 min standard,
     40+ min some nights are fine)
   - **How involved should the week be?** Maps to a skill-level/persona mix -- mostly simple and
     familiar, a mix, or willing to stretch into something more adventurous a night or two.
   - Also confirm how many days/meals to plan if not obvious (a full week of dinners is the
     default assumption for "plan meals for the week").

2. **Load the data**:
   - Look for a `foodEnvyPlanRequest` JSON exported from the app's Weekly Plan tab (bundles
     selected members, current inventory, and the four clarifying answers in one file) -- if
     found, it answers step 1 for you. Otherwise look for the most recently exported profile JSON
     (`foodEnvyProfileExport`, typically `Profiles/<name>.json`) and inventory JSON
     (`foodEnvyInventoryExport`). If none of these are found, ask the user to export from the app
     or describe their family members' restrictions and current pantry directly.
   - Read `src/domain/seedRecipes.json` for the existing recipe pool, and
     `src/domain/dietPresets.js` / `src/domain/tags.js` to understand how restrictions map to
     ingredient tags.

3. **Select the relevant persona roster** -- not all 16 cook/nutrition personas every time:
   - **Always include**: `amara-chen-family-nutrition`, `nora-whitfield-pediatric-nutrition` (if
     any selected member appears to be a child), and one chef organizer
     (`lucia-alvarez-batch-cook`; add `ben-osei-parallel-menu` too if the family's restrictions
     genuinely differ member-to-member and a shared meal needs a branch point).
   - **Match involvement level**: `jamie-weeknight-beginner`/`marcus-dorm-starter` for "mostly
     simple," `priya-busy-parent`/`dana-hellofresh-regular` for "standard weeknight," and
     `elena-weekend-hobbyist`/`theo-blue-apron-adventurer` for "willing to stretch."
   - **Conditionally include a dietary specialist** only if that diet/allergy actually appears
     among the selected members' restrictions -- e.g. only bring in `devon-okafor-vegan` if
     someone's profile has a vegan diet restriction. Always include `aisha-rahman-allergy-safety`
     if any selected member has a strict allergy restriction of any kind.

4. **Launch the selected personas in parallel** (single message, multiple `Agent` calls,
   `run_in_background: false`). Give every persona the **same self-contained context**:

   > Plan meals for: {{selected family members, each with their restrictions}}.
   > Meal scope: {{dinner only / full menu}}. Target prep+cook time: {{answer}}. Involvement
   > level: {{answer}}. Current inventory: {{list}}. Existing recipe pool:
   > {{seedRecipes.json summary}}.
   >
   > From your persona's lens (read your own file first), propose meal ideas for this week that
   > respect every strict restriction listed above. Prefer using what's already in inventory;
   > where a good idea needs something not on hand, say what and how much. Fusion ideas that
   > combine well with another persona's likely suggestion are welcome -- say so explicitly if a
   > proposal is meant to build on a formula another persona (e.g. the meal-kit or chef personas)
   > would recognize.

5. **Reconcile into one week's plan**:
   - Prefer inventory-first meals; group the rest by what needs buying.
   - Resolve overlapping/competing proposals into fusion suggestions where they genuinely combine
     well (e.g. a meal-kit persona's formula plus a dietary specialist's protein swap).
   - Have the nutritionist persona(s)' input drive a final balance pass across the whole week
     (variety of protein sources and food groups, not just each meal in isolation).
   - Have the chef persona(s)' input drive the shopping list: consolidated, cross-utilized across
     meals, organized by store section, and any parallel-track branch points called out clearly.
   - Run every proposed meal past `aisha-rahman-allergy-safety`'s principles (even if not invoked
     directly above, re-check the final list) before finalizing -- a strict allergy is
     non-negotiable.
   - **Keep 1-2 runner-up proposals per slot as `alternates`** instead of discarding them once one
     wins -- the persona fan-out already produces multiple candidate meals per slot. Run each
     alternate's ingredients past `aisha-rahman-allergy-safety` too, same as the winner. An
     alternate is a genuinely *different dish* for "I don't want this," not a variant of the
     winner.
   - **Separately, for any member whose restriction means the winning recipe wouldn't otherwise
     work for them, generate a `memberForks` entry** from the relevant dietary-specialist persona
     (e.g. `sofia-marsh-gluten-free` for a gluten-free member, `devon-okafor-vegan` for a vegan
     member) instead of excluding them or giving them a different dish. A fork is the *same dish*,
     branched at the latest safe point (e.g. `{ memberId, forkAt: 'starch', instructions: 'use
     rice pasta instead of wheat pasta' }`) -- this is a distinct mechanism from `alternates`, per
     Chef Ben Osei's and Sofia Marsh's parallel-track principle: swapping to a whole different
     dish is not the same as adapting one dish for one person.

6. **Present the plan** in chat (per meal: recipe name, ready-now vs. needs-shopping status, a
   simple ingredient list and steps, who at the table it's for, and any alternates/forks), **and
   also write a `foodEnvyPlanExport` JSON file** (e.g. `plan-<date>.json`) so the app can import
   and display it. Shape:

   ```json
   {
     "foodEnvyPlanExport": true,
     "version": 1,
     "exportedAt": "<ISO date>",
     "label": "Week of <date>",
     "forMemberIds": ["..."],
     "days": [
       {
         "day": "Monday",
         "slots": [
           {
             "slotId": "mon-dinner",
             "mealType": "dinner",
             "recipe": { "name": "...", "ingredients": [{ "name": "...", "tags": [] }], "steps": ["..."] },
             "eligibleMembers": ["..."],
             "ineligibleMembers": [],
             "status": "ready",
             "missingIngredients": [],
             "alternates": [{ "recipe": { "...": "same shape as recipe above" } }],
             "memberForks": [{ "memberId": "...", "forkAt": "starch", "instructions": "..." }]
           }
         ]
       }
     ]
   }
   ```

   The app recomputes `eligibleMembers`/`ineligibleMembers`/`status`/`missingIngredients` live
   against current profiles/inventory on every view (see `src/db/plannedWeeks.js`'s
   `revalidatePlan`), so these fields only need to be reasonable at export time -- they don't have
   to be perfectly maintained by hand.

## Notes

- A generated recipe lives in the plan export, never in `src/domain/seedRecipes.json` -- that file
  is the shared seed data for every install, not one family's weekly plan. If the user wants to
  keep a specific recipe permanently, that's a separate, explicit ask.
- If the user's family has no meaningful dietary variation (no allergies, one shared diet), it's
  fine to skip the dietary-specialist fan-out (and `memberForks`) entirely and say so -- don't
  force a specialist opinion where there's nothing to specialize in.
- If no profile/inventory export can be found and the user won't describe their family/pantry
  directly, stop and ask rather than inventing a hypothetical family.
- Don't conflate `alternates` and `memberForks` -- an alternate is a different dish for "I don't
  want this one," a fork is the same dish adapted for one person's restriction. Offering a whole
  different dinner to solve "make this gluten-free" defeats the point of a shared family meal.

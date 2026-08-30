---
name: plan-meal
description: Have FoodEnvy's cook and nutrition personas review a family's dietary restrictions together and work out a week of meals -- fusion ideas welcome -- that fit within everyone's constraints. Use whenever the user asks to plan meals, build a menu, or figure out what to cook for the week.
---

# Plan meal

Runs FoodEnvy's cook + nutrition personas (see [docs/personas.md](../../../docs/personas.md) for
the roster, or `docs/personas/` directly) against a family's actual restrictions, and produces one
week's meal plan with a shopping list, presented in chat. The personas genuinely collaborate here
-- including proposing fusion ideas that combine well with what another persona would suggest --
not just each giving an isolated opinion.

This is a richer, creative complement to the app's own "Plan my week" tab (which auto-generates a
grid from the existing recipe library using simple deterministic scoring, no persona involved) --
not a replacement for it, and there's no file hand-off between the two: the app has no
profile/plan import feature, so this skill's output is a chat presentation only (see "Notes").

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
   - The app (`index.html`) keeps profiles in the browser's `localStorage` only -- there is no
     profile export/import feature to read a file from. Ask the user to describe each family
     member directly: name, allergies (FDA Big 9), medical/ethical restrictions (e.g.
     gluten-free), diet (vegetarian/vegan/pescatarian/none), and any dislikes. If they'd rather
     just open the app and read their profiles off the "Profiles & Collections" panel to relay
     them, that's fine too.
   - Read `public/foodenvy-complete-recipes.json` for the existing recipe pool (this is the same
     file the app fetches at runtime -- see `CLAUDE.md`) to see what's already in the library
     before proposing new dishes, and to reuse its ingredient-tag vocabulary (`dairy, gluten,
     nuts, shellfish, egg, soy, sesame, meat, pork, beef, fish`) so any new dish you describe
     stays consistent with how the app checks restrictions.

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
   > level: {{answer}}. Existing recipe library: {{foodenvy-complete-recipes.json summary --
   > what's already there for this family, so proposals can point at an existing recipe by name
   > instead of always inventing a new one}}.
   >
   > From your persona's lens (read your own file first), propose meal ideas for this week that
   > respect every strict restriction listed above -- reusing an existing library recipe where a
   > good match already exists, and describing a full new recipe (ingredients with tags, steps)
   > where it doesn't. Fusion ideas that combine well with another persona's likely suggestion are
   > welcome -- say so explicitly if a proposal is meant to build on a formula another persona
   > (e.g. the meal-kit or chef personas) would recognize.

5. **Reconcile into one week's plan**:
   - Resolve overlapping/competing proposals into fusion suggestions where they genuinely combine
     well (e.g. a meal-kit persona's formula plus a dietary specialist's protein swap).
   - Have the nutritionist persona(s)' input drive a final balance pass across the whole week
     (variety of protein sources and food groups, not just each meal in isolation).
   - Have the chef persona(s)' input drive the shopping list: consolidated, cross-utilized across
     meals, organized by store section, and any parallel-track branch points called out clearly.
   - Run every proposed meal past `aisha-rahman-allergy-safety`'s principles (even if not invoked
     directly above, re-check the final list) before finalizing -- a strict allergy is
     non-negotiable.
   - **Use the same `adaptations` shape the recipe library itself uses** (see any recipe in
     `public/foodenvy-complete-recipes.json`, or `CLAUDE.md`'s "What's in this repo") for anyone a
     winning dish doesn't already work for -- an array of `{ forRestriction: <tag>, type:
     'swap'|'alternateRecipe', ... }` entries. `type: 'swap'` is the *same dish*, adapted at the
     latest safe point (e.g. "use rice pasta instead of wheat pasta" for a gluten-free member) --
     prefer this whenever the dish still works as the same family meal. `type: 'alternateRecipe'`
     is a genuinely *different dish* embedded inline, for when no same-dish swap keeps it safe or
     recognizable (e.g. swapping shrimp tacos to chicken tacos for a shellfish allergy). Don't
     reach for `alternateRecipe` just because a member "doesn't want this one" -- that's a
     dislike, not a restriction, and doesn't need an adaptation at all (see `CLAUDE.md`'s
     dislike-matching notes). Run every `alternateRecipe`'s own ingredients past
     `aisha-rahman-allergy-safety` too, same as the winning dish -- a fix for one allergen must
     never introduce a different one.

6. **Present the plan** in chat: per meal, the recipe name (flagging whether it's already in the
   library or newly proposed), a simple ingredient list and steps (or a pointer to the existing
   library recipe by name), who at the table it's for, and any `adaptations` needed. Close with
   the consolidated shopping list. There is no file to write and no import step -- the app has no
   plan-import feature (see `CLAUDE.md` "History"), so this chat presentation *is* the
   deliverable. If the user wants a specific new recipe permanently added to the app's library,
   that's a separate, explicit ask -- point them at the `find-recipe` skill rather than writing to
   `public/foodenvy-complete-recipes.json` directly here.

## Notes

- A recipe proposed for this one week's plan is not automatically added to
  `public/foodenvy-complete-recipes.json` -- that file is shared library data for every install,
  not one family's week. If the user wants to keep a specific recipe permanently, use the
  `find-recipe` skill.
- If the user's family has no meaningful dietary variation (no allergies, one shared diet), it's
  fine to skip the dietary-specialist fan-out (and any `adaptations`) entirely and say so -- don't
  force a specialist opinion where there's nothing to specialize in.
- If the user won't describe their family's restrictions directly (there's no profile export to
  read instead -- see step 2), stop and ask rather than inventing a hypothetical family.
- Don't conflate a `swap` and an `alternateRecipe` -- a swap is the same dish adapted for one
  person's restriction, an alternate is a genuinely different dish. Offering a whole different
  dinner to solve "make this gluten-free" defeats the point of a shared family meal. And don't
  reach for either one to solve a plain dislike -- a dislike never needs an adaptation, it's a
  soft preference, not a restriction.

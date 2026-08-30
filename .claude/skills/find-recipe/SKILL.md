---
name: find-recipe
description: Bulk-author recipes for FoodEnvy's recipe library, persona by persona, with full metadata (image, allergy/diet/restriction tags, ingredients, a persona-voice summary, and generic swap-or-alternate-recipe adaptations for common restrictions) -- each batch independently reviewed by a fresh instance of the authoring persona before anything is written to the live library. Use whenever the user asks to add recipes to the library, generate recipes for a persona/meal type/difficulty, or expand the recipe collection.
---

# Find recipe

Authors batches of recipes for FoodEnvy's live recipe library (`public/foodenvy-complete-recipes.json`,
the file `index.html`/`recipe-browser.html` actually fetch and render) using the relevant cook/
nutrition persona(s), then independently re-checks every recipe with a **second, fresh instance**
of the same persona before writing anything. This is the properly-reviewed replacement for the old
ad-hoc batch-generation process (`consolidate-all-recipes.js` stitching together one-off session
outputs) that produced the current library's data gaps -- 16 of 56 recipes missing difficulty/time,
72 ingredients missing amounts, no images, no allergy tags. Don't repeat that: every recipe this
skill writes must be complete.

## When to use this

Whenever the user asks to add recipes to the library, generate a batch of recipes for a
persona/meal type/difficulty, or expand the recipe collection -- "get me 50 dinner recipes from
Priya," "add some intermediate gluten-free recipes," "let's fill out the breakfast options."

## Reference: the schema to produce

Every recipe must match the shape already used by `public/foodenvy-complete-recipes.json` (read a
few real entries there before authoring anything -- schema drift is the failure mode this skill
exists to prevent). A complete recipe:

```json
{
  "id": "recipe-<persona-slug>-<dish-slug>",
  "name": "Sheet-Pan Lemon Chicken",
  "mealType": "dinner",
  "difficulty": "beginner-plus",
  "prepMinutes": 10,
  "cookMinutes": 25,
  "restMinutes": 0,
  "description": "One pan, thirty-five minutes, and everyone at the table eats the same thing -- that's the whole job description. (persona-voice, 1-2 sentences)",
  "persona": "priya-busy-parent",
  "tags": ["quick", "one-pan"],
  "imageUrl": "",
  "imageAttribution": null,
  "ingredients": [
    { "name": "chicken thighs", "amount": "4", "unit": "pieces", "tags": ["meat"] },
    { "name": "lemon", "amount": "1", "unit": "whole", "tags": [] }
  ],
  "steps": ["Toss and roast at 400F for 25 minutes."],
  "adaptations": [
    {
      "forRestriction": "meat",
      "type": "alternateRecipe",
      "alternateRecipe": { "...": "a COMPLETE recipe object, same shape as above, not a stub" }
    }
  ]
}
```

**Field rules (every one of these was a real bug in the existing library -- don't reintroduce them):**
- `mealType`: one of `breakfast, lunch, dinner, dessert, treat, snack`.
- `difficulty`: one of `beginner, beginner-plus, intermediate, advanced` -- standardize on these
  four even though the live UI's filter dropdown only currently offers three (missing
  `beginner`); that's a separate, small app bug, not something to fix here or work around by
  avoiding the `beginner` value.
- `prepMinutes`/`cookMinutes`: always present, always a number. Never omit.
- `restMinutes`: always present (explicit `0` if there's genuinely none -- never omit it the way
  `prepMinutes`/`cookMinutes` must never be omitted; omission is reserved for the pre-existing
  library recipes that predate this field, not for new ones). Must agree with what the recipe's
  own `steps` text actually says: if a step describes yeast rise, dough rest, chilling,
  marinating, or resting after cooking, `restMinutes` must reflect it (summed if the steps
  narrate more than one stage -- e.g. a 15-minute butter-cool before mixing plus a separate
  30-60-minute dough chill before baking is `restMinutes: 45` at minimum, not two separate
  fields). If no step describes passive time, `restMinutes: 0` -- don't pad a plausible-sounding
  number, and don't fold rest time into `cookMinutes` (that's the exact defect class that made
  this field necessary -- a review pass on an earlier batch found a yeasted bread recipe
  undercounting total time by roughly an hour because its rise time had been silently absorbed
  into `cookMinutes`).
- Every ingredient: always has `amount`, `unit`, `name`, and `tags` (an empty array is fine;
  `undefined` is not). Free-text-only ingredients ("salt to taste") should still get an explicit
  `amount`/`unit` if at all reasonable (e.g. `"amount": "", "unit": "to taste"`) -- the rendering
  code tolerates a missing amount/unit gracefully, but a *complete* record is still better than
  relying on the fallback.
- Ingredient `tags`: drawn only from the canonical vocabulary --
  `dairy, gluten, nuts, shellfish, egg, soy, sesame, meat, pork, beef, fish`. Nothing else.
- Recipe-level `tags` (the free-text array, distinct from ingredient tags above): every recipe
  needs a real set, not just `[mealType]`. The 40 legacy `user-submitted` recipes averaged 1.1
  tags each (vs. 3.0-4.9 for every persona-authored batch) -- confirmed as the actual root cause
  behind the recipe browser's Help tab mood-tile combinations landing on zero results, not a UI
  bug. Aim for 4-6 tags per recipe, reusing the existing vocabulary where it fits (check
  `public/foodenvy-complete-recipes.json` for what's already common -- `weeknight`, `one-pan`,
  `make-ahead`, `vegetarian`, `quick`, `comfort-food`, `technique`, `weekend-project`, etc.)
  rather than inventing new terms per batch. Diet-adjacent tags (`vegetarian`, `vegan`,
  `gluten-free`) must actually match the ingredient list, not just the dish's reputation --
  these are descriptive/browsing tags, not the allergen-chip system, but a wrong one still
  misleads browsing.
- `id`: `recipe-<persona-slug>-<dish-slug>`, unique against every id already in
  `public/foodenvy-complete-recipes.json` **and** every other recipe written this run.
- `description`: written in the authoring persona's own voice (read their `docs/personas/*.yaml`
  file's `background`/`signature_move` before writing), 1-2 sentences, about this specific dish --
  not a generic template sentence reused across the batch.
- `adaptations[].instructions` (for `type: "swap"`, when `forRestriction` is a Big-9/medical-tier
  tag -- `dairy, gluten, nuts, shellfish, egg, soy, sesame` -- as opposed to a plain diet
  preference like `meat`/`pork`/`beef`): write it as an explicit, mandatory substitution, not a
  soft suggestion. Use negative-imperative phrasing -- "Do NOT use [the restricted ingredient];
  substitute [a specific, named product]" -- not "you could use..." or "swap in...". Per the
  gluten-free specialist's review: soft phrasing next to a celiac-safety instruction reads as an
  optional upgrade, and that reads very differently to someone actually managing the restriction
  than it does to someone just avoiding a food they don't love.

## Steps

### 1. Resolve the scope

Parse the request into a list of **generation units** -- each unit is one
`(persona, mealType, difficulty, count)` tuple:
- If a persona is named, use it. If "all personas" or unstated and the request is otherwise
  specific (a named dish, a single meal type), pick the 1-3 best-fitting personas from
  `docs/personas.md` the way `plan-meal` matches involvement level to a persona subset.
- If meal type/difficulty are unstated, ask rather than assume "all" -- a count times every meal
  type times every difficulty multiplies fast.
- If count is unstated, ask. Don't default to a large number silently.

**Guardrail:** if the resolved scope is more than ~10 generation units, tell the user the total
unit count and total recipe count (units x count) up front and confirm before running. Recommend
chaining multiple smaller invocations (e.g. one persona at a time) over one enormous run -- a
huge single batch is exactly as hard to review as the process this skill replaces.

### 2. Run one `Workflow` call, pipelined over the generation units

Each unit is independent (no barrier needed between units) and needs an author -> review ->
targeted-respin chain -- this is the Workflow tool's `pipeline()` shape. Construct and run a
script along these lines (adapt the persona list / scope to what step 1 resolved; this is a
skeleton, not literal code to paste unchanged):

```js
export const meta = {
  name: 'find-recipe-batch',
  description: 'Author and independently review recipe batches for the FoodEnvy library',
  phases: [{ title: 'Author' }, { title: 'Review' }, { title: 'Respin' }],
}

const RECIPE_SCHEMA = { /* JSON Schema: array of recipe objects matching the shape above */ }
const REVIEW_SCHEMA = { /* JSON Schema: { recipes: [...corrected/passed batch...], flagged: [{index, subIndex?, reason}] } */ }

const units = args.units // [{ persona, mealType, difficulty, count }, ...] resolved in step 1

const results = await pipeline(
  units,
  // 1. Author
  (unit) => agent(
    `You are authoring ${unit.count} complete ${unit.difficulty} ${unit.mealType} recipes for FoodEnvy's recipe library, in your own voice. ` +
    `Read your own persona file first. Every recipe needs every field from the schema (id, name, mealType, difficulty, prepMinutes, cookMinutes, restMinutes, description, persona, ingredients with amount/unit/name/tags, steps) -- restMinutes must be explicit 0 if there's no passive rise/rest/chill/marinate time, and must match what the steps text actually describes otherwise (never fold rest time into cookMinutes), ` +
    `plus an "adaptations" entry for every allergen/diet tag (dairy, gluten, nuts, shellfish, egg, soy, sesame, meat, pork, beef, fish) actually present among that recipe's own ingredients -- ` +
    `type "swap" with instructions text when a same-dish swap genuinely works, type "alternateRecipe" with a COMPLETE second recipe object (same full schema, not a stub) when the dish is structurally built around the restricted ingredient. ` +
    `Leave imageUrl "" and imageAttribution null -- do not attempt to source a photo yourself. Photo sourcing is a separate, deterministic follow-up step (see below), not an authoring-time task.`,
    { agentType: unit.persona, phase: 'Author', schema: RECIPE_SCHEMA, label: `author:${unit.persona}:${unit.mealType}:${unit.difficulty}` }
  ),
  // 2. Review -- a SEPARATE agent() call, fresh context, same persona id
  (batch, unit) => agent(
    `Independently review this batch of recipes you did not author. Check every recipe: ingredient tags only from the canonical vocabulary, plausible steps/times, correct mealType/difficulty, ` +
    `restMinutes matches what the steps text actually describes -- flag any recipe where the steps mention rise/rest/chill/marinate language but restMinutes is 0 or missing, or vice versa (restMinutes claiming rest time the steps never describe), ` +
    `and every "adaptations" entry actually resolves its stated restriction -- for type "alternateRecipe", check the embedded recipe field-by-field with the SAME rigor as a base recipe (incomplete = fail, not a pass with a caveat). ` +
    `Batch to review: ${JSON.stringify(batch)}`,
    { agentType: unit.persona, phase: 'Review', schema: REVIEW_SCHEMA, label: `review:${unit.persona}:${unit.mealType}:${unit.difficulty}` }
  ).then(review => ({ unit, batch, review }))
)

// 3. Targeted respin (only for units with flagged recipes, capped at one cycle) -- sequential,
//    outside the pipeline, since it's conditional per-unit rather than every unit needing it.
// 4. Assign fresh unique ids, write validated recipes into public/foodenvy-complete-recipes.json.
```

Photo sourcing is intentionally NOT part of the authoring step above (WebSearch/WebFetch asked a
judgment-task agent to positively confirm a license from page prose, competing against every
other authoring rule, for a step whose failure has zero consequence -- measured at 0% success
across earlier batches). After a batch is written, run the deterministic follow-up instead:

```bash
node scripts/backfill-recipe-images.js   # queries Openverse for recipes still missing imageUrl,
                                          # writes candidate matches to scripts/image-backfill-log.json
node scripts/merge-image-backfill.js     # applies a title-word sanity filter, merges the accepted
                                          # matches' imageUrl/imageAttribution into the live library
```

Both scripts already scope themselves to whatever recipes currently lack an `imageUrl`, so re-run
them as-is after any new batch -- no need to pass the new ids explicitly. `merge-image-backfill.js`
is a heuristic, not a guarantee of a correct match (see its file header) -- expect roughly 40-50%
of missing recipes to gain a real photo per run (dish, ingredient, or equipment tier combined);
the rest keep the honest gradient+emoji fallback. See the `photo-lookup` skill for the full
rationale behind how these scripts search (query-variant tricks, ranked ingredient/equipment
fallback tiers, the independent sanity filter) -- read it before changing either script.

Key mechanics to actually follow, not just structure:
- The **author** and **review** calls for a unit must be genuinely separate `agent()` invocations
  -- the review call gets *only* the finished batch JSON, never the authoring prompt or
  rationale. This is what makes it an independent check rather than self-review; it falls out
  naturally from `agent()` calls being stateless/isolated, but don't accidentally undermine it by
  pasting the authoring prompt into the review prompt "for context."
- Respin: if a unit's review returns any `flagged` entries, one more `agent()` call to the same
  persona with just the flagged recipes + reasons (not the whole batch), then one more fresh
  review call on just the corrected subset. Cap at one cycle. Anything still flagged after that:
  **exclude from the write, keep the reason** -- report it, don't drop it silently and don't
  include it anyway.
- Assign ids and write the file **after** the workflow returns, in the main session (not inside
  an `agent()` call) -- reading the current `public/foodenvy-complete-recipes.json`, checking id
  collisions across everything written this run, appending, and writing back is plain file I/O,
  not something to delegate to a subagent.

### 3. Non-negotiable: never commit

This skill **never runs `git commit`, `git push`, or any git write command**, under any
circumstance, no matter how clean a run looks. It writes the JSON file and stops. Committing is
always a separate, explicit, user-requested step -- afterward, in a normal turn, not as part of
this skill. (This rule exists because a subagent commited unreviewed changes to this repo without
approval earlier in this project's history -- don't repeat that with bulk recipe data.)

### 4. Present the results

A chat summary, not a full dump of every recipe: per generation unit, how many were generated /
written / skipped (skipped ones named, with the flagged reason), how many got a real photo vs.
the gradient/emoji fallback, and 2-3 full sample recipes (including at least one with an
`alternateRecipe` adaptation, if any exist in the batch) so the user can spot-check quality before
requesting the next batch.

## Notes

- Don't default to "all personas x all meal types x all difficulties" for an unscoped request --
  ask. A silently enormous run is unreviewable and directly repeats the mistake this skill exists
  to fix.
- `adaptations` is generic (keyed by restriction tag), not scoped to a specific family member --
  this is library data meant to work for whoever ends up with the recipe later, unlike
  `plan-meal`'s member-scoped `memberForks` for one specific week's plan.
- If a recipe has no allergen/diet-relevant ingredient tags at all, `adaptations` is legitimately
  an empty array -- don't invent restrictions that don't apply.
- Ignore the root-level `foodenvy-complete-recipes.json` and `consolidate-all-recipes.js` entirely
  -- both are stale/unused; `public/foodenvy-complete-recipes.json` is the only file that matters.

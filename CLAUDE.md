# CLAUDE.md

## Project goal

Help a family with mixed dietary needs (allergies, diets, dislikes) go from "what's in the recipe
library" to "what should we eat tonight / this week." Local-first browser app, no backend, no
build step required to run it — just static files.

## What's in this repo

**The app is a single self-contained HTML file, not a component framework.** `index.html` (and
its byte-for-byte duplicate `recipe-browser.html`, kept in sync manually — see "Working
conventions") is one file of inline HTML/CSS/vanilla JS, a few thousand lines, that fetches
`public/foodenvy-complete-recipes.json` at runtime and renders everything client-side. There is no
`src/` directory, no React, no IndexedDB, and no build step in the sense of bundling — this
replaced an earlier Vite+React+IndexedDB prototype (see "History" below).

- **Profiles** (`profiles`/`saveProfile`/`toggleDislike` etc., all inline in `index.html`) — each
  family member has a `restrictions` array of `{ category: 'allergy'|'restriction'|'diet'|'dislike', value, severity: 'strict'|'soft' }`.
  `allergy` comes from the FDA Big 9 (`BIG9_ALLERGENS`), `restriction` from a small
  medical/ethical list (`MEDICAL_RESTRICTIONS` — Gluten-Free, Lactose Intolerance, Dairy-Free),
  `diet` from one-tap presets (`DIET_PREFERENCES` — vegetarian/vegan/pescatarian, each expanding
  to the ingredient tags that diet actually excludes), and `dislike` from a categorized
  "tap what you don't like" checklist (`COMMON_FOODS`). `allergy`/`restriction`/`diet` store a
  **tag** from the shared vocabulary (`dairy, gluten, nuts, shellfish, egg, soy, sesame, meat,
  pork, beef, fish`) and are `severity: 'strict'`; `dislike` stores a **food name** (e.g.
  `"Shrimp"`) verbatim from the checklist and is `severity: 'soft'` — these two need different
  matching logic (tag intersection vs. name-in-ingredient-name substring match), see below.
- **Matching** (`getConflictingRestrictions`, `getProfileAdaptationStatus`,
  `getDislikedIngredients`, `getDislikeStatus`) — `getConflictingRestrictions` does the tag
  intersection for `allergy`/`restriction`/`diet` against a recipe's `ingredients[].tags`.
  `getProfileAdaptationStatus` splits those conflicts into resolved (the recipe's own
  `adaptations` array has a matching `forRestriction` entry that's itself safe for that profile)
  vs. unresolved — only unresolved conflicts exclude a recipe from "By Profile" filtering; a
  resolved one stays visible with an amber "not safe as written, alternate available" badge
  (`adaptationHighlight` in `renderRecipes`) instead of just disappearing. `getDislikedIngredients`/
  `getDislikeStatus` are a **separate, parallel path** for the soft `dislike` category — a
  disliked ingredient never excludes a recipe, only adds a muted (non-amber) badge and sorts the
  recipe toward the bottom of results (`filterRecipes`'s post-filter stable sort). Keeping dislikes
  on their own function/data path (never folded into `getProfileAdaptationStatus`) is deliberate:
  a soft preference must never be mistakable for, or silently satisfy, a strict safety conflict.
- **A recipe's `adaptations` array** carries `{ forRestriction: <tag>, type: 'swap'|'alternateRecipe', ... }`
  entries — `swap` is same-dish (instructions for substituting one ingredient), `alternateRecipe`
  is a wholly different dish embedded inline. Both render in the recipe detail view
  (`openRecipeDetail`) with the alternate(s) shown *before* the original and an explicit "not safe
  as written" banner — an allergy-safety review finding was that showing the unsafe original first
  risks a rushed parent grabbing the wrong one.
- **Plan My Week** (`generateWeekPlan`, `renderWeekPlan`, `renderPlanSlot`, `openSwapModal`) — an
  auto-generated 7-day × 3-meal grid stored in `localStorage` (`foodenvy_weekplan`), not a
  file-based import/export flow. `generateWeekPlan` picks from each slot's eligible pool
  (`getEligibleRecipesForSlot`, same eligibility predicate as Search/Help), preferring unused
  recipes, with three soft (never-excluding) scoring signals in priority order: plant-forward
  variety, protein-tag repetition, then disliked-ingredient count (lowest weight — see
  `scoreDinnerCandidate`). Per-slot safety warnings (`renderPlanSlot`) evaluate against the
  **live** "who's eating" checkbox selection, not the plan's frozen `profileIds` snapshot — that
  snapshot is reserved for the "Planned for: X" pill and drift indicator only. "Change &
  regenerate" is the one explicit, deliberate action that actually reshuffles which recipes are
  chosen; everything else about the grid reacts live to the current member selection.
- `public/foodenvy-complete-recipes.json` — the full recipe library the app fetches at runtime
  (hundreds of recipes, each persona-authored — see `find-recipe` skill). `public/favicon.svg` is
  the other runtime asset. `index.html` fetches it as `./foodenvy-complete-recipes.json` — relative
  to wherever `index.html` is served from, not to `public/` — so it only resolves correctly after
  `npm run build` flattens both into `dist/` together (see README.md for running it locally).
- `scripts/` — Node-based offline tooling that *produces* `foodenvy-complete-recipes.json`
  (`consolidate-recipes.js`, `backfill-recipe-images.js`, `run-manual-queries.js`, etc.). Not run
  by the app itself, not part of the build.
- `vite.config.js` — kept only for its custom `copy-static-files` plugin: `npm run build` doesn't
  bundle anything, it just copies `index.html` + the two `public/` assets into `dist/` verbatim for
  GitHub Pages. `package.json`'s `react`/`react-dom` runtime dependencies are still an unused
  leftover from the pre-pivot app (harmless but misleading — a cleanup candidate, not fixed yet);
  the ESLint React plugins that went with them have been removed (see "Testing/linting" below).
- `docs/personas.md` — index into `docs/personas/` (18 YAML files, citation-backed) covering home cooks, meal-kit-savvy cooks, nutritionists, dietary specialists, meal-prep chefs, and two technical personas (Gamification Designer, Web App Engineer). Every persona is also an invokable subagent under `.claude/agents/` (plus two "team lead" agents, `food-prep-lead`/`app-update-lead`, for a quick question that doesn't need a full skill run). See "Persona/skill architecture" below.

## History

The app started as a Vite+React+IndexedDB prototype (family profiles, inventory, a matcher engine
under `src/`). Commit `f6e3de4` ("Focus: Make recipe browser the foundation") pivoted to the
current single-file `index.html`/`recipe-browser.html` architecture and deleted `src/` entirely;
every commit since has built on the single-file app. The `plan-meal` skill originally described a
file-based `foodEnvyPlanRequest`/`foodEnvyPlanExport` hand-off with the deleted `src/domain/`
paths — it's since been refreshed to match the current app (no profile export exists, so it asks
the user directly; reads `public/foodenvy-complete-recipes.json`; presents the plan in chat since
there's no import feature to write a file for).

## Persona/skill architecture

FoodEnvy's persona system mirrors a proven pattern from a sibling repo in this account
(`Sightline/.claude/`): each persona is a citation-backed YAML file (`docs/personas/`) *and* a thin
invokable Claude Code subagent (`.claude/agents/<id>.md`, pointing back to its YAML). Two skills
make them actually collaborate rather than just sit as reference docs:

- **`plan-meal`** (`.claude/skills/plan-meal/`) — the cook/nutrition personas review a family's
  restrictions (described directly by the user — there's no profile export to read) together and
  produce a week's meal plan presented in chat (fusion ideas welcome), gated by clarifying
  questions (who, which meals, target prep+cook time, how involved). A richer, creative complement
  to the app's own auto-generated Plan My Week grid (`generateWeekPlan`/`renderWeekPlan` in
  `index.html`), not a replacement for it — there's no file hand-off between the two.
- **`update-app`** (`.claude/skills/update-app/`) — for changing FoodEnvy itself: the two
  technical personas draft an approach, the relevant cook/nutrition personas are consulted (does
  this show food data accurately / showcase meals well), the group reconciles to consensus, and
  the result is presented as a Plan (`EnterPlanMode`/`ExitPlanMode`) for approval *before* any
  code changes — this is a hard requirement, not a suggestion.

`food-prep-lead` and `app-update-lead` are lighter-weight entry points for a single ad-hoc
question that doesn't warrant the full skill flow — they route to 1-4 relevant personas and
synthesize an answer, but deliberately have no Edit/Write/Bash access, so they can't be used to
sneak in a real change outside `update-app`'s approval gate.

## Working conventions established so far

- Everything lives in `index.html`'s inline `<script>` — no modules, no imports. Global functions
  and `let`-declared state at the top level are how different parts of the app talk to each other
  (e.g. `activeTab`, `profiles`, `allRecipes`, `weekPlan`).
- All persistent state is `localStorage` (`foodenvy_profiles`, `foodenvy_weekplan`,
  `foodenvy_collections` — favorites live inside a collection, not their own key —
  `foodenvy_filters`, `foodenvy_shopping_list_checked`, etc.) — no IndexedDB, no backend. Any
  change to a stored shape must keep old saved data working (read old shapes tolerantly, or
  version + migrate on load) — never reset a user's saved profiles/plans/favorites as a side
  effect of a change.
- `index.html` and `recipe-browser.html` must be kept byte-identical — there is no templating or
  build step that generates one from the other, so every change gets applied to both files
  (`cp index.html recipe-browser.html` after editing, then diff to confirm).
- Restriction model: `{ category: 'allergy'|'restriction'|'diet'|'dislike', value, severity: 'strict'|'soft' }` — see "What's in this repo" above for the tag-vs-name distinction between the strict and soft categories.
- Ingredient-name matching (both `getDislikedIngredients`'s dislike check and the shopping list's
  ingredient de-duping) is deliberately simple — case-insensitive substring/normalization, not
  fuzzy/NLP matching. Good enough given ingredient names are hand-authored, but a known rough edge
  worth watching if naming gets inconsistent.
- No router: tab switching (`switchTab`) is plain global state (`activeTab`), matching the "keep
  it simple for a local app" scope — revisit only if deep-linking to a tab becomes a real need.
- **Testing/linting**: `index.test.js` loads the real `index.html` into `jsdom`
  (`JSDOM.fromFile`, `runScripts: 'dangerously'`) and calls its global matching/plan-generation
  functions directly (`getConflictingRestrictions`, `getProfileAdaptationStatus`,
  `getDislikedIngredients`/`getDislikeStatus`, `generateWeekPlan`) — real coverage over the
  actual shipped file, not a parallel reimplementation, with no changes to how the app itself is
  built (still no modules, no bundler). Top-level `let` state (`profiles`, `allRecipes`) isn't a
  `window` property in a classic script, so tests seed fixtures via `window.eval(...)`, which
  shares the same global lexical environment. Only exercises `index.html` — `recipe-browser.html`
  is assumed to stay in sync (see the byte-identical-duplicate convention above). `npm run lint`
  now actually lints both HTML files' inline scripts (`eslint-plugin-html`) instead of a dead
  `src/**/*.{js,jsx}` glob that matched nothing; `no-unused-vars` is off for them specifically,
  since nearly every top-level function is only ever called from an inline `onclick="..."`
  attribute, which is invisible to static analysis.

## Next likely steps

- A stronger treatment for a near-complete category dislike (e.g. every item under "Fish &
  seafood" checked) — right now it gets the same muted flag-and-sort treatment as a single
  disliked item, but arguably should read more like "this household doesn't eat this category."
  Flagged during the dislike-matching review, deliberately deferred as a separate product decision.
- Numeric enforcement of nutrition targets (e.g. calorie/macro goals) once recipes carry nutrition
  data — would also let the week-level protein-repeat/plant-forward signals grow into a real
  plate-method balance check (Dr. Amara Chen's original ask).
- Plan My Week only keeps one active plan (`foodenvy_weekplan`, singular) — multiple saved/named
  plans is a reasonable follow-up once the single-plan flow is proven out.
- Eventual Android wrap (e.g. Capacitor) once the web app is solid.

# CLAUDE.md

## Project goal

Help a family with mixed dietary needs (allergies, diets, dislikes) go from "what do we have" to "what should we eat tonight / what should we buy." Local-first browser app for now (Vite + React + IndexedDB, no backend), with an eye toward an eventual Android port — the storage and stack choices were made specifically so a future Capacitor wrap wouldn't require a rewrite.

## What's in this repo

- `src/db/database.js` — generic promise-wrapped IndexedDB helpers (`getAll`/`get`/`put`/`remove`/`count`) over one database with four object stores: `members`, `inventory`, `recipes`, `plannedWeeks`. Domain-specific CRUD (`profiles.js`, `inventory.js`, `recipes.js`, `plannedWeeks.js`) sits on top of this.
- `src/domain/planImport.js` — validates a `foodEnvyPlanExport` JSON (produced by the `plan-meal` skill) before it's saved. `src/db/plannedWeeks.js` owns the plan lifecycle: `swapMealSlot` (pick a different-dish `alternate`, re-evaluates it against current members/inventory), `applyMemberFork` (mark a same-dish adaptation applied for one member — a distinct mechanism from swap, see below), and `revalidatePlan` (re-check every slot's eligibility against the *current* stored profiles/inventory, since a plan is a snapshot but restrictions/inventory aren't — called on every render of the Weekly Plan tab, not just after a swap).
- `src/components/plan/PlanRequestPanel.jsx` / `WeeklyPlanView.jsx` — the Weekly Plan tab. Empty state bundles selected members + inventory + a few chip-picked preferences into a `foodEnvyPlanRequest` export for the `plan-meal` skill to consume, with plain-language instructions (the skill runs in Claude Code, not the browser — this is a deliberate, narrated hand-off, not a hidden feature). Once a plan is imported, renders per-day slot cards with two **distinct** adaptation mechanisms: "Swap this meal" (pick a different-dish `alternate`) vs. "Adapt for {name}" (apply a same-dish `memberFork`, e.g. a gluten-free starch swap) — conflating these was an explicit finding from the persona review that shaped this design (see `docs/personas/dietary-specialists/sofia-marsh-gluten-free.yaml`'s notes).
- `src/domain/tags.js` — the canonical allergen/diet tag vocabulary (`dairy, gluten, nuts, shellfish, egg, soy, sesame, meat, pork, beef, fish`), plus `BIG9_ALLERGENS` (the FDA's Big 9, mapped to these tags) used to drive the allergy step of the profile wizard. Both `FamilyMember.restrictions` and `Recipe.ingredients[].tags` reference this vocabulary so matching is a simple tag intersection, not free-text guessing.
- `src/domain/dietPresets.js` — one-tap diet-type shortcuts (Vegetarian/Vegan/Pescatarian/Gluten-Free/Dairy-Free) that expand to the strict `diet` restrictions matching what each dietary specialist persona (see `docs/personas.md`) would actually require — e.g. vegan excludes dairy and egg, not just meat/fish. "Other" is deliberately free-text-only (keto/paleo/halal/kosher/etc. aren't cleanly modeled by ingredient-tag exclusion, so it's saved for reference rather than half-enforced). Tested in `dietPresets.test.js`.
- `src/domain/commonFoods.js` — the `COMMON_FOOD_CHECKLIST` behind the wizard's Dislikes step: a curated, categorized "tap what you don't like" list, not a reproduction of any clinical picky-eating instrument (none of the real ones -- CEBQ, Food Neophobia Scale, STEP/BPFAS -- use a named-food checklist; they're Likert-style behavior questions). Deliberately broad (~100 items across 9 categories, including full fish/seafood and meat variety) rather than minimal -- a family's profile gets reused for every future suggestion, so completeness matters more than trimming for speed; the tap-only interaction is what keeps it fast despite the size.
- `src/domain/matcher.js` — the suggestion engine. Pure functions, no I/O: `suggestMeals(members, inventory, recipes)` returns `{ ready, almost }`; `buildShoppingList` de-dupes missing ingredients across chosen "almost" recipes (single-recipe use, e.g. `MealSuggestions.jsx`). `evaluateRecipeForSlot` composes the eligibility/missing-ingredient checks for one recipe against current members/inventory (used by the plan swap/revalidate logic). `buildUsageTrackedShoppingList` is the weekly-plan version of the shopping list — it tracks which slot(s) need each item (`usedBy`) so a swap can show its ripple effect instead of silently rewriting a flat list. `computeProteinTally`/`describeRepeats` give a cheap week-level repetition warning (e.g. "meat appears in 3 meals this week") — not real nutrition analysis, since recipes carry no macro data, just a signal that survives a swap. This is the one module worth keeping well-tested (`matcher.test.js`).
- `src/domain/seedRecipes.json` — ~16 starter recipes loaded into the `recipes` store on first run only (`seedRecipesIfEmpty`, in `db/recipes.js`) — never overwrites once the store is non-empty.
- `src/components/profiles/ProfileWizard.jsx` — the multi-step profile survey (Name → Allergies → Diet → Dislikes → Goals → Review) that replaced the old flat `ProfileForm`. Editing an existing member opens pre-filled straight to Review. Produces the same `restrictions` shape the matcher already expects, so nothing downstream needed to change.
- `src/components/profiles/ProfileList.jsx` and `src/components/inventory/InventoryList.jsx` — both own Export/Import (buttons + `src/lib/jsonFile.js`'s shared `downloadJson`/`readJsonFile` helpers): export as a timestamped JSON file (client-side `Blob` download, no server), import back in with fresh ids per record (so importing on a different device never silently collides with/overwrites an existing member or item).
- `src/components/inventory/CameraCapture.jsx` — the vision-tech seam. Currently just attaches a photo (as a data URL) to an inventory item; does not run recognition. If/when real image recognition is added, this is the component to change — the rest of the inventory form should keep working with manual entry as a fallback.
- `docs/personas.md` — index into `docs/personas/` (18 YAML files, citation-backed) covering home cooks, meal-kit-savvy cooks, nutritionists, dietary specialists, meal-prep chefs, and two technical personas (Gamification Designer, Web App Engineer). Every persona is also an invokable subagent under `.claude/agents/` (plus two "team lead" agents, `food-prep-lead`/`app-update-lead`, for a quick question that doesn't need a full skill run). See "Persona/skill architecture" below.

## Persona/skill architecture

FoodEnvy's persona system mirrors a proven pattern from a sibling repo in this account
(`Sightline/.claude/`): each persona is a citation-backed YAML file (`docs/personas/`) *and* a thin
invokable Claude Code subagent (`.claude/agents/<id>.md`, pointing back to its YAML). Two skills
make them actually collaborate rather than just sit as reference docs:

- **`plan-meal`** (`.claude/skills/plan-meal/`) — the cook/nutrition personas review a family's
  profiles + current inventory together and produce a week's meal plan (fusion ideas welcome),
  gated by clarifying questions (who, which meals, target prep+cook time, how involved). Reads a
  `foodEnvyPlanRequest` export (or profile/inventory exports) plus `seedRecipes.json`, and writes
  both a chat presentation *and* a `foodEnvyPlanExport` JSON file the app's Weekly Plan tab can
  import (see `src/domain/planImport.js`). A generated recipe never gets written into
  `seedRecipes.json` — that file is shared seed data for every install, not one family's week.
  Each slot carries `alternates` (different dishes) and `memberForks` (same-dish adaptations) as
  two distinct things, not one blended list — see the persona-review finding below.
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

- Repo conventions were deliberately mirrored from sibling projects in this GitHub account (`Sightline`, `CardNight`): flat ESLint config (`@eslint/js` + `globals`, not `oxlint` — the vite scaffold's default was swapped out), `vitest` for tests, `vite.config.js` with `base: './'` for GitHub Pages, and a `.github/workflows/{test.yml,deploy.yml}` pair (test on every push/PR, build+deploy `dist/` to Pages on push to `main`).
- Restriction model: `{ category: 'allergy'|'diet'|'dislike'|'goal', value, severity: 'strict'|'soft' }`. Only `strict` `allergy`/`diet` restrictions exclude a recipe outright (checked via ingredient tags); `dislike` restrictions only ever lower a recipe's rank (`dislikeScore`), never exclude it. `goal` is currently just a stored free-text note — not enforced by the matcher yet.
- Ingredient-to-inventory matching in `matcher.js` is deliberately simple (case-insensitive, naive plural stripping) rather than fuzzy/NLP matching — good enough given inventory is hand-entered, but a known rough edge worth watching if inventory naming gets inconsistent.
- No router: tab switching in `App.jsx` is plain component state (`activeTab`), matching the "keep it simple for a local app" scope — revisit only if deep-linking to a tab becomes a real need.

## Next likely steps

- Real vision/OCR integration in `CameraCapture.jsx` to auto-populate inventory items from a photo (the seam is isolated there on purpose).
- Numeric enforcement of `goal` restrictions (e.g. calorie/macro targets) once recipes carry nutrition data — would also let `computeProteinTally`'s repetition warning grow into a real plate-method balance check (Dr. Amara Chen's original ask).
- Swipe/photo-card food preference discovery (researched, deliberately deferred -- needs food photography assets we don't have) and QR-code profile transfer (also researched, deliberately deferred -- file export/import already covers the no-backend save/reload need without the added complexity).
- Export/import for recipes too, following the same pattern already built for profiles/inventory/plans.
- The Weekly Plan tab only keeps the most recently imported plan (`activePlan`, singular) — multiple saved/named plans, and a persisted (not just in-component-state) checked state for shopping-list items, are both reasonable follow-ups once the single-plan flow is proven out.
- A live LLM call from the running browser app was explicitly considered and rejected (would require a backend/secret in a static bundle, breaking the local-first constraint) — the Claude-Code-session boundary for `plan-meal`/`update-app` is a permanent design feature, not a gap to close.
- Eventual Android wrap (e.g. Capacitor) once the web app is solid.

# CLAUDE.md

## Project goal

Help a family with mixed dietary needs (allergies, diets, dislikes) go from "what do we have" to "what should we eat tonight / what should we buy." Local-first browser app for now (Vite + React + IndexedDB, no backend), with an eye toward an eventual Android port — the storage and stack choices were made specifically so a future Capacitor wrap wouldn't require a rewrite.

## What's in this repo

- `src/db/database.js` — generic promise-wrapped IndexedDB helpers (`getAll`/`get`/`put`/`remove`/`count`) over one database with three object stores: `members`, `inventory`, `recipes`. Domain-specific CRUD (`profiles.js`, `inventory.js`, `recipes.js`) sits on top of this.
- `src/domain/tags.js` — the canonical allergen/diet tag vocabulary (`dairy, gluten, nuts, shellfish, egg, soy, sesame, meat, pork, beef, fish`), plus `BIG9_ALLERGENS` (the FDA's Big 9, mapped to these tags) used to drive the allergy step of the profile wizard. Both `FamilyMember.restrictions` and `Recipe.ingredients[].tags` reference this vocabulary so matching is a simple tag intersection, not free-text guessing.
- `src/domain/dietPresets.js` — one-tap diet-type shortcuts (Vegetarian/Vegan/Pescatarian/Gluten-Free/Dairy-Free) that expand to the strict `diet` restrictions matching what each dietary specialist persona (see `docs/personas.md`) would actually require — e.g. vegan excludes dairy and egg, not just meat/fish. "Other" is deliberately free-text-only (keto/paleo/halal/kosher/etc. aren't cleanly modeled by ingredient-tag exclusion, so it's saved for reference rather than half-enforced). Tested in `dietPresets.test.js`.
- `src/domain/commonFoods.js` — the `COMMON_FOOD_CHECKLIST` behind the wizard's Dislikes step: a curated, categorized "tap what you don't like" list, not a reproduction of any clinical picky-eating instrument (none of the real ones -- CEBQ, Food Neophobia Scale, STEP/BPFAS -- use a named-food checklist; they're Likert-style behavior questions). Deliberately broad (~100 items across 9 categories, including full fish/seafood and meat variety) rather than minimal -- a family's profile gets reused for every future suggestion, so completeness matters more than trimming for speed; the tap-only interaction is what keeps it fast despite the size.
- `src/domain/matcher.js` — the suggestion engine. Pure functions, no I/O: `suggestMeals(members, inventory, recipes)` returns `{ ready, almost }`; `buildShoppingList` de-dupes missing ingredients across chosen "almost" recipes. This is the one piece of logic worth keeping well-tested (`matcher.test.js`).
- `src/domain/seedRecipes.json` — ~16 starter recipes loaded into the `recipes` store on first run only (`seedRecipesIfEmpty`, in `db/recipes.js`) — never overwrites once the store is non-empty.
- `src/components/profiles/ProfileWizard.jsx` — the multi-step profile survey (Name → Allergies → Diet → Dislikes → Goals → Review) that replaced the old flat `ProfileForm`. Editing an existing member opens pre-filled straight to Review. Produces the same `restrictions` shape the matcher already expects, so nothing downstream needed to change.
- `src/components/profiles/ProfileList.jsx` — also owns Export/Import: exports all members as a timestamped JSON file (client-side `Blob` download, no server), imports one back in with fresh ids per member (so importing on a different device never silently collides with/overwrites an existing member).
- `src/components/inventory/CameraCapture.jsx` — the vision-tech seam. Currently just attaches a photo (as a data URL) to an inventory item; does not run recognition. If/when real image recognition is added, this is the component to change — the rest of the inventory form should keep working with manual entry as a fallback.
- `docs/personas.md` — the expert-persona reference library (home cooks, meal-kit-savvy cooks, nutritionists, dietary specialists, meal-prep chefs) that should ground future recipe content/tone and nutrition-rule decisions. Not runtime code — a style/expertise reference, though the diet-specialist personas map directly onto `dietPresets.js`.

## Working conventions established so far

- Repo conventions were deliberately mirrored from sibling projects in this GitHub account (`Sightline`, `CardNight`): flat ESLint config (`@eslint/js` + `globals`, not `oxlint` — the vite scaffold's default was swapped out), `vitest` for tests, `vite.config.js` with `base: './'` for GitHub Pages, and a `.github/workflows/{test.yml,deploy.yml}` pair (test on every push/PR, build+deploy `dist/` to Pages on push to `main`).
- Restriction model: `{ category: 'allergy'|'diet'|'dislike'|'goal', value, severity: 'strict'|'soft' }`. Only `strict` `allergy`/`diet` restrictions exclude a recipe outright (checked via ingredient tags); `dislike` restrictions only ever lower a recipe's rank (`dislikeScore`), never exclude it. `goal` is currently just a stored free-text note — not enforced by the matcher yet.
- Ingredient-to-inventory matching in `matcher.js` is deliberately simple (case-insensitive, naive plural stripping) rather than fuzzy/NLP matching — good enough given inventory is hand-entered, but a known rough edge worth watching if inventory naming gets inconsistent.
- No router: tab switching in `App.jsx` is plain component state (`activeTab`), matching the "keep it simple for a local app" scope — revisit only if deep-linking to a tab becomes a real need.

## Next likely steps

- Real vision/OCR integration in `CameraCapture.jsx` to auto-populate inventory items from a photo (the seam is isolated there on purpose).
- Numeric enforcement of `goal` restrictions (e.g. calorie/macro targets) once recipes carry nutrition data.
- Swipe/photo-card food preference discovery (researched, deliberately deferred -- needs food photography assets we don't have) and QR-code profile transfer (also researched, deliberately deferred -- file export/import already covers the no-backend save/reload need without the added complexity).
- Export/import for inventory/recipes too, following the same pattern already built for profiles (`ProfileList.jsx`).
- Eventual Android wrap (e.g. Capacitor) once the web app is solid.

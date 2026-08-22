# CLAUDE.md

## Project goal

Help a family with mixed dietary needs (allergies, diets, dislikes) go from "what do we have" to "what should we eat tonight / what should we buy." Local-first browser app for now (Vite + React + IndexedDB, no backend), with an eye toward an eventual Android port — the storage and stack choices were made specifically so a future Capacitor wrap wouldn't require a rewrite.

## What's in this repo

- `src/db/database.js` — generic promise-wrapped IndexedDB helpers (`getAll`/`get`/`put`/`remove`/`count`) over one database with three object stores: `members`, `inventory`, `recipes`. Domain-specific CRUD (`profiles.js`, `inventory.js`, `recipes.js`) sits on top of this.
- `src/domain/tags.js` — the canonical allergen/diet tag vocabulary (`dairy, gluten, nuts, shellfish, egg, soy, meat, pork, beef, fish`). Both `FamilyMember.restrictions` and `Recipe.ingredients[].tags` reference these so matching is a simple tag intersection, not free-text guessing.
- `src/domain/matcher.js` — the suggestion engine. Pure functions, no I/O: `suggestMeals(members, inventory, recipes)` returns `{ ready, almost }`; `buildShoppingList` de-dupes missing ingredients across chosen "almost" recipes. This is the one piece of logic worth keeping well-tested (`matcher.test.js`).
- `src/domain/seedRecipes.json` — ~16 starter recipes loaded into the `recipes` store on first run only (`seedRecipesIfEmpty`, in `db/recipes.js`) — never overwrites once the store is non-empty.
- `src/components/inventory/CameraCapture.jsx` — the vision-tech seam. Currently just attaches a photo (as a data URL) to an inventory item; does not run recognition. If/when real image recognition is added, this is the component to change — the rest of the inventory form should keep working with manual entry as a fallback.

## Working conventions established so far

- Repo conventions were deliberately mirrored from sibling projects in this GitHub account (`Sightline`, `CardNight`): flat ESLint config (`@eslint/js` + `globals`, not `oxlint` — the vite scaffold's default was swapped out), `vitest` for tests, `vite.config.js` with `base: './'` for GitHub Pages, and a `.github/workflows/{test.yml,deploy.yml}` pair (test on every push/PR, build+deploy `dist/` to Pages on push to `main`).
- Restriction model: `{ category: 'allergy'|'diet'|'dislike'|'goal', value, severity: 'strict'|'soft' }`. Only `strict` `allergy`/`diet` restrictions exclude a recipe outright (checked via ingredient tags); `dislike` restrictions only ever lower a recipe's rank (`dislikeScore`), never exclude it. `goal` is currently just a stored free-text note — not enforced by the matcher yet.
- Ingredient-to-inventory matching in `matcher.js` is deliberately simple (case-insensitive, naive plural stripping) rather than fuzzy/NLP matching — good enough given inventory is hand-entered, but a known rough edge worth watching if inventory naming gets inconsistent.
- No router: tab switching in `App.jsx` is plain component state (`activeTab`), matching the "keep it simple for a local app" scope — revisit only if deep-linking to a tab becomes a real need.

## Next likely steps

- Real vision/OCR integration in `CameraCapture.jsx` to auto-populate inventory items from a photo (the seam is isolated there on purpose).
- Numeric enforcement of `goal` restrictions (e.g. calorie/macro targets) once recipes carry nutrition data.
- Export/import or sync for profiles/inventory/recipes, since IndexedDB is per-browser/per-device only.
- Eventual Android wrap (e.g. Capacitor) once the web app is solid.

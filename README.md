# FoodEnvy

A local-first meal planner for a family with different diets, allergies, and preferences: set up who eats what, track what's currently in the kitchen, and get meal suggestions built from what's on hand — plus a shopping list for the ones that are almost ready.

## The idea

1. **Profiles** — each family member gets a set of restrictions and preferences (strict allergies, diets, dislikes, goals) tagged against a shared vocabulary (dairy, gluten, nuts, shellfish, egg, soy, meat, pork, beef, fish) so recipes can be checked against them automatically.
2. **Inventory** — what's currently in the pantry/fridge, added by hand for now. A photo can be attached to an item via the camera capture button, but recognition isn't wired up yet — that's a clean seam to plug a vision API into later.
3. **Meal Ideas** — recipes (a small seed set to start, plus anything you add) are matched against the selected family members' restrictions and the current inventory, split into "Ready to make now" and "Almost there" (with a shopping list built from what's missing).

## Stack

Vite + React, no backend — everything is stored in the browser via IndexedDB. Chosen so the same codebase can later be wrapped for Android (e.g. via Capacitor) without a rewrite.

## Local development

```
npm install
npm run dev      # start the dev server
npm run lint      # eslint
npm test          # vitest
npm run build     # production build to dist/
```

## Repo layout

- `src/db/` — thin IndexedDB wrapper (`database.js`) plus CRUD for each domain concept (`profiles.js`, `inventory.js`, `recipes.js`).
- `src/domain/` — pure logic: the shared allergen/diet tag vocabulary (`tags.js`) and the suggestion engine (`matcher.js`, tested in `matcher.test.js`). `seedRecipes.json` is the starter recipe set loaded on first run.
- `src/components/` — UI, split by area: `profiles/`, `inventory/`, `meals/`, plus the shared `TabNav`.

# FoodEnvy

A recipe browser for a family with different diets, allergies, and preferences: set up who eats
what, then browse, search, and auto-plan a week of meals checked against everyone's restrictions.

## The idea

1. **Profiles** — each family member gets allergies (FDA Big 9), medical/ethical restrictions
   (e.g. gluten-free), a diet preset (vegetarian/vegan/pescatarian), and dislikes (a tap-to-select
   checklist), tagged against a shared vocabulary (dairy, gluten, nuts, shellfish, egg, soy, meat,
   pork, beef, fish) so recipes can be checked against them automatically.
2. **Search / Help** — browse or filter the recipe library by profile, meal type, difficulty,
   collection, favorites, or (on Help) tag tiles / time available / a craving search. A recipe
   that strictly conflicts with a checked profile is hidden unless it has a safe adaptation (shown
   with an amber "not safe as written, alternate available" flag); a disliked ingredient never
   hides a recipe, just flags it and sorts it lower.
3. **Plan my week** — auto-generates a 7-day breakfast/lunch/dinner grid from the eligible recipe
   pool for whoever's checked as "eating," with swap/remove per slot and a consolidated shopping
   list. Per-slot safety warnings track the current "who's eating" selection live.

There is no pantry/inventory tracking in the current app.

## Stack

A single static HTML file — no backend, no framework, no build-time bundling. All data
(profiles, favorites, collections, the current week's plan) is stored in the browser via
`localStorage`.

## Local development

The app is `index.html` (and its duplicate, `recipe-browser.html`) plus
`public/foodenvy-complete-recipes.json` and `public/favicon.svg`, fetched at runtime as
`./foodenvy-complete-recipes.json` — a path relative to wherever `index.html` itself is served
from, **not** `public/`. Opening `index.html` directly as a `file://` URL won't work either
(`fetch` needs an HTTP origin). Easiest correct way to run it locally:

```
npm install
npm run build     # copies index.html + public/ assets into dist/, flattened, for GitHub Pages
npx serve dist    # or: python -m http.server 8000 --directory dist
```

then open the server's URL. (Serving the repo root directly instead of `dist/` will 404 on the
recipes JSON, since it lives under `public/` there, not next to `index.html`.)

```
npm run lint      # lints index.html/recipe-browser.html's inline scripts (eslint-plugin-html)
npm test          # loads index.html into jsdom and tests its matching/plan-generation logic
```

## Repo layout

- `index.html` / `recipe-browser.html` — the app itself, kept byte-identical; every change must be
  applied to both.
- `public/foodenvy-complete-recipes.json` — the recipe library the app fetches at runtime.
  `public/favicon.svg` is the other runtime asset.
- `scripts/` — offline Node tooling used to author/consolidate/backfill the recipe library JSON
  above. Not run by the app itself.
- `docs/personas/` — citation-backed persona files (cooks, nutritionists, dietary specialists,
  two technical personas) used by this repo's Claude Code skills (`plan-meal`, `update-app`,
  `find-recipe`, `photo-lookup`) — see `CLAUDE.md` for how those fit together.

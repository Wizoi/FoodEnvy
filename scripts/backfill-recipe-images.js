#!/usr/bin/env node
// Sources real, openly-licensed photos for recipes missing `imageUrl`, via Openverse's public
// API (structured license metadata, no API key required) -- see the update-app plan for why this
// replaces the old per-recipe WebSearch instruction in find-recipe (0% success rate at scale).
//
// Deliberately does NOT write into public/foodenvy-complete-recipes.json directly. Per the
// allergy-safety/gluten-free/weekend-hobbyist personas' review of this exact plan: a license
// check and a "does this photo actually depict this dish" check are orthogonal. A name-only
// text query can return a photo that's completely unrelated to the dish (confirmed directly:
// querying "spiced candied pecans" returns a "Pumpkin Pie Waffle" photo as the first
// license-clear result). For a technique-driven recipe, a wrong-but-legal photo actively
// misteaches the result -- worse than the honest fallback gradient. So this script only
// produces a reviewable log; merging into the live recipe data is a separate, explicit step
// after a human spot-check.
//
// Usage: node scripts/backfill-recipe-images.js [--limit N]
//   --limit N   only process the first N recipes missing an image (for a quick test run)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_PATH = path.join(__dirname, '../public/foodenvy-complete-recipes.json');
const LOG_PATH = path.join(__dirname, 'image-backfill-log.json');

const ALLOWED_LICENSES = ['cc0', 'pdm', 'by', 'by-sa'];
const OPENVERSE_URL = 'https://api.openverse.org/v1/images/';

const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

async function queryOpenverse(query) {
  const url = OPENVERSE_URL + '?q=' + encodeURIComponent(query) +
    '&license=' + ALLOWED_LICENSES.join(',') +
    '&page_size=5';
  const resp = await fetch(url, { headers: { 'User-Agent': 'FoodEnvy-recipe-backfill/1.0' } });
  if (!resp.ok) {
    throw new Error('Openverse request failed: ' + resp.status + ' ' + resp.statusText);
  }
  const data = await resp.json();
  return data.results || [];
}

async function main() {
  const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8'));
  const missing = recipes.filter(r => !r.imageUrl || !r.imageUrl.trim());
  const toProcess = missing.slice(0, LIMIT);

  console.log('Recipes missing an image: ' + missing.length);
  console.log('Processing this run: ' + toProcess.length + (LIMIT !== Infinity ? ' (--limit ' + LIMIT + ')' : ''));

  const results = [];
  let found = 0, notFound = 0, errored = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const recipe = toProcess[i];
    const query = recipe.name + ' ' + recipe.mealType;
    process.stdout.write('[' + (i + 1) + '/' + toProcess.length + '] ' + recipe.name + ' ... ');
    try {
      const candidates = await queryOpenverse(query);
      const match = candidates.find(c => ALLOWED_LICENSES.includes((c.license || '').toLowerCase()) && c.url);
      if (match) {
        found++;
        console.log('found (' + match.license + ', ' + match.source + ')');
        results.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          mealType: recipe.mealType,
          query,
          imageUrl: match.url,
          foreignLandingUrl: match.foreign_landing_url,
          license: match.license,
          licenseVersion: match.license_version,
          source: match.source || match.provider,
          creator: match.creator || null,
          title: match.title || null,
        });
      } else {
        notFound++;
        console.log('no license-clear result');
        results.push({ recipeId: recipe.id, recipeName: recipe.name, mealType: recipe.mealType, query, imageUrl: null, reason: 'no license-clear result' });
      }
    } catch (e) {
      errored++;
      console.log('ERROR: ' + e.message);
      results.push({ recipeId: recipe.id, recipeName: recipe.name, mealType: recipe.mealType, query, imageUrl: null, reason: 'error: ' + e.message });
    }
    // Be a polite API citizen -- small delay between requests.
    await new Promise(res => setTimeout(res, 250));
  }

  fs.writeFileSync(LOG_PATH, JSON.stringify(results, null, 2) + '\n');
  console.log('');
  console.log('Found: ' + found + '  No match: ' + notFound + '  Errors: ' + errored);
  console.log('Log written to: ' + LOG_PATH);
  console.log('');
  console.log('This is a REVIEW LOG, not applied to the live recipe data. Spot-check entries');
  console.log('(especially any technique-payoff dish) before merging imageUrl/imageAttribution');
  console.log('into public/foodenvy-complete-recipes.json.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

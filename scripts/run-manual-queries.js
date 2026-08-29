#!/usr/bin/env node
// Runs the curated query list in scripts/manual-search-queries.json (5 hand-picked search terms
// per recipe, drawing on actual dish/cuisine knowledge rather than mechanical string tricks --
// see the photo-lookup skill for why the fully-automated approach tops out around 80%) against
// Openverse, in order, stopping at the first query that returns a license-clear candidate.
//
// Same two-stage safety pattern as backfill-recipe-images.js: this only writes a reviewable log
// (scripts/manual-search-log.json). Merging into the live library happens via
// merge-image-backfill.js same as always, which applies its own independent title-sanity filter.
//
// Usage: node scripts/run-manual-queries.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUERIES_PATH = path.join(__dirname, 'manual-search-queries.json');
const LOG_PATH = path.join(__dirname, 'manual-search-log.json');

const ALLOWED_LICENSES = ['cc0', 'pdm', 'by', 'by-sa'];
const OPENVERSE_URL = 'https://api.openverse.org/v1/images/';

function sanitizeForSearch(query) {
  return query.replace(/["'‘’“”]/g, '').replace(/\s+/g, ' ').trim();
}

const STOPWORDS = new Set(['and', 'the', 'with', 'for', 'from', 'a', 'an', 'of', 'in', 'on', 'at', 'to']);
function significantWords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !STOPWORDS.has(w));
}
function scoreCandidate(queryWords, title) {
  if (!title) return 0;
  const t = title.toLowerCase();
  return queryWords.filter(w => t.includes(w)).length;
}

async function queryOpenverse(query) {
  const url = OPENVERSE_URL + '?q=' + encodeURIComponent(sanitizeForSearch(query)) +
    '&license=' + ALLOWED_LICENSES.join(',') + '&page_size=15';
  const resp = await fetch(url, { headers: { 'User-Agent': 'FoodEnvy-recipe-backfill/1.0' } });
  if (!resp.ok) throw new Error('Openverse request failed: ' + resp.status + ' ' + resp.statusText);
  const data = await resp.json();
  return data.results || [];
}

async function bestCandidateForQuery(query) {
  const candidates = await queryOpenverse(query);
  await new Promise(res => setTimeout(res, 200));
  const licensed = candidates.filter(c => ALLOWED_LICENSES.includes((c.license || '').toLowerCase()) && c.url);
  if (licensed.length === 0) return null;
  const queryWords = significantWords(query);
  let best = licensed[0], bestScore = scoreCandidate(queryWords, licensed[0].title);
  for (const c of licensed.slice(1)) {
    const s = scoreCandidate(queryWords, c.title);
    if (s > bestScore) { best = c; bestScore = s; }
  }
  return { match: best, query, score: bestScore };
}

async function main() {
  const entries = JSON.parse(fs.readFileSync(QUERIES_PATH, 'utf8'));
  console.log('Recipes to try: ' + entries.length);

  const results = [];
  let found = 0, notFound = 0, errored = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    process.stdout.write('[' + (i + 1) + '/' + entries.length + '] ' + entry.name + ' ... ');
    try {
      let result = null;
      for (const q of entry.queries) {
        result = await bestCandidateForQuery(q);
        if (result) break;
      }
      if (result) {
        found++;
        const { match, query, score } = result;
        console.log('found (' + match.license + ', ' + match.source + ', score ' + score + ', "' + query + '")');
        results.push({
          recipeId: entry.id,
          recipeName: entry.name,
          query,
          matchType: 'dish',
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
        console.log('no license-clear result across all ' + entry.queries.length + ' queries');
        results.push({ recipeId: entry.id, recipeName: entry.name, query: entry.queries.join(' | '), imageUrl: null, reason: 'no license-clear result' });
      }
    } catch (e) {
      errored++;
      console.log('ERROR: ' + e.message);
      results.push({ recipeId: entry.id, recipeName: entry.name, imageUrl: null, reason: 'error: ' + e.message });
    }
  }

  fs.writeFileSync(LOG_PATH, JSON.stringify(results, null, 2) + '\n');
  console.log('');
  console.log('Found: ' + found + '  No match: ' + notFound + '  Errors: ' + errored);
  console.log('Log written to: ' + LOG_PATH);
}

main().catch(e => { console.error(e); process.exit(1); });

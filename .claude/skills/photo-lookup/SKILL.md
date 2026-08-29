---
name: photo-lookup
description: Find real, openly-licensed photos for FoodEnvy recipes (or any similarly-named-item dataset) via Openverse's public API, without gating on a human reviewing every candidate by hand. Documents the query-variant tricks, ranked ingredient/equipment fallback tiers, and independent sanity filter built up while backfilling photos for the recipe library. Use whenever the user asks to find more recipe photos, improve the photo-matching hit rate, or apply this same approach to a new dataset.
---

# Photo lookup

Sources real, license-clear photos for items that only have a name and some structured metadata
(here: FoodEnvy recipes) via Openverse's public API (`api.openverse.org/v1/images/`, no API key
required, structured license fields — not a WebSearch judgment call). Implemented as
`scripts/backfill-recipe-images.js` (search + candidate scoring, writes a reviewable log) and
`scripts/merge-image-backfill.js` (independent sanity filter, applies the accepted subset to the
live data). Read both files before changing anything — this doc explains *why* they're shaped
the way they are; the code is the source of truth for exact behavior.

## Why two scripts, not one

A license check and a "does this photo actually depict this item" check are orthogonal — Openverse
can return a perfectly legal photo of the *wrong thing* (confirmed directly: searching "spiced
candied pecans" returns a "Pumpkin Pie Waffle" photo as the top license-clear hit). Merging
straight into live data on license-clear-alone risks confidently wrong photos. So the pipeline is
always: **search → reviewable log → independent title-sanity filter → merge**. Re-running the
search script never loses this safety property — always run the merge step separately afterward,
never fold its filter into the search script itself.

Per explicit direction on this project: don't gate on a human reviewing every candidate one by
one — the automated sanity filter (below) is the review, not a human pass over ~150+ entries.

## The search: three ranked tiers, each with its own fallback ladder

`bestMatchForRecipe()` tries, in order, stopping at the first tier that finds anything:

1. **Dish name** — search the item's own name. See "Query-variant tricks" below for how many
   ways a straightforward name search can silently return zero results.
2. **Headline ingredient(s)** — when the dish name comes up empty entirely (compound/fusion
   names, uncommon dishes), search the item's own most important *ingredient* instead. This is
   **not** a photo of the finished dish — it's something topically relevant instead of a flat
   fallback graphic. Must be ranked toward *bulk, important* ingredients, not whichever one
   happens to be listed first or a minor garnish/seasoning (see "Ranking ingredients" below) —
   this was explicit user direction after an early pass leaned on trivial ingredients.
3. **Equipment/technique** — last resort, only for items that clearly name a distinctive
   cooking vessel/method (slow cooker, cast iron, wok...). Search the vessel/appliance itself,
   **never** a phrase implying a finished dish in it ("slow cooker meal") — a photo of some
   *other* dish sitting in the vessel reads as "here's tonight's dinner" and risks being mistaken
   for a real (wrong) match. This is the tier most likely to look "off" if done carelessly, per
   explicit caution: be conservative here, keep the query to the bare vessel noun only.

Each tier logs a `matchType` (`'dish' | 'ingredient' | 'equipment'`) so a non-dish match never
silently blends in as if it were a real photo of the finished item — both in the log and in the
merged data's `imageAttribution.matchType`.

### Query-variant tricks (tier 1: dish name)

A single "search the exact name" attempt fails far more often than it should, for fixable
reasons. All confirmed directly against the live API, not guessed:

- **Don't append category/type metadata to the query.** `"Cheese Quesadilla snack"` (name +
  mealType) returns 0 results; `"Cheese Quesadilla"` alone returns 229, several open-licensed.
  A word like "snack"/"dessert" almost never appears in how a real photo gets titled — it just
  poisons an otherwise-good search.
- **Strip a leading clause of known filler/framing words** the item's own naming convention adds
  but a photo title never would — this project's list (`FILLER_PREFIXES`) covers meal-kit/
  technique framing: "One-Pot", "Loaded", "Sheet-Pan", "Classic", "Homemade", "No-Bake", etc.
- **Cut off a trailing `"with X"` clause** — almost always a garnish/sauce/side a photo title
  wouldn't mention ("... with Herb Butter"). Deliberately do **not** split on "and"/"&" — those
  routinely *are* the dish name ("Beef and Broccoli", "Mac and Cheese").
- **Strip a small set of trailing presentation-format words** (`GENERIC_SUFFIXES`: "Bar",
  "Platter", "Board", "Spread") — these describe how the dish is *served*, not what it *is*; a
  photo is never titled "... Bar" even for something genuinely served that way. Deliberately
  narrow: don't include "Bites"/"Skewers"/"Wedges" here — those are often the recognizable dish
  name itself ("Chicken Skewers" is a perfectly real, searchable dish).
- **Progressively drop unanticipated leading words when the known strips aren't enough.**
  Confirmed directly: `"Backyard Sundae Bar"` (full name) → 0 results; `"Sundae Bar"` → 61;
  bare `"Sundae"` → 240. There's no way to enumerate every possible leading modifier in advance,
  so once the known strips are applied, keep dropping the leftmost word and retrying. Floor at 1
  word, but only keep a final single-word variant if it's ≥5 characters (still distinctive
  enough alone) — correctness is still gated by the independent merge-step filter, so a broader
  net here is safe; worst case it just finds nothing better.
- **Strip quote marks (straight or curly) from every query, unconditionally.** An "air-quote"
  name like `Instant Mac and "Cheese" Bowl` (signaling "not real cheese") breaks Openverse's
  query parser outright — confirmed directly, the quoted version returns 0 results, the same
  name with quotes removed returns 240. Quotes never help this API's search; strip them at the
  single point where a query is actually sent, regardless of which tier/variant produced it.
- **Raise `page_size` well above the number of results you'll actually use, and *score* instead
  of taking the first hit.** A license filter applied server-side with a small page size (e.g. 5)
  can mean a genuinely good open-licensed photo further down the list never gets seen. Fetch more
  (this project uses 15) and score every license-clear candidate by how many significant words of
  the query appear in its title, keeping the best-scoring one — not whichever came first.

### Ranking ingredients (tier 2)

Don't just take `ingredients[0]`. Rank by a cheap importance signal and take the top N:

- **Unit signals bulk vs. accent.** A `tsp`/`tbsp`/`pinch`/`dash`/`clove`/`sprig`/`leaf`/`stick`
  quantity is a seasoning or garnish, not what the dish is built from — score it lower than a
  `cup`/`lb`/`oz`/`piece`/`whole`/similar bulk unit.
- **A canonical allergen/diet tag is a good proxy for "headline ingredient."** In this project,
  an ingredient tagged `dairy`/`gluten`/`nuts`/`shellfish`/`egg`/`soy`/`sesame`/`meat`/`pork`/
  `beef`/`fish` is very likely the protein/anchor, not an incidental extra — worth a scoring
  boost independent of unit.
- **Exclude pantry staples** (salt, oil, butter, sugar, flour, water, vanilla extract, baking
  soda/powder, etc.) — they appear in nearly everything and searching them just returns generic
  stock photography unrelated to this specific item.
- **Normalize the ingredient name before comparing against the staple list or building the
  query.** Ingredient names routinely carry a cooking-state clause ("Unsalted butter, melted",
  "Onion, diced") — strip everything from the first comma (and any parenthetical) *before* the
  staple check, or "Unsalted butter, melted" silently slips past a staple list that only has
  "unsalted butter" in it. This was a real bug caught mid-project: several dessert recipes had
  "Unsalted butter, melted" chosen as the "headline ingredient" purely because the staple filter
  did exact-string matching against un-normalized names.
- **Keep listed order as the tiebreaker**, not a secondary sort key — ingredient lists tend to
  name the headline component first anyway, so this rarely needs to matter, but it's a sane
  fallback when nothing else distinguishes two candidates.

### Equipment tier (tier 3)

A small curated regex→query map (vessel/method name → literal search term), scanned against the
item's own name + tags + steps/instructions text. Keep each mapped query to the bare noun
(`"cast iron skillet"`, `"slow cooker"`, `"wok"`) — never a phrase that implies a finished dish,
per the caution above. This tier will rarely fire (most items won't name a distinctive vessel)
and that's fine — it's a last resort, not a primary strategy.

## The independent sanity filter (`merge-image-backfill.js`)

The search script's own scoring picks the *best available* candidate for a query, but "best
available" can still be a real mismatch if nothing good exists (the Pumpkin Pie Waffle case: best
of a bad lot, `score: 0`). The merge step is a **second, independent** check before anything
touches live data:

- **Dish-tier matches**: require the photo's title to share either **two** significant words
  with the item's own name, or **one** strongly distinctive word (≥7 characters, e.g.
  "quesadilla", "carbonara"). A single generic-word coincidence ("Beef" matching "Beef Stew" — a
  real but *wrong* dish) no longer passes on its own. This bar had to be tightened once shorter
  fallback/trimmed queries were introduced, since those raise exactly this single-generic-word
  risk.
- **Ingredient/equipment-tier matches**: a much lower bar — just confirm the searched word itself
  shows up in the title. The query *is* the ingredient/vessel name, so "does it show up" isn't a
  meaningful relevance signal on its own; these tiers were never claiming to depict the finished
  item in the first place, so there's nothing stronger worth checking automatically.
- Rejected candidates are written to `scripts/image-backfill-rejected.json`, not silently
  dropped — worth an occasional human skim, especially for anything visually distinctive
  (technique-payoff dishes, anything where a wrong photo would actively mislead).

## A fourth tier, for when automated variants top out: curated queries

The three programmatic tiers (dish name + variants, ranked ingredient, equipment) plateaued
around 80% of the library having a real photo. The remaining recipes mostly weren't failing for
a fixable mechanical reason -- they were failing because the *literal* dish name just isn't how
anyone photographs or captions food ("Backyard Sundae Bar" the recipe vs. "ice cream sundae bar
toppings" the way a photo actually gets titled), or the name carries meal-kit/parallel-menu
framing ("Chili, Ladled Off Before the Beef") that has nothing to do with the dish itself.

For this last stretch, hand-write 5 search terms per remaining recipe using actual food/cuisine
knowledge -- the authentic regional name, the restaurant-menu phrasing, a plated-dish descriptor,
a synonym for the format -- save them to a simple `{id, name, queries}` array (see
`scripts/manual-search-queries.json`), and run them through the same license-filter-and-score
logic via `scripts/run-manual-queries.js` (try each query in order, stop at the first hit). This
raised the fill rate from ~80% to ~89% on this library. It is NOT mechanical -- writing good
queries requires knowing, e.g., that "Bo Luc Lac" is more likely to be captioned as "shaking beef"
in English-language stock photography, or that a "Coq au Vin" photo is more likely titled "chicken
braised red wine" than the French name. Don't try to automate this step; it's the one place actual
judgment earns its keep.

**Even more of a reason to visually review this tier's results** (see below) -- curated queries
are deliberately closer to natural photo-caption language, which means a wrong match is more
likely to *look* plausible at a glance than the mechanical tiers' failures. This run's visual
review still caught: a literal frozen-food-box product photo (not real food at all) matched to
"Beef & Black Bean Burrito Bowls", a bowl of pho matched to "Vietnamese Banh Mi Breakfast Bowl",
and tater tots matched to "Egg Salad Sandwiches" — all with a title that read close enough to pass
a casual glance.

## Running it

```bash
node scripts/backfill-recipe-images.js [--limit N]   # search; writes scripts/image-backfill-log.json
node scripts/merge-image-backfill.js                 # sanity-filter + merge into live data

# Once the above plateaus (recipes still missing an image after a full run), write curated
# queries for what's left and run those instead:
#   1. build scripts/manual-search-queries.json -- [{id, name, queries: [5 hand-picked terms]}]
#      for every recipe still missing an image, using real food/cuisine knowledge
node scripts/run-manual-queries.js                   # tries each recipe's queries in order,
                                                       # writes scripts/manual-search-log.json
#   2. merge that into the main log (dedupe by recipeId, manual entries win), then merge as usual:
node -e "const fs=require('fs');const main=JSON.parse(fs.readFileSync('scripts/image-backfill-log.json'));const manual=JSON.parse(fs.readFileSync('scripts/manual-search-log.json'));const ids=new Set(manual.map(e=>e.recipeId));fs.writeFileSync('scripts/image-backfill-log.json',JSON.stringify([...main.filter(e=>!ids.has(e.recipeId)),...manual],null,2)+'\n');"
node scripts/merge-image-backfill.js
```

**Always do a visual review pass after merging**, regardless of which tier(s) ran -- build an
HTML contact-sheet grid of the newly-added photos (recipe name + thumbnail + matched title, ~12
per page) and eyeball it page by page rather than trusting the word-overlap filter alone. See "A
real gap the sanity filter doesn't catch" above for why: some of the worst mismatches (a coat of
arms, a product package photo, party decorations) had a title that technically passed the word
check. This is cheap (a few dozen screenshots, not per-image tool calls) and has caught a real
mismatch in every batch run so far.

Both scripts scope themselves to whatever's currently missing a photo, so re-running after
adding new items (or after improving the search logic itself) just works — no need to pass ids.
The search script also preserves prior log entries for any item it didn't touch this run (e.g. a
`--limit` test run), so re-running never regresses earlier candidates.

## If you're applying this to a different dataset

The shape generalizes past recipes: any collection of named items with some structured
sub-fields (ingredients here, but the same idea applies to parts lists, tracklists, whatever) can
use the same three-tier approach — item name, then a ranked "what is this actually built from"
sub-field, then a distinctive-context fallback. The specific word lists (`FILLER_PREFIXES`,
`GENERIC_SUFFIXES`, `PANTRY_STAPLES`, `MINOR_UNITS`, `EQUIPMENT_PATTERNS`) are FoodEnvy-specific
and would need re-deriving for a new domain — but derive them the same way these were: run a real
query, look at the actual result count and titles, don't guess.

## A real gap the sanity filter doesn't catch: referential word matches

A manual visual review of the ~110 weakest-signal accepted matches (word-overlap ≤1, done by
building an HTML contact-sheet grid of thumbnails and eyeballing pages of ~12 at a time — cheaper
than fetching/judging one image per turn) found real mismatches the title-word filter had no way
to catch, because the word genuinely IS in the title -- it just doesn't mean what it looks like it
means:

- `"Classic Meatloaf with Mashed Potatoes"` and `"Classic Lower-Sodium Meatloaf"` (two different
  recipes) both accepted a photo titled `"Mom's Meatloaf grilled cheese sandwich"` — the photo is
  a grilled cheese sandwich; "Meatloaf" is just part of how the photographer named their file
  ("my mom's meatloaf [recipe], [today's actual food is a] grilled cheese sandwich"), not a
  description of what's pictured.
- `"Crispy Baked Chickpea Poppers with Tahini Drizzle"` and `"Soy-Sesame Edamame Poppers"` both
  accepted a photo titled `"Party Poppers!"` — same word, entirely different meaning (party
  favors, not food), and the photo shows exactly that: no food at all.
- `"Tempeh Bourguignon"` matched a heraldic coat-of-arms image because "Bourguignon" is also part
  of a French place name (`"Blason Bourguignon-sous-Montbavin"`) — not a food photo whatsoever.

The single-strongly-distinctive-word bar (≥7 characters) was calibrated against *coincidental
overlap on a common word* (the original "Beef"/"Beef Stew" case), not against *a real word match
that's being used referentially rather than descriptively*. There's no cheap automated fix for
this class of error — it requires actually looking at the image. If revisiting this: consider
either lowering trust in single-word dish-tier matches further, or (better, if the volume ever
justifies the cost) adding an actual vision-capable judgment step against a downscaled thumbnail
for anything below a higher word-overlap bar, instead of only checking the title text.

**Practical takeaway for a future full review pass:** don't try to eyeball all matches at once —
cross-reference against a cheap proxy (recompute title/name word overlap, or whatever score the
search step produced) to build a prioritized "most likely wrong" queue first, and review that
before spending time on high-confidence matches that are almost certainly fine.

## Known limits (don't re-litigate these, just be aware)

- This is a text-search-then-license-filter approach, not image recognition — no tier here
  *proves* visual correctness, only makes a wrong match progressively less likely. The merge
  step's rejected-candidates log is the backstop, not a guarantee.
- Openverse's index skews heavily toward Flickr for food photography — expect `source: "flickr"`
  on the large majority of accepted matches, with Wikimedia and others as a small minority.
- Very fused/novel dish names (a real "substitute" dish like a mushroom-based "scallop" dish)
  frequently have close to zero photographed examples under any phrasing — that's a genuine gap
  in what's been publicly photographed, not a search-logic bug. The ingredient/equipment tiers
  exist specifically to give these a reasonable fallback instead of nothing.

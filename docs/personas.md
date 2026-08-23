# FoodEnvy expert personas

A reference library of expert personas that should ground how FoodEnvy writes recipes, tags ingredients, and shapes nutrition/substitution logic. These aren't in-app characters or chatbots — they're a shared point of reference so recipe content, difficulty labeling, and dietary rules read like they came from someone who actually knows the area, not a guess. When adding or editing recipes, ask "which of these personas would have written this, and does it sound like them?"

Grounded in research on meal-kit delivery services (HelloFresh, Blue Apron, Home Chef, EveryPlate, Dinnerly) and on real dietary-survey/allergen-safety practice (the FDA's "Big 9" allergen list) — not just invented from scratch. Sources noted where a persona's approach comes directly from that research.

## Home cooks (5)

Different skill levels and life contexts, so recipes can be tagged and written for a realistic range rather than one imagined "home cook."

### Jamie — the Weeknight Beginner
Entry-level. Cooks maybe twice a week, mostly out of necessity. Owns one good pan and a pot.
- Wants foolproof recipes with few steps and no technique that can silently go wrong (no "reduce until thickened" without a time/visual cue).
- Shops for exactly what's on the list — doesn't substitute confidently, so recipes for Jamie should specify common grocery-store brands/forms (e.g. "pre-shredded rotisserie chicken," not "cook and shred a chicken").
- Needs doneness given as a concrete signal (internal temp, color, texture), never "cook until done."

### Priya — the Busy Parent
Intermediate. Cooking for a family on a clock, most nights need to be 30 minutes or less.
- Prioritizes recipes that scale up and freeze well — a Tuesday dinner should survive becoming Thursday's lunch.
- Wants one dish the whole family can eat with minor swaps, not a separate kids' meal every night.
- Comfortable with basic technique (sautéing, roasting, simmering) but has no patience for recipes with more than ~8 ingredients.

### Marcus — the Dorm-Level Starter
True beginner. Minimal equipment (one pan, a microwave, maybe a rice cooker), small budget, small kitchen.
- Recipes must work with what's actually available in a dorm/small apartment — no oven-required steps unless a microwave/stovetop alternative exists.
- Leans on shelf-stable and long-life ingredients (rice, canned beans, eggs, frozen vegetables) over anything that spoils fast.
- Needs explicit safety basics stated, not assumed (e.g. "cook chicken until it reaches 165°F/74°C").

### Elena — the Weekend Hobbyist
Intermediate-plus. Willing to spend more time on a Saturday, wants to actually get better at cooking.
- Fine with a slightly longer ingredient list or a technique that takes practice (braising, spatchcocking, pan sauces) as long as it's explained, not assumed.
- Still shops at a normal grocery store — no specialty ingredients that require a separate trip.
- Appreciates recipes that explain *why* a step matters, not just what to do.

### Robert — the Retiree Traditionalist
Intermediate. Cooks from memory, prefers familiar comfort-food flavor combinations over novelty.
- Skeptical of trendy ingredients; wants classic combinations done well rather than a fusion twist.
- Increasingly cares about sodium and portion size without wanting the food to taste "diet."
- Good source for texture/dietary adaptations of classic dishes (e.g. a lower-sodium version of a family recipe) rather than inventing new ones.

## Meal-kit-savvy cooks (2)

Grounded directly in research on how HelloFresh, Blue Apron, Home Chef, EveryPlate, and Dinnerly design recipes: a protein + starch + vegetable + sauce/aromatic-base formula, 20-40 minute cook times, heavy use of sheet-pan/one-pot techniques, and "while X cooks, do Y" parallel steps that compress total time without demanding real multitasking skill.

### Dana — the HelloFresh Regular
Thinks in the meal-kit formula by default: one protein, one starch, one vegetable, one sauce or spice base, in that order, every time.
- Defaults to sheet-pan or one-pot methods specifically to minimize cleanup — "one dish to wash" is a real design goal, not an afterthought.
- Writes steps with parallel-task cueing ("while the chicken roasts, toss the green beans") so total time stays under ~35 minutes without asking for real multitasking skill.
- Gives doneness as a target internal temperature or a clear visual cue, never a guess.

### Theo — the Blue Apron Adventurer
Same formula as Dana, but willing to reach one notch further — a slightly less common cuisine or a two-part sauce, as long as it's still grocery-store-achievable.
- Builds flavor through a custom spice blend or sauce base assembled *before* cooking starts, so the cooking itself stays simple even when the flavor is more ambitious.
- Will introduce one new technique per recipe at most (e.g. a pan sauce, a quick pickle) — never stacks multiple unfamiliar techniques in one dish.
- Prefers the oven-as-wok substitution (sheet-pan "stir-fry") over requiring real wok technique from a home cook.

## Nutritionists (2)

### Dr. Amara Chen, RD — Family Balanced Nutrition
Registered dietitian. Thinks in terms of the plate method: roughly half vegetables/fruit, a quarter lean protein, a quarter whole grains/starch, per meal, per person.
- Reviews suggested meals for the whole family's balance across a week, not just a single dish in isolation.
- Prefers boosting a meal's nutritional value by adding to it (more vegetables, a whole grain swap) over restricting it.
- Flags when a week's suggestions skew too heavily toward one protein source or one food group.

### Nora Whitfield — Pediatric & Family Nutrition Coach
Focused on kids eating well without a meal turning into a fight.
- Prefers small, repeated exposure to vegetables over a single "eat your vegetables" showdown meal.
- Avoids restrictive framing ("no junk food") in favor of positive framing ("what's the vegetable and the protein tonight").
- Good source for kid-adaptable versions of a family recipe (e.g. deconstructed components, milder spice on the side) rather than a separate kids' menu.

## Dietary specialists (5)

Each covers one of the diet/allergy areas the family's profiles need to support. The Big 9 allergen list (milk, egg, fish, shellfish, tree nuts, peanuts, wheat, soy, sesame) — the actual FDA-regulated major allergens — is the backbone of the allergy specialist's checklist and of FoodEnvy's `ALLERGEN_TAGS` vocabulary (`src/domain/tags.js`).

### Sofia Marsh — Gluten-Free Specialist
Keen eye for swaps that preserve texture, not just remove gluten.
- Matches the starch to the dish's texture need: rice or corn pasta for a sauce that needs cling, a GF flour blend with xanthan gum for baking, rice for anything a grain bowl.
- Specializes in **parallel-track meals**: cook the shared base of a dish (protein, sauce, aromatics) once, then split at the starch/thickener step so the GF eater gets a genuinely equivalent plate, not a compromise. This is the direct model for FoodEnvy's "eligible members" per-recipe logic in `matcher.js`.
- Watches for hidden gluten in sauces and thickeners (soy sauce, roux, malt-based ingredients), not just the obvious bread/pasta.

### Devon Okafor — Vegan Specialist
Plant-protein and umami expert — never treats a vegan swap as finished just because the animal protein is gone.
- Goes to tofu, tempeh, legumes, or seitan for protein depending on the dish's texture need (tofu for a stir-fry, legumes for a stew, seitan for something that needs a chew).
- Rebuilds savoriness lost from removing meat/dairy with umami sources (soy sauce, miso, nutritional yeast, mushrooms) rather than leaving a dish tasting thin.
- Confirms every component — sauce, garnish, cooking fat — not just the headline protein, since dairy/egg hide in small places (butter finishing, mayo-based sauces).

### Grace Lin — Vegetarian Specialist
Plant-forward but dairy/egg-inclusive, focused on protein adequacy and genuine comfort-food satisfaction, not a "protein removed" version of a meat dish.
- Builds vegetarian mains around a real protein anchor (eggs, cheese, legumes) rather than just vegetables plus starch.
- Prefers dishes designed vegetarian from the start over meat dishes with the meat subtracted.

### Miguel Santos — Pescatarian Specialist
Seafood-forward, but pragmatic about accessibility and cost.
- Swaps fish/seafood into familiar dish formulas (tacos, stir-fries, pasta) rather than only suggesting seafood-specific cuisines.
- Favors accessible, commonly-stocked fish (salmon, shrimp, white fish) over anything that requires a specialty market.

### Aisha Rahman — Food Allergy Safety Specialist
Covers the Big 9 (milk, egg, fish, shellfish, tree nuts, peanuts, wheat, soy, sesame) plus cross-contact awareness.
- Treats an allergy restriction as strict and non-negotiable by default — never a "soft" preference, unlike a dislike.
- Reads for hidden allergens in ingredient names a non-specialist might miss (e.g. soy lecithin, casein, sesame oil in a stir-fry) before calling a substitution safe.
- When substituting to remove an allergen, checks the substitute doesn't introduce a *different* one (e.g. swapping wheat pasta for a nut-flour pasta is not a safe swap for someone with a nut allergy).

## Chef / meal-prep organizers (2)

### Chef Lucia Alvarez — Batch-Cook & Shopping-List Organizer
Thinks a week at a time, not one meal at a time.
- Batch-cooks shared components (a grain, a roasted vegetable, a protein) that get reused across multiple different meals in the week, to cut both cooking time and food waste.
- Builds the shopping list around cross-utilizing inventory — an ingredient bought for one recipe should show up in at least one more that week wherever possible.

### Chef Ben Osei — Parallel-Menu Coordinator
Specializes in cooking **one family meal with safe branch-offs** for different diets at once, rather than cooking multiple separate meals.
- Identifies the latest possible point in a recipe where it can safely split (e.g. everyone gets the same roasted vegetables and sauce; the gluten-free eater's portion gets rice instead of pasta; the vegetarian's portion gets extra tofu instead of the chicken).
- This is the working model behind FoodEnvy showing, per recipe, exactly which family members it's eligible for (`suggestion.eligibleMembers`/`ineligibleMembers` in `src/domain/matcher.js`) rather than only offering meals the *entire* family can eat identically.

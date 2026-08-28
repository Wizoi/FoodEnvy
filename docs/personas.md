# FoodEnvy personas

This is the roster of FoodEnvy's "development team" and "kitchen team" personas. Each one owns a
slice of the problem, and each linked YAML file captures real, citation-backed expertise -- so a
future feature or meal plan can start from "here's what we know" instead of guessing.

Each persona also exists as an invokable Claude Code subagent under
[`.claude/agents/`](../.claude/agents/) -- e.g. "ask the Gluten-Free Specialist" can be a literal
subagent call (`sofia-marsh-gluten-free`), not just a mental frame. Update **that persona's own
YAML file** under [`docs/personas/`](personas/) whenever its domain produces a durable finding --
the subagent `.md` files stay thin and point back to their persona file.

Two "team lead" agents (`food-prep-lead`, `app-update-lead`) exist for a quick single question
that doesn't warrant the full skill flow below -- they route to 1-4 relevant personas and
synthesize an answer, but have no Edit/Write/Bash access, so an actual change still has to go
through `update-app`.

**To plan a week of meals**, use the [`plan-meal`](../.claude/skills/plan-meal/) skill -- the cook
and nutrition personas review the family's profiles and current inventory together and work out a
week's meals (fusion ideas welcome), gated by a few clarifying questions (who, which meals, target
prep+cook time, how involved).

**To change the app itself**, use the [`update-app`](../.claude/skills/update-app/) skill -- the
two technical personas lead, but must consult the relevant cook/nutrition personas so food data
stays accurate and well-showcased; the group reaches consensus and the plan is presented for
approval before any code changes.

## The roster

### Home cooks -- varying skill level and life context
1. [Jamie -- Weeknight Beginner](personas/home-cooks/jamie-weeknight-beginner.yaml) -- entry-level,
   foolproof recipes, no assumed technique or equipment.
2. [Priya -- Busy Parent](personas/home-cooks/priya-busy-parent.yaml) -- 30-minutes-or-less,
   batch/freezer-friendly, one dish the whole family eats.
3. [Marcus -- Dorm-Level Starter](personas/home-cooks/marcus-dorm-starter.yaml) -- minimal
   equipment, small budget, shelf-stable staples.
4. [Elena -- Weekend Hobbyist](personas/home-cooks/elena-weekend-hobbyist.yaml) --
   intermediate-plus, willing to learn real technique on a weekend.
5. [Robert -- Retiree Traditionalist](personas/home-cooks/robert-retiree-traditionalist.yaml) --
   classic comfort food, lower-sodium adaptations that still taste right.

### Meal-kit-savvy cooks -- grounded in real meal-kit recipe formulas
6. [Dana -- HelloFresh Regular](personas/meal-kit/dana-hellofresh-regular.yaml) -- the
   protein+starch+veg+sauce formula, one-pot/sheet-pan, parallel-task step cueing.
7. [Theo -- Blue Apron Adventurer](personas/meal-kit/theo-blue-apron-adventurer.yaml) -- one
   flavor/technique reach further, still grocery-store-achievable.

### Nutritionists
8. [Dr. Amara Chen, RD -- Family Balanced Nutrition](personas/nutrition/amara-chen-family-nutrition.yaml)
   -- plate-method weekly balance, additive rather than restrictive fixes.
9. [Nora Whitfield -- Pediatric & Family Nutrition](personas/nutrition/nora-whitfield-pediatric-nutrition.yaml)
   -- kids, non-restrictive framing, kid-adaptable shared meals.

### Dietary specialists
10. [Sofia Marsh -- Gluten-Free Specialist](personas/dietary-specialists/sofia-marsh-gluten-free.yaml)
    -- texture-matched swaps, hidden-gluten checks, parallel-track meals.
11. [Devon Okafor -- Vegan Specialist](personas/dietary-specialists/devon-okafor-vegan.yaml) --
    plant-protein by texture need, rebuilding umami, checking every component.
12. [Grace Lin -- Vegetarian Specialist](personas/dietary-specialists/grace-lin-vegetarian.yaml) --
    real protein anchors (eggs, cheese, legumes), not "meat removed."
13. [Miguel Santos -- Pescatarian Specialist](personas/dietary-specialists/miguel-santos-pescatarian.yaml)
    -- fish/seafood into familiar formulas, sustainability-aware.
14. [Aisha Rahman -- Food Allergy Safety Specialist](personas/dietary-specialists/aisha-rahman-allergy-safety.yaml)
    -- the Big 9, cross-contact, never trading one allergen for another.

### Chef / meal-prep organizers
15. [Chef Lucia Alvarez -- Batch-Cook & Shopping-List Organizer](personas/chefs/lucia-alvarez-batch-cook.yaml)
    -- batch-cooked shared components, cross-utilized shopping lists.
16. [Chef Ben Osei -- Parallel-Menu Coordinator](personas/chefs/ben-osei-parallel-menu.yaml) -- one
    shared meal, safe late branch points per diner's diet.

### Technical
17. [Robin Alvarez -- Gamification & Interaction Designer](personas/technical/gamification-designer.yaml)
    -- owns the app's interactive feel: surveys, selection UX, engagement.
18. [Sam Okonkwo -- Web App Engineer](personas/technical/web-app-engineer.yaml) -- owns the actual
    React/Vite/IndexedDB implementation and the path to an eventual Android wrap.

More personas can be added the same way as the app grows -- new YAML file under `docs/personas/`,
new thin subagent under `.claude/agents/`, an entry here.

---
name: update-app
description: Design and plan a change to the FoodEnvy app itself, led by the technical personas (Gamification Designer, Web App Engineer) but consulting the relevant cook/nutrition personas so data stays accurate and meals stay well-showcased. The group reaches consensus and the plan is presented to the user for approval before any code changes. Use whenever the user wants to add a feature or change something in the FoodEnvy app.
---

# Update app

Runs FoodEnvy's technical personas plus whichever cook/nutrition personas are relevant against a
proposed app change, and produces one consensus plan -- presented to the user for approval
*before* any code is touched. This mirrors `plan-meal`'s persona-collaboration shape, but the
output is a plan for the user to approve, not a finished deliverable, because the target is the
app itself.

## When to use this

Any time the user wants to add a feature, change the interface, or otherwise modify the FoodEnvy
app -- "add X to the app," "can we change how Y looks," "let's build Z."

## Steps

1. **State the change** concretely -- restate it back plainly enough that a persona with zero
   conversation context can evaluate it cold. If the ask is vague, tighten it into a concrete
   proposal (what would actually change, for whom) before passing it downstream.

2. **Technical draft** -- launch both technical personas in parallel (`Agent` calls,
   `run_in_background: false`), each given the same self-contained description of the change:

   > FoodEnvy change under consideration: {{description}}.
   >
   > Propose your approach from your persona's lens (read your own file first: for the
   > Gamification Designer, the interaction/UX design; for the Web App Engineer, the
   > implementation). Be concrete: what would actually change, in which files, and why this
   > approach over an obvious alternative.

3. **Consult pass** -- decide which cook/nutrition personas are actually relevant to this specific
   change (don't invoke all 16 by default; this isn't `plan-meal`). A change to recipe display,
   nutrition info, dietary-restriction handling, or anything else that affects how food/nutrition
   data reaches the user should go to the relevant personas -- typically both nutritionists plus
   whichever dietary specialists or chef personas are most affected. A purely infrastructural
   change (build tooling, CI, an internal refactor with no visible effect) may reasonably get an
   explicit "no impact" from all of them -- that's still a valid, recorded response, not a skipped
   step. Launch the chosen personas in parallel with:

   > FoodEnvy change under consideration: {{description}}. Here's the technical team's draft
   > approach: {{combined technical draft from step 2}}.
   >
   > From your persona's lens, does this show your domain's data accurately and clearly, and does
   > it help showcase meals appropriately? If this doesn't touch your domain, say "no impact" in
   > one line rather than manufacturing a concern. If it does, give a concise assessment: what's
   > affected, any concern, and a recommendation.

4. **Reconcile to consensus** -- synthesize the technical draft and the cook/nutrition feedback
   into one final approach. Call out anything that only becomes visible by reading them together
   (the technical team wants X, but a persona flagged Y as a data-accuracy problem with X) the same
   way `persona-review` synthesizes cross-persona findings. If there's a genuine unresolved
   disagreement, say so rather than silently picking a side.

5. **Present the plan to the user for approval before any code changes.** In practice, use
   `EnterPlanMode` and write this synthesis (context, the consensus approach, files touched,
   verification plan) as the plan file, then `ExitPlanMode` -- approval is a real gate here, not
   just a chat message the user might skim past. Do not start editing files as part of this skill;
   that only happens after the user approves the resulting plan, the same as any other non-trivial
   FoodEnvy change.

## Notes

- Don't skip the cook/nutrition consult pass because the change "obviously" doesn't touch food
  data -- let the relevant personas say so themselves. A consistently-empty consult pass across
  many changes is itself useful signal about where the app's actual complexity lives.
- If any persona's analysis produces something worth keeping (a new constraint discovered, a
  design decision reached), offer to write it into that persona's own YAML file under
  `docs/personas/` -- those files are the team's shared memory across conversations.

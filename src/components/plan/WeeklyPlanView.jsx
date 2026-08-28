import { useState } from 'react';
import { buildUsageTrackedShoppingList, computeProteinTally, describeRepeats } from '../../domain/matcher.js';

function PlanSlot({ slot, dayIndex, members, onSwap, onApplyFork }) {
  const [expanded, setExpanded] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const missingNames = new Set(slot.missingIngredients.map((ing) => ing.name));
  const memberName = (id) => members.find((m) => m.id === id)?.name ?? id;
  const appliedForkMemberIds = slot.appliedForkMemberIds ?? [];

  return (
    <article className="recipe-card plan-slot">
      <header>
        <div>
          <span className="muted plan-slot-mealtype">{slot.mealType}</span>
          <h3>{slot.recipe.name}</h3>
        </div>
        <span className={`badge badge-status-${slot.status}`}>{slot.status === 'ready' ? 'Ready now' : 'Almost there'}</span>
      </header>

      {slot.ineligibleMembers.length > 0 && (
        <p className="muted">Not for: {slot.ineligibleMembers.map(memberName).join(', ')}</p>
      )}
      {slot.eligibleMembers.length > 0 && <p className="muted">For: {slot.eligibleMembers.map(memberName).join(', ')}</p>}

      <button type="button" className="link-button" onClick={() => setExpanded((v) => !v)}>
        {expanded ? 'Hide recipe' : 'Show recipe'}
      </button>

      {expanded && (
        <>
          <ul className="ingredient-list">
            {slot.recipe.ingredients.map((ing) => (
              <li key={ing.name} className={missingNames.has(ing.name) ? 'missing' : ''}>
                {ing.name}
              </li>
            ))}
          </ul>
          <ol className="recipe-steps">
            {slot.recipe.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </>
      )}

      {(slot.memberForks ?? [])
        .filter((fork) => !appliedForkMemberIds.includes(fork.memberId))
        .map((fork) => (
          <div key={fork.memberId} className="member-fork">
            <p className="muted">
              {memberName(fork.memberId)} needs a fork here (swap at the {fork.forkAt}): {fork.instructions}
            </p>
            <button type="button" onClick={() => onApplyFork(dayIndex, slot.slotId, fork.memberId)}>
              Adapt for {memberName(fork.memberId)}
            </button>
          </div>
        ))}
      {appliedForkMemberIds.map((memberId) => (
        <p key={memberId} className="muted">
          ✓ Adapted for {memberName(memberId)}
        </p>
      ))}

      {slot.alternates?.length > 0 && (
        <div className="swap-section">
          <button type="button" onClick={() => setSwapping((v) => !v)}>
            {swapping ? 'Never mind' : 'Swap this meal'}
          </button>
          {swapping && (
            <div className="chip-grid">
              {slot.alternates.map((alt, i) => (
                <button
                  key={alt.recipe.name}
                  type="button"
                  className="chip"
                  onClick={() => {
                    onSwap(dayIndex, slot.slotId, i);
                    setSwapping(false);
                  }}
                >
                  {alt.recipe.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function WeeklyPlanView({ plan, members, onSwap, onApplyFork, onDelete }) {
  const allSlots = plan.days.flatMap((day) => day.slots);
  const proteinTally = computeProteinTally(allSlots.map((s) => s.recipe));
  const repeatWarnings = describeRepeats(proteinTally);
  const shoppingList = buildUsageTrackedShoppingList(
    allSlots.map((s) => ({ slotId: s.slotId, missingIngredients: s.missingIngredients })),
  );

  return (
    <div className="weekly-plan-view">
      <div className="plan-header">
        <h2>{plan.label ?? 'This week'}</h2>
        <button type="button" onClick={onDelete}>
          Clear plan
        </button>
      </div>

      {repeatWarnings.length > 0 && (
        <div className="balance-warnings">
          {repeatWarnings.map((warning) => (
            <p key={warning} className="muted">
              ⚠ {warning}
            </p>
          ))}
        </div>
      )}

      {plan.days.map((day, dayIndex) => (
        <section key={day.day}>
          <h2>{day.day}</h2>
          <div className="recipe-grid">
            {day.slots.map((slot) => (
              <PlanSlot
                key={slot.slotId}
                slot={slot}
                dayIndex={dayIndex}
                members={members}
                onSwap={onSwap}
                onApplyFork={onApplyFork}
              />
            ))}
          </div>
        </section>
      ))}

      <aside className="shopping-list">
        <h3>Shopping list</h3>
        <ul>
          {shoppingList.map((item) => (
            <li key={item.name}>
              <label>
                <input type="checkbox" />
                {item.name} {item.usedBy.length > 1 && <span className="muted">({item.usedBy.length} meals)</span>}
              </label>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

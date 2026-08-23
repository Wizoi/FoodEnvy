import { useState } from 'react';
import { BIG9_ALLERGENS } from '../../domain/tags.js';
import { DIET_PRESETS, DIET_PRESET_OPTIONS, restrictionsForDiet } from '../../domain/dietPresets.js';
import { COMMON_FOOD_CHECKLIST, COMMON_FOOD_SET } from '../../domain/commonFoods.js';

const STEPS = ['Name', 'Allergies', 'Diet', 'Dislikes', 'Goals', 'Review'];
const BIG9_TAG_SET = new Set(BIG9_ALLERGENS.map((a) => a.tag));

function splitList(text) {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function deriveInitialState(member) {
  const restrictions = member?.restrictions ?? [];

  const allergyRestrictions = restrictions.filter((r) => r.category === 'allergy');
  const allergyTags = new Set(allergyRestrictions.filter((r) => BIG9_TAG_SET.has(r.value)).map((r) => r.value));
  const otherAllergies = allergyRestrictions.filter((r) => !BIG9_TAG_SET.has(r.value));

  const dietRestrictions = restrictions.filter((r) => r.category === 'diet');
  const dietValues = dietRestrictions.map((r) => r.value).sort();
  let dietKey = 'none';
  let dietOtherText = '';
  if (dietValues.length > 0) {
    const matched = Object.entries(DIET_PRESETS).find(
      ([, tags]) => JSON.stringify([...tags].sort()) === JSON.stringify(dietValues),
    );
    if (matched) {
      dietKey = matched[0];
    } else {
      dietKey = 'other';
      dietOtherText = dietValues.join(', ');
    }
  }

  const dislikeRestrictions = restrictions.filter((r) => r.category === 'dislike');
  const dislikes = new Set(
    dislikeRestrictions.filter((r) => COMMON_FOOD_SET.has(r.value.toLowerCase())).map((r) => r.value.toLowerCase()),
  );
  const otherDislikes = dislikeRestrictions.filter((r) => !COMMON_FOOD_SET.has(r.value.toLowerCase()));

  return {
    name: member?.name ?? '',
    allergyTags,
    allergyOther: otherAllergies.map((r) => r.value).join(', '),
    allergyOtherSeverity: otherAllergies[0]?.severity ?? 'strict',
    dietKey,
    dietOtherText,
    dislikes,
    dislikeOther: otherDislikes.map((r) => r.value).join(', '),
    goals: restrictions
      .filter((r) => r.category === 'goal')
      .map((r) => r.value)
      .join(', '),
  };
}

function buildRestrictions(state) {
  const restrictions = [];

  for (const tag of state.allergyTags) {
    restrictions.push({ category: 'allergy', value: tag, severity: 'strict' });
  }
  for (const value of splitList(state.allergyOther)) {
    restrictions.push({ category: 'allergy', value, severity: state.allergyOtherSeverity });
  }

  if (state.dietKey === 'other') {
    for (const value of splitList(state.dietOtherText)) {
      restrictions.push({ category: 'diet', value, severity: 'strict' });
    }
  } else {
    restrictions.push(...restrictionsForDiet(state.dietKey));
  }

  for (const value of state.dislikes) {
    restrictions.push({ category: 'dislike', value, severity: 'soft' });
  }
  for (const value of splitList(state.dislikeOther)) {
    restrictions.push({ category: 'dislike', value, severity: 'soft' });
  }
  for (const value of splitList(state.goals)) {
    restrictions.push({ category: 'goal', value, severity: 'soft' });
  }

  return restrictions;
}

export default function ProfileWizard({ initialMember, onSave, onCancel }) {
  const [state, setState] = useState(() => deriveInitialState(initialMember));
  const [stepIndex, setStepIndex] = useState(initialMember ? STEPS.length - 1 : 0);

  const step = STEPS[stepIndex];
  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  function toggleInSet(key, value) {
    setState((s) => {
      const next = new Set(s[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...s, [key]: next };
    });
  }

  function handleSave() {
    onSave({ ...initialMember, name: state.name.trim(), restrictions: buildRestrictions(state) });
  }

  const restrictionPreview = buildRestrictions(state);
  const selectedDiet = DIET_PRESET_OPTIONS.find((d) => d.key === state.dietKey);

  return (
    <div className="profile-wizard">
      <div className="wizard-progress">
        {STEPS.map((label, i) => (
          <div key={label} className={i <= stepIndex ? 'wizard-segment filled' : 'wizard-segment'} title={label} />
        ))}
      </div>

      {step === 'Name' && (
        <section className="wizard-step">
          <h2>Who is this profile for?</h2>
          {!initialMember && <p className="muted">About 2 minutes -- name, allergies, diet, and a few preferences.</p>}
          <label>
            Name
            <input
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              placeholder="Family member name"
              autoFocus
            />
          </label>
        </section>
      )}

      {step === 'Allergies' && (
        <section className="wizard-step">
          <h2>Does {state.name || 'this person'} have any food allergies?</h2>
          <p className="muted">
            Tap any of these common allergens that apply. They're treated as strict -- never mixed into a suggested
            meal, unlike a dislike.
          </p>
          <div className="chip-grid">
            {BIG9_ALLERGENS.map(({ label, tag }) => (
              <button
                key={tag}
                type="button"
                className={state.allergyTags.has(tag) ? 'chip chip-selected' : 'chip'}
                onClick={() => toggleInSet('allergyTags', tag)}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            Anything else?
            <input
              value={state.allergyOther}
              onChange={(e) => setState((s) => ({ ...s, allergyOther: e.target.value }))}
              placeholder="e.g. kiwi, sulfites (comma-separated)"
            />
          </label>
          {state.allergyOther.trim() && (
            <label className="inline-label">
              Severity
              <select
                value={state.allergyOtherSeverity}
                onChange={(e) => setState((s) => ({ ...s, allergyOtherSeverity: e.target.value }))}
              >
                <option value="strict">strict</option>
                <option value="soft">soft</option>
              </select>
            </label>
          )}
        </section>
      )}

      {step === 'Diet' && (
        <section className="wizard-step">
          <h2>Does {state.name || 'this person'} follow a particular diet?</h2>
          <p className="muted">Pick the closest match -- you can fine-tune afterward.</p>
          <div className="chip-grid">
            {DIET_PRESET_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={state.dietKey === key ? 'chip chip-selected' : 'chip'}
                onClick={() => setState((s) => ({ ...s, dietKey: key }))}
              >
                {label}
              </button>
            ))}
          </div>
          {selectedDiet && <p className="muted diet-description">{selectedDiet.description}</p>}
          {state.dietKey === 'other' && (
            <label>
              Describe it
              <input
                value={state.dietOtherText}
                onChange={(e) => setState((s) => ({ ...s, dietOtherText: e.target.value }))}
                placeholder="e.g. keto, low-FODMAP (comma-separated)"
              />
            </label>
          )}
        </section>
      )}

      {step === 'Dislikes' && (
        <section className="wizard-step">
          <h2>Anything {state.name || 'this person'} would rather skip?</h2>
          <p className="muted">
            Tap the common foods to rule out -- this lowers a recipe's rank but doesn't exclude it, unlike an allergy.
          </p>
          {COMMON_FOOD_CHECKLIST.map(({ category, items }) => (
            <div key={category} className="checklist-category">
              <h3>{category}</h3>
              <div className="chip-grid">
                {items.map((food) => (
                  <button
                    key={food}
                    type="button"
                    className={state.dislikes.has(food) ? 'chip chip-selected' : 'chip'}
                    onClick={() => toggleInSet('dislikes', food)}
                  >
                    {food}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label>
            Anything else?
            <input
              value={state.dislikeOther}
              onChange={(e) => setState((s) => ({ ...s, dislikeOther: e.target.value }))}
              placeholder="e.g. blue cheese dressing (comma-separated)"
            />
          </label>
        </section>
      )}

      {step === 'Goals' && (
        <section className="wizard-step">
          <h2>Any nutrition goals for {state.name || 'this person'}?</h2>
          <p className="muted">Optional -- e.g. high protein, low sodium, more fiber. Free text for now.</p>
          <label>
            Goals <span className="muted">(optional)</span>
            <input
              value={state.goals}
              onChange={(e) => setState((s) => ({ ...s, goals: e.target.value }))}
              placeholder="e.g. high protein, low sodium"
            />
          </label>
        </section>
      )}

      {step === 'Review' && (
        <section className="wizard-step">
          <h2>Review {state.name || '(no name yet)'}'s profile</h2>
          {restrictionPreview.length > 0 ? (
            <div className="badge-row">
              {restrictionPreview.map((r, i) => (
                <span key={i} className={`badge badge-${r.category}`}>
                  {r.category}: {r.value}
                </span>
              ))}
            </div>
          ) : (
            <p className="empty-state">No restrictions or preferences -- eats anything.</p>
          )}
          <button type="button" className="link-button" onClick={() => setStepIndex(0)}>
            Start over
          </button>
        </section>
      )}

      <div className="form-actions">
        {stepIndex > 0 && (
          <button type="button" onClick={goBack}>
            Back
          </button>
        )}
        {step !== 'Review' && (
          <button type="button" className="primary" onClick={goNext} disabled={step === 'Name' && !state.name.trim()}>
            Next
          </button>
        )}
        {step === 'Review' && (
          <button type="button" className="primary" onClick={handleSave} disabled={!state.name.trim()}>
            Save
          </button>
        )}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

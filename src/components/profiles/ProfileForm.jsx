import { useState } from 'react';
import { ALL_TAGS, RESTRICTION_CATEGORIES } from '../../domain/tags.js';

function emptyDraft() {
  return { category: 'allergy', value: ALL_TAGS[0], severity: 'strict' };
}

export default function ProfileForm({ initialMember, onSave, onCancel }) {
  const [name, setName] = useState(initialMember?.name ?? '');
  const [restrictions, setRestrictions] = useState(initialMember?.restrictions ?? []);
  const [draft, setDraft] = useState(emptyDraft());

  const usesTagVocabulary = draft.category === 'allergy' || draft.category === 'diet';

  function updateDraftCategory(category) {
    setDraft({
      category,
      value: category === 'allergy' || category === 'diet' ? ALL_TAGS[0] : '',
      severity: 'strict',
    });
  }

  function addRestriction() {
    if (!draft.value.trim()) return;
    setRestrictions([...restrictions, draft]);
    setDraft(emptyDraft());
  }

  function removeRestriction(index) {
    setRestrictions(restrictions.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ ...initialMember, name: name.trim(), restrictions });
  }

  return (
    <form className="profile-form" onSubmit={handleSubmit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Family member name" required />
      </label>

      <fieldset className="restriction-editor">
        <legend>Restrictions & preferences</legend>

        {restrictions.length > 0 && (
          <ul className="restriction-list">
            {restrictions.map((r, i) => (
              <li key={i}>
                <span className={`badge badge-${r.category}`}>
                  {r.category}: {r.value} {r.category !== 'goal' ? `(${r.severity})` : ''}
                </span>
                <button type="button" onClick={() => removeRestriction(i)} aria-label="Remove restriction">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="restriction-draft">
          <select
            value={draft.category}
            onChange={(e) => updateDraftCategory(e.target.value)}
          >
            {RESTRICTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {usesTagVocabulary ? (
            <select value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })}>
              {ALL_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={draft.value}
              onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              placeholder={draft.category === 'goal' ? 'e.g. high protein' : 'e.g. cilantro'}
            />
          )}

          {draft.category !== 'goal' && draft.category !== 'dislike' && (
            <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })}>
              <option value="strict">strict</option>
              <option value="soft">soft</option>
            </select>
          )}

          <button type="button" onClick={addRestriction}>
            Add
          </button>
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

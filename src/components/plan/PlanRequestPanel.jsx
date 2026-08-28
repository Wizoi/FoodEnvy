import { useRef, useState, useEffect } from 'react';
import { parsePlanExport } from '../../domain/planImport.js';
import { getApiKey, getWorkspaceId } from '../../lib/apiKeyStorage.js';
import { generateWeeklyPlan, MissingApiKeyError } from '../../lib/claudePlanClient.js';

const MEAL_SCOPES = ['Dinner only', 'Full menu'];
const TIME_BUDGETS = ['Under 20 min', 'Standard (20-40 min)', 'Some nights are fine to run long'];
const INVOLVEMENT_LEVELS = ['Keep it simple', 'Mix it up', "Let's stretch a night or two"];

export default function PlanRequestPanel({ members, inventory, recipes = [], onImportPlan, onGoToSettings, onGenerationStart, isGeneratingPlan = false, onAbortGeneration }) {
  const [selectedMemberIds, setSelectedMemberIds] = useState(() => members.map((m) => m.id));
  const [mealScope, setMealScope] = useState(MEAL_SCOPES[0]);
  const [timeBudget, setTimeBudget] = useState(TIME_BUDGETS[1]);
  const [involvement, setInvolvement] = useState(INVOLVEMENT_LEVELS[0]);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const abortControllerRef = useRef(null);

  // Show generating state from app-level if tab was switched away
  const isReallyGenerating = generating || isGeneratingPlan;

  const hasApiKey = !!getApiKey();

  useEffect(() => {
    let timer;
    if (isReallyGenerating) {
      timer = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isReallyGenerating]);

  function toggleMember(id) {
    setSelectedMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function handleGeneratePlan() {
    setGenerationError(null);
    setElapsedSeconds(0);
    setGenerating(true);
    onGenerationStart?.();

    abortControllerRef.current = new AbortController();

    try {
      const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id)).map((m) => ({ ...m, selected: true }));

      const result = await generateWeeklyPlan(
        getApiKey(),
        {
          members: selectedMembers,
          inventory,
          recipePool: recipes,
          mealScope,
          timeBudget,
          involvement,
        },
        { signal: abortControllerRef.current.signal },
        getWorkspaceId(),
      );

      const parsed = parsePlanExport(result);
      await onImportPlan(parsed);
    } catch (err) {
      if (err.name === 'AbortError') {
        // Silently ignore abort
      } else if (err instanceof MissingApiKeyError) {
        setGenerationError('API key required. Add one in Settings.');
      } else {
        setGenerationError(err.message || 'Failed to generate plan');
      }
    } finally {
      setGenerating(false);
      setElapsedSeconds(0);
    }
  }

  function handleCancelGeneration() {
    abortControllerRef.current?.abort();
  }

  return (
    <div className="plan-request-panel">
      <h2>Plan my week</h2>
      <p className="muted">
        This runs FoodEnvy's cook &amp; nutrition team in Claude Code (the <code>plan-meal</code> skill) against
        who's eating, your current inventory, and a few quick preferences.
      </p>

      {members.length > 0 && (
        <div className="member-filter">
          <span>Who's eating:</span>
          {members.map((m) => (
            <label key={m.id}>
              <input
                type="checkbox"
                checked={selectedMemberIds.includes(m.id)}
                onChange={() => toggleMember(m.id)}
              />
              {m.name}
            </label>
          ))}
        </div>
      )}

      <div className="checklist-category">
        <h3>Meal scope</h3>
        <div className="chip-grid">
          {MEAL_SCOPES.map((option) => (
            <button
              key={option}
              type="button"
              className={mealScope === option ? 'chip chip-selected' : 'chip'}
              onClick={() => setMealScope(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="checklist-category">
        <h3>Target prep + cook time</h3>
        <div className="chip-grid">
          {TIME_BUDGETS.map((option) => (
            <button
              key={option}
              type="button"
              className={timeBudget === option ? 'chip chip-selected' : 'chip'}
              onClick={() => setTimeBudget(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="checklist-category">
        <h3>How involved should the week be?</h3>
        <div className="chip-grid">
          {INVOLVEMENT_LEVELS.map((option) => (
            <button
              key={option}
              type="button"
              className={involvement === option ? 'chip chip-selected' : 'chip'}
              onClick={() => setInvolvement(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="form-actions">
        {!isReallyGenerating ? (
          <>
            <button
              type="button"
              className="primary"
              onClick={handleGeneratePlan}
              disabled={selectedMemberIds.length === 0 || !hasApiKey}
            >
              Plan this week
            </button>
            {!hasApiKey && (
              <p className="hint-text">
                Add your API key in <a href="#" onClick={(e) => { e.preventDefault(); onGoToSettings?.(); }}>Settings</a> to generate plans.
              </p>
            )}
          </>
        ) : (
          <>
            <button type="button" className="primary" disabled>
              Generating… {elapsedSeconds > 0 && `(${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')})`}
            </button>
            <button type="button" onClick={() => {
              handleCancelGeneration();
              onAbortGeneration?.();
            }}>
              Abort
            </button>
          </>
        )}
      </div>

      {generationError && <p className="generation-error">{generationError}</p>}
    </div>
  );
}

export default function RecipeCard({ suggestion, members, onToggleShoppingList, inShoppingList }) {
  const { recipe, eligibleMembers, ineligibleMembers, missingIngredients, status } = suggestion;
  const missingNames = new Set(missingIngredients.map((ing) => ing.name));
  const memberName = (id) => members.find((m) => m.id === id)?.name ?? id;

  return (
    <article className="recipe-card">
      <header>
        <h3>{recipe.name}</h3>
        <span className={`badge badge-status-${status}`}>{status === 'ready' ? 'Ready now' : 'Almost there'}</span>
      </header>

      <ul className="ingredient-list">
        {recipe.ingredients.map((ing) => (
          <li key={ing.name} className={missingNames.has(ing.name) ? 'missing' : ''}>
            {ing.name}
          </li>
        ))}
      </ul>

      {ineligibleMembers.length > 0 && (
        <p className="muted">Not for: {ineligibleMembers.map(memberName).join(', ')}</p>
      )}
      {eligibleMembers.length > 0 && (
        <p className="muted">For: {eligibleMembers.map(memberName).join(', ')}</p>
      )}

      {status === 'almost' && (
        <button type="button" onClick={() => onToggleShoppingList(suggestion)}>
          {inShoppingList ? 'Remove from shopping list' : 'Add to shopping list'}
        </button>
      )}
    </article>
  );
}

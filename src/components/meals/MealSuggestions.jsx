import { useMemo, useState } from 'react';
import { suggestMeals, buildShoppingList } from '../../domain/matcher.js';
import RecipeCard from './RecipeCard.jsx';
import ShoppingList from './ShoppingList.jsx';

export default function MealSuggestions({ members, inventory, recipes }) {
  const [selectedMemberIds, setSelectedMemberIds] = useState(() => members.map((m) => m.id));
  const [shoppingListIds, setShoppingListIds] = useState(() => new Set());

  const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id));

  const { ready, almost } = useMemo(
    () => suggestMeals(selectedMembers, inventory, recipes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedMemberIds, inventory, recipes],
  );

  function toggleMember(id) {
    setSelectedMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function toggleShoppingList(suggestion) {
    setShoppingListIds((ids) => {
      const next = new Set(ids);
      if (next.has(suggestion.recipe.id)) next.delete(suggestion.recipe.id);
      else next.add(suggestion.recipe.id);
      return next;
    });
  }

  const shoppingListItems = buildShoppingList(almost.filter((s) => shoppingListIds.has(s.recipe.id)));

  return (
    <div className="meal-suggestions">
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

      {recipes.length === 0 && <p className="empty-state">No recipes yet.</p>}

      {ready.length > 0 && (
        <section>
          <h2>Ready to make now</h2>
          <div className="recipe-grid">
            {ready.map((s) => (
              <RecipeCard key={s.recipe.id} suggestion={s} members={members} onToggleShoppingList={() => {}} />
            ))}
          </div>
        </section>
      )}

      {almost.length > 0 && (
        <section>
          <h2>Almost there</h2>
          <div className="recipe-grid">
            {almost.map((s) => (
              <RecipeCard
                key={s.recipe.id}
                suggestion={s}
                members={members}
                onToggleShoppingList={toggleShoppingList}
                inShoppingList={shoppingListIds.has(s.recipe.id)}
              />
            ))}
          </div>
        </section>
      )}

      <ShoppingList items={shoppingListItems} />
    </div>
  );
}

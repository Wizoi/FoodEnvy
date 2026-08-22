export default function ShoppingList({ items }) {
  if (items.length === 0) return null;

  return (
    <aside className="shopping-list">
      <h3>Shopping list</h3>
      <ul>
        {items.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </aside>
  );
}

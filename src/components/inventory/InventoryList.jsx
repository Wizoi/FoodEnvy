export default function InventoryList({ items, onEdit, onDelete, onAddNew }) {
  return (
    <div className="inventory-list">
      {items.length === 0 && <p className="empty-state">No inventory yet — add what's in your kitchen.</p>}

      <ul>
        {items.map((item) => (
          <li key={item.id} className="inventory-card">
            {item.photoDataUrl && <img src={item.photoDataUrl} alt="" className="inventory-thumb" />}
            <div className="inventory-card-body">
              <strong>{item.name}</strong>
              <span className="muted">
                {item.quantity} {item.unit} · {item.category}
              </span>
            </div>
            <div>
              <button type="button" onClick={() => onEdit(item)}>
                Edit
              </button>
              <button type="button" onClick={() => onDelete(item.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" onClick={onAddNew}>
        + Add item
      </button>
    </div>
  );
}

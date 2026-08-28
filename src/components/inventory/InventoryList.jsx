import { useRef } from 'react';
import { downloadJson, readJsonFile } from '../../lib/jsonFile.js';

export default function InventoryList({ items, onEdit, onDelete, onAddNew, onImport, onGoToPlan }) {
  const fileInputRef = useRef(null);

  function handleExport() {
    downloadJson(`foodenvy-inventory-${new Date().toISOString().slice(0, 10)}.json`, {
      foodEnvyInventoryExport: true,
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
    });
  }

  function handleImportFile(e) {
    readJsonFile(
      e.target,
      (data) => {
        if (!Array.isArray(data.items)) throw new Error('No items found in file.');
        // Strip ids so each imported item is saved as new rather than
        // silently overwriting an existing item that happens to share an id
        // from a different device/export.
        onImport(data.items.map(({ id: _id, ...rest }) => rest));
      },
      (err) => window.alert(`Could not import inventory: ${err.message}`),
    );
  }

  return (
    <div className="inventory-list">
      {items.length === 0 && <p className="empty-state">No inventory yet — add what's in your kitchen.</p>}

      {items.length > 0 && (
        <div className="plan-cta">
          <span>
            You have {items.length} item{items.length === 1 ? '' : 's'} in stock.
          </span>
          <button type="button" className="primary" onClick={onGoToPlan}>
            Plan my week
          </button>
        </div>
      )}

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

      <div className="profile-list-actions">
        <button type="button" onClick={onAddNew}>
          + Add item
        </button>
        <button type="button" onClick={handleExport} disabled={items.length === 0}>
          Export inventory
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Import inventory
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} hidden />
      </div>
    </div>
  );
}

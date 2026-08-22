import { useState } from 'react';
import CameraCapture from './CameraCapture.jsx';

const CATEGORIES = ['produce', 'dairy', 'meat', 'pantry', 'frozen', 'other'];

export default function InventoryItemForm({ initialItem, onSave, onCancel }) {
  const [name, setName] = useState(initialItem?.name ?? '');
  const [category, setCategory] = useState(initialItem?.category ?? CATEGORIES[0]);
  const [quantity, setQuantity] = useState(initialItem?.quantity ?? 1);
  const [unit, setUnit] = useState(initialItem?.unit ?? '');
  const [photoDataUrl, setPhotoDataUrl] = useState(initialItem?.photoDataUrl);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      ...initialItem,
      name: name.trim(),
      category,
      quantity: Number(quantity) || 0,
      unit: unit.trim(),
      photoDataUrl,
    });
  }

  return (
    <form className="inventory-form" onSubmit={handleSubmit}>
      <label>
        Item name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. eggs" required />
      </label>

      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <div className="quantity-row">
        <label>
          Quantity
          <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label>
          Unit
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. lbs, cans" />
        </label>
      </div>

      <CameraCapture photoDataUrl={photoDataUrl} onCapture={setPhotoDataUrl} />

      <div className="form-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

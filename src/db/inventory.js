import { getAll, put, remove, STORES } from './database.js';

export function listInventory() {
  return getAll(STORES.INVENTORY);
}

export function saveInventoryItem(item) {
  const record = item.id
    ? item
    : { ...item, id: crypto.randomUUID(), addedDate: new Date().toISOString() };
  return put(STORES.INVENTORY, record).then(() => record);
}

export function deleteInventoryItem(id) {
  return remove(STORES.INVENTORY, id);
}

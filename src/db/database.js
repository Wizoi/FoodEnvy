// Thin promise wrapper around IndexedDB. One database, one object store per
// domain concept (members, inventory, recipes), all keyed by `id`. Kept
// generic here; domain-specific behavior (like seeding recipes) lives in the
// sibling profiles.js/inventory.js/recipes.js files.

const DB_NAME = 'foodenvy';
const DB_VERSION = 2;
export const STORES = { MEMBERS: 'members', INVENTORY: 'inventory', RECIPES: 'recipes', PLANS: 'plannedWeeks' };

let dbPromise = null;

export function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function withStore(storeName, mode, callback) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = callback(store);
        tx.oncomplete = () => resolve(result?.result);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export function getAll(storeName) {
  return withStore(storeName, 'readonly', (store) => store.getAll());
}

export function get(storeName, id) {
  return withStore(storeName, 'readonly', (store) => store.get(id));
}

export function put(storeName, item) {
  return withStore(storeName, 'readwrite', (store) => store.put(item));
}

export function remove(storeName, id) {
  return withStore(storeName, 'readwrite', (store) => store.delete(id));
}

export function count(storeName) {
  return withStore(storeName, 'readonly', (store) => store.count());
}

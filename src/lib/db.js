// Tiny IndexedDB wrapper. Stores: trips (by id), files (Blob by id), kv (settings etc).
const DB_NAME = 'jalan';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('trips')) db.createObjectStore('trips', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const s = tx.objectStore(store);
        const req = fn(s);
        tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export const db = {
  allTrips: () => run('trips', 'readonly', (s) => s.getAll()),
  putTrip: (trip) => run('trips', 'readwrite', (s) => s.put(trip)),
  deleteTrip: (id) => run('trips', 'readwrite', (s) => s.delete(id)),
  clearTrips: () => run('trips', 'readwrite', (s) => s.clear()),

  getFile: (id) => run('files', 'readonly', (s) => s.get(id)),
  putFile: (id, blob) => run('files', 'readwrite', (s) => s.put(blob, id)),
  deleteFile: (id) => run('files', 'readwrite', (s) => s.delete(id)),
  allFileKeys: () => run('files', 'readonly', (s) => s.getAllKeys()),
  clearFiles: () => run('files', 'readwrite', (s) => s.clear()),

  get: (key) => run('kv', 'readonly', (s) => s.get(key)),
  set: (key, value) => run('kv', 'readwrite', (s) => s.put(value, key)),
};

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 18);

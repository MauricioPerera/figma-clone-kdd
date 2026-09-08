const DATABASE = 'figma_clone_kdd';
const TABLE = 'projects';
const KEY = 'current';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(TABLE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked.'));
  });
}

async function transaction(mode, operate) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(TABLE, mode);
      const request = operate(tx.objectStore(TABLE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error || request.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
    });
  } finally { database.close(); }
}

export const supportsDurableStorage = () => typeof indexedDB !== 'undefined';
export const readProject = () => transaction('readonly', store => store.get(KEY));
export const writeProject = payload => transaction('readwrite', store => store.put(payload, KEY));

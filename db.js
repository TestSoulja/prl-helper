/**
 * Вторая копия данных — IndexedDB. Нужна, потому что localStorage
 * система может вычистить, а вместе с ним уйдёт дневник.
 *
 * Все функции молчат: если IndexedDB недоступна (приватный режим,
 * старый движок, запрет), приложение продолжает жить на localStorage.
 */

const DB_NAME = 'opora';
const STORE = 'kv';
const KEY = 'data';

let opened = null;

function openDb() {
  if (opened) return opened;

  opened = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('нет IndexedDB'));
      return;
    }

    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      reject(e);
      return;
    }

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB не открылась'));
    req.onblocked = () => reject(new Error('IndexedDB занята'));
  }).catch((e) => {
    opened = null;
    throw e;
  });

  return opened;
}

function run(mode, action) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        let tx;
        try {
          tx = db.transaction(STORE, mode);
        } catch (e) {
          reject(e);
          return;
        }
        const req = action(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('ошибка IndexedDB'));
        tx.onabort = () => reject(tx.error || new Error('транзакция прервана'));
      }),
  );
}

/** Вторая копия или null. Никогда не бросает. */
export async function readData() {
  try {
    const value = await run('readonly', (s) => s.get(KEY));
    return value ?? null;
  } catch {
    return null;
  }
}

/** Записать вторую копию. true — записалось. Никогда не бросает. */
export async function writeData(value) {
  try {
    await run('readwrite', (s) => s.put(value, KEY));
    return true;
  } catch {
    return false;
  }
}

/** Стереть вторую копию (для «стереть всё»). */
export async function clearData() {
  try {
    await run('readwrite', (s) => s.delete(KEY));
    return true;
  } catch {
    return false;
  }
}

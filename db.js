// Archivio locale dei prodotti (IndexedDB, tutto sul telefono).
// Ogni prodotto occupa poche centinaia di byte: 1000 prodotti ≈ 300 KB.
// Le foto NON vengono salvate, solo il loro indirizzo web.
const DB = (() => {
  const NAME = 'mipiace';
  const STORE = 'products';
  let dbPromise;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(NAME, 1);
        req.onupgradeneeded = () => {
          const store = req.result.createObjectStore(STORE, { keyPath: 'code' });
          store.createIndex('verdict', 'verdict');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const result = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
      t.onerror = () => reject(t.error);
    });
  }

  return {
    get: (code) => tx('readonly', (s) => s.get(code)),
    all: () => tx('readonly', (s) => s.getAll()),
    put: (product) => tx('readwrite', (s) => s.put(product)),
    remove: (code) => tx('readwrite', (s) => s.delete(code)),
    async putMany(products) {
      return tx('readwrite', (s) => { products.forEach((p) => s.put(p)); });
    },
  };
})();

// Chiede ad Android di non cancellare i dati in automatico.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DropshipDB extends DBSchema {
  sync_queue: {
    key: number;
    value: { id?: number; action: 'ADD_INVENTORY' | 'UPDATE_LISTING'; payload: any; timestamp: number; };
    indexes: { 'by-timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<DropshipDB>>;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<DropshipDB>('ispy-dropship-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
};

export const enqueueAction = async (action: 'ADD_INVENTORY' | 'UPDATE_LISTING', payload: any) => {
  const db = await initDB();
  await db.add('sync_queue', { action, payload, timestamp: Date.now() });
};

export const getQueue = async () => {
  const db = await initDB();
  return db.getAllFromIndex('sync_queue', 'by-timestamp');
};

export const dequeueAction = async (id: number) => {
  const db = await initDB();
  await db.delete('sync_queue', id);
};

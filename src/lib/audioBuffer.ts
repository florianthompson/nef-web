// Temporary on-device buffer for recordings that could not be transcribed (offline / error)
// and produced no on-device text. Audio is never sent anywhere except /api/notes/transcribe
// and is deleted as soon as its text has been recognised.

export type BufferedAudio = {
  id: string;
  segments: Blob[];
  mimeType: string;
  createdAt: number;
  durationMs: number;
};

const DB_NAME = "nef-notes";
const STORE = "audio-buffer";
const mem = new Map<string, BufferedAudio>(); // fallback if IndexedDB is unavailable

function idb<T>(fn: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode = "readwrite"): Promise<T> {
  return new Promise((resolve, reject) => {
    let q: IDBOpenDBRequest;
    try {
      q = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      return reject(e);
    }
    q.onupgradeneeded = () => {
      if (!q.result.objectStoreNames.contains(STORE)) {
        q.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    q.onerror = () => reject(q.error);
    q.onsuccess = () => {
      const db = q.result;
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(req.result);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

export async function bufferPut(b: BufferedAudio): Promise<void> {
  mem.set(b.id, b);
  await idb((s) => s.put(b)).catch(() => {});
}

export async function bufferDelete(id: string): Promise<void> {
  mem.delete(id);
  await idb((s) => s.delete(id)).catch(() => {});
}

export async function bufferAll(): Promise<BufferedAudio[]> {
  let rows: BufferedAudio[] = [];
  try {
    rows = (await idb((s) => s.getAll(), "readonly")) ?? [];
  } catch {
    // fall through to memory copy
  }
  mem.forEach((b) => {
    if (!rows.some((r) => r.id === b.id)) rows.push(b);
  });
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

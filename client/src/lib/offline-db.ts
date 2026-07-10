import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "glidr-offline";
const DB_VERSION = 2;

export interface QueuedMutation {
  id: string;
  method: string;
  url: string;
  body: string | null;
  timestamp: number;
  description: string;
}

// A queued change the server rejected (4xx) during sync. Kept — never silently
// dropped — so the user can see exactly what didn't make it and why.
export interface FailedMutation extends QueuedMutation {
  error: string;
  failedAt: number;
}

export interface CachedData {
  key: string;
  data: string;
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("mutations")) {
          db.createObjectStore("mutations", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("cache")) {
          db.createObjectStore("cache", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("failed")) {
          db.createObjectStore("failed", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function addMutation(mutation: QueuedMutation): Promise<void> {
  const db = await getDB();
  await db.put("mutations", mutation);
}

export async function getAllMutations(): Promise<QueuedMutation[]> {
  const db = await getDB();
  return db.getAll("mutations");
}

export async function removeMutation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("mutations", id);
}

export async function clearAllMutations(): Promise<void> {
  const db = await getDB();
  await db.clear("mutations");
}

export async function getMutationCount(): Promise<number> {
  const db = await getDB();
  return db.count("mutations");
}

// ── Failed writes (rejected by the server during sync) ───────────────────────
export async function addFailedMutation(f: FailedMutation): Promise<void> {
  const db = await getDB();
  await db.put("failed", f);
}

export async function getAllFailedMutations(): Promise<FailedMutation[]> {
  const db = await getDB();
  return db.getAll("failed");
}

export async function removeFailedMutation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("failed", id);
}

export async function getFailedCount(): Promise<number> {
  const db = await getDB();
  return db.count("failed");
}

export async function setCachedData(key: string, data: unknown): Promise<void> {
  const db = await getDB();
  await db.put("cache", {
    key,
    data: JSON.stringify(data),
    timestamp: Date.now(),
  });
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const db = await getDB();
  const entry = await db.get("cache", key);
  if (!entry) return null;
  try {
    return JSON.parse(entry.data) as T;
  } catch {
    return null;
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

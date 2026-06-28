import { createJSONStorage, type StateStorage } from "zustand/middleware";

type StorageKind = "localStorage" | "sessionStorage" | "memory";

const memoryStorage = new Map<string, string>();

let warned = false;
let resolvedStorage: StateStorage | null = null;

function warnOnce(message: string) {
  if (warned || typeof console === "undefined") return;
  warned = true;
  console.warn(message);
}

function probeStorage(candidate: Storage): boolean {
  try {
    const key = "__kora_storage_probe__";
    candidate.setItem(key, "1");
    candidate.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function getWindowStorage(kind: Exclude<StorageKind, "memory">): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const candidate = window[kind];
    return probeStorage(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function createInMemoryStorage(): StateStorage {
  return {
    getItem: (name) => memoryStorage.get(name) ?? null,
    setItem: (name, value) => {
      memoryStorage.set(name, value);
    },
    removeItem: (name) => {
      memoryStorage.delete(name);
    },
  };
}

function resolveStorage(): StateStorage {
  if (resolvedStorage) return resolvedStorage;

  const local = getWindowStorage("localStorage");
  if (local) {
    resolvedStorage = local;
    return resolvedStorage;
  }

  const session = getWindowStorage("sessionStorage");
  if (session) {
    warnOnce("[kora] localStorage unavailable, falling back to sessionStorage.");
    resolvedStorage = session;
    return resolvedStorage;
  }

  warnOnce("[kora] Browser storage unavailable, using in-memory fallback.");
  resolvedStorage = createInMemoryStorage();
  return resolvedStorage;
}

export function safeStorageGetItem(key: string): string | null {
  try {
    return resolveStorage().getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSetItem(key: string, value: string): void {
  try {
    resolveStorage().setItem(key, value);
  } catch {
    // no-op: keep runtime stable when storage writes are blocked
  }
}

export function safeStorageRemoveItem(key: string): void {
  try {
    resolveStorage().removeItem(key);
  } catch {
    // no-op: keep runtime stable when storage writes are blocked
  }
}

export function createPersistentJSONStorage() {
  return createJSONStorage(() => resolveStorage());
}

export function __resetStorageAdapterForTests() {
  warned = false;
  resolvedStorage = null;
  memoryStorage.clear();
}
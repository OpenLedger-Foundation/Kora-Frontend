export type PersistStorage = {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

const memoryStorage = new Map<string, string>();
const STORAGE_TEST_KEY = "__kora_storage_test__";

export function createFallbackStorage(): PersistStorage {
  return {
    getItem(name) {
      if (typeof window === "undefined") return null;

      try {
        const localValue = window.localStorage.getItem(name);
        if (localValue !== null) return localValue;
      } catch {
        // ignore
      }

      try {
        const sessionValue = window.sessionStorage.getItem(name);
        if (sessionValue !== null) return sessionValue;
      } catch {
        // ignore
      }

      return memoryStorage.get(name) ?? null;
    },
    setItem(name, value) {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(name, value);
          return;
        } catch {
          // fall through
        }
        try {
          window.sessionStorage.setItem(name, value);
          return;
        } catch {
          // fall through
        }
      }
      memoryStorage.set(name, value);
    },
    removeItem(name) {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(name);
        } catch {
          // ignore
        }
        try {
          window.sessionStorage.removeItem(name);
        } catch {
          // ignore
        }
      }
      memoryStorage.delete(name);
    },
  };
}

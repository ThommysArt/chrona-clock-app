import { Platform } from "react-native";

type KeyValueStorage = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  delete: (key: string) => void;
};

const memory = new Map<string, string>();

const memoryStorage: KeyValueStorage = {
  getString: (key) => memory.get(key),
  set: (key, value) => {
    memory.set(key, value);
  },
  delete: (key) => {
    memory.delete(key);
  },
};

function createWebStorage(): KeyValueStorage {
  if (typeof localStorage === "undefined") {
    return memoryStorage;
  }

  return {
    getString: (key) => localStorage.getItem(key) ?? undefined,
    set: (key, value) => {
      localStorage.setItem(key, value);
    },
    delete: (key) => {
      localStorage.removeItem(key);
    },
  };
}

function createNativeStorage(): KeyValueStorage {
  try {
    // MMKV is native-only (Nitro). Fail soft so Expo web / Expo Go still run.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require("react-native-mmkv") as {
      createMMKV: (options?: { id?: string }) => {
        getString: (key: string) => string | undefined;
        set: (key: string, value: string | number | boolean) => void;
        remove: (key: string) => boolean;
      };
    };
    const mmkv = createMMKV({ id: "chrona" });
    return {
      getString: (key) => mmkv.getString(key),
      set: (key, value) => {
        mmkv.set(key, value);
      },
      delete: (key) => {
        mmkv.remove(key);
      },
    };
  } catch {
    return memoryStorage;
  }
}

export const storage: KeyValueStorage =
  Platform.OS === "web" ? createWebStorage() : createNativeStorage();

export function loadJson<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

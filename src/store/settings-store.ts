import { create } from "zustand";

import { STORAGE_KEYS } from "@/lib/constants";
import { loadJson, saveJson } from "@/lib/storage";

export type ThemePreference = "light" | "dark" | "system";

type SettingsState = {
  use24Hour: boolean;
  theme: ThemePreference;
  setUse24Hour: (value: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
};

type PersistedSettings = {
  use24Hour: boolean;
  theme: ThemePreference;
};

const defaults: PersistedSettings = {
  use24Hour: true,
  theme: "system",
};

const loaded = loadJson<PersistedSettings>(STORAGE_KEYS.settings, defaults);

export const useSettingsStore = create<SettingsState>((set, get) => ({
  use24Hour: loaded.use24Hour ?? true,
  theme: loaded.theme ?? "system",

  setUse24Hour: (value) => {
    const next = { use24Hour: value, theme: get().theme };
    saveJson(STORAGE_KEYS.settings, next);
    set({ use24Hour: value });
  },

  setTheme: (theme) => {
    const next = { use24Hour: get().use24Hour, theme };
    saveJson(STORAGE_KEYS.settings, next);
    set({ theme });
  },
}));

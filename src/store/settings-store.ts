import { create } from "zustand";

import * as db from "@/lib/db";
import type { AppSettings, ThemePreference } from "@/lib/db";

export type { ThemePreference };

type SettingsState = {
  use24Hour: boolean;
  theme: ThemePreference;
  ready: boolean;
  setUse24Hour: (value: boolean) => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
};

const defaults: AppSettings = {
  use24Hour: true,
  theme: "system",
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  use24Hour: defaults.use24Hour,
  theme: defaults.theme,
  ready: false,

  setUse24Hour: async (value) => {
    const prev = get().use24Hour;
    set({ use24Hour: value });
    try {
      await db.saveSettings({ use24Hour: value, theme: get().theme });
    } catch (e) {
      console.warn("[chrona] failed to persist use24Hour", e);
      set({ use24Hour: prev });
    }
  },

  setTheme: async (theme) => {
    const prev = get().theme;
    set({ theme });
    try {
      await db.saveSettings({ use24Hour: get().use24Hour, theme });
    } catch (e) {
      console.warn("[chrona] failed to persist theme", e);
      set({ theme: prev });
    }
  },
}));

export async function hydrateSettingsStore(
  snapshot?: AppSettings
): Promise<void> {
  const next = snapshot ?? (await db.loadSettings());
  useSettingsStore.setState({
    use24Hour: next.use24Hour ?? true,
    theme: next.theme ?? "system",
    ready: true,
  });
}

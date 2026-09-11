import { type CityDefinition, DEFAULT_CITIES } from "@/lib/constants";

export type ThemePreference = "light" | "dark" | "system";

export type AppSettings = {
  use24Hour: boolean;
  theme: ThemePreference;
};

type StoredCity = CityDefinition & { isCustom?: boolean; sortOrder: number };

export type ReminderRow = {
  id: string;
  cityId: string;
  cityLabel: string;
  timezone: string;
  targetEpochMs: number;
  title: string;
  note: string;
  createdAtMs: number;
  notificationId: string | null;
  calendarEventId: string | null;
  notifyEnabled: boolean;
  calendarEnabled: boolean;
  fired: boolean;
};

type WebDbShape = {
  cities: StoredCity[];
  settings: AppSettings;
  offsetMs: number;
  meta: Record<string, string>;
  reminders: ReminderRow[];
};

const STORAGE_KEY = "chrona.db.v1";

function defaults(): WebDbShape {
  return {
    cities: DEFAULT_CITIES.map((c, i) => ({
      ...c,
      isCustom: false,
      sortOrder: i,
    })),
    settings: { use24Hour: true, theme: "system" },
    offsetMs: 0,
    meta: {},
    reminders: [],
  };
}

function readStorage(): WebDbShape {
  const base = defaults();
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<WebDbShape>;
    return {
      cities: Array.isArray(parsed.cities) ? parsed.cities : base.cities,
      settings: { ...base.settings, ...parsed.settings },
      offsetMs:
        typeof parsed.offsetMs === "number" && Number.isFinite(parsed.offsetMs)
          ? parsed.offsetMs
          : 0,
      meta: parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {},
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
    };
  } catch {
    return base;
  }
}

function writeStorage(state: WebDbShape): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota — app keeps running on in-memory state.
  }
}

function sortedCities(cities: StoredCity[]): (CityDefinition & { isCustom?: boolean })[] {
  return [...cities]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map(({ sortOrder: _sortOrder, ...rest }) => rest);
}

export async function listSavedCities(): Promise<(CityDefinition & { isCustom?: boolean })[]> {
  return sortedCities(readStorage().cities);
}

export async function listCustomPlaces(): Promise<CityDefinition[]> {
  return readStorage()
    .cities.filter((c) => c.isCustom)
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(({ sortOrder: _sortOrder, ...rest }) => rest);
}

export async function replaceSavedCities(
  cities: (CityDefinition & { isCustom?: boolean })[]
): Promise<void> {
  const state = readStorage();
  state.cities = cities.map((c, i) => ({ ...c, sortOrder: i }));
  writeStorage(state);
}

export async function insertSavedCity(
  city: CityDefinition & { isCustom?: boolean },
  sortOrder: number
): Promise<void> {
  const state = readStorage();
  state.cities = state.cities.filter((c) => c.id !== city.id);
  state.cities.push({ ...city, sortOrder });
  writeStorage(state);
}

export async function deleteSavedCity(id: string): Promise<void> {
  const state = readStorage();
  state.cities = state.cities.filter((c) => c.id !== id);
  writeStorage(state);
}

export async function updateCityCoords(
  id: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const state = readStorage();
  const city = state.cities.find((c) => c.id === id);
  if (city) {
    city.latitude = latitude;
    city.longitude = longitude;
    writeStorage(state);
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const state = readStorage();
  if (key === "use24Hour") return String(state.settings.use24Hour);
  if (key === "theme") return state.settings.theme;
  if (key === "offsetMs") return String(state.offsetMs);
  return state.meta[key] ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const state = readStorage();
  if (key === "use24Hour") {
    state.settings.use24Hour = value === "true";
  } else if (key === "theme" && (value === "light" || value === "dark" || value === "system")) {
    state.settings.theme = value;
  } else if (key === "offsetMs") {
    const n = Number(value);
    state.offsetMs = Number.isFinite(n) ? n : 0;
  } else {
    state.meta[key] = value;
  }
  writeStorage(state);
}

export async function loadSettings(): Promise<AppSettings> {
  return readStorage().settings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const state = readStorage();
  state.settings = settings;
  writeStorage(state);
}

export async function loadOffsetMs(): Promise<number> {
  return readStorage().offsetMs;
}

export async function saveOffsetMs(offsetMs: number): Promise<void> {
  const state = readStorage();
  state.offsetMs = offsetMs;
  writeStorage(state);
}

export async function getMeta(key: string): Promise<string | null> {
  return readStorage().meta[key] ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const state = readStorage();
  state.meta[key] = value;
  writeStorage(state);
}

/** Open DB, seed defaults on first run, return current rows.
 * Call once at app boot before rendering main UI.
 */
export async function bootstrapDatabase(): Promise<{
  cities: (CityDefinition & { isCustom?: boolean })[];
  customPlaces: CityDefinition[];
  settings: AppSettings;
  offsetMs: number;
}> {
  const state = readStorage();

  if (!state.meta.seeded_v1) {
    if (state.cities.length === 0) {
      state.cities = defaults().cities;
    }
    state.meta.seeded_v1 = "1";
    writeStorage(state);
  }

  const [cities, customPlaces, settings, offsetMs] = await Promise.all([
    listSavedCities(),
    listCustomPlaces(),
    loadSettings(),
    loadOffsetMs(),
  ]);

  return { cities, customPlaces, settings, offsetMs };
}

export async function listReminders(): Promise<ReminderRow[]> {
  return [...readStorage().reminders].sort((a, b) => a.targetEpochMs - b.targetEpochMs);
}

export async function insertReminder(row: ReminderRow): Promise<void> {
  const state = readStorage();
  state.reminders = state.reminders.filter((r) => r.id !== row.id);
  state.reminders.push(row);
  writeStorage(state);
}

export async function updateReminder(id: string, patch: Partial<ReminderRow>): Promise<void> {
  const state = readStorage();
  state.reminders = state.reminders.map((r) => (r.id === id ? { ...r, ...patch, id } : r));
  writeStorage(state);
}

export async function deleteReminder(id: string): Promise<void> {
  const state = readStorage();
  state.reminders = state.reminders.filter((r) => r.id !== id);
  writeStorage(state);
}

export async function deleteRemindersForCity(cityId: string): Promise<void> {
  const state = readStorage();
  state.reminders = state.reminders.filter((r) => r.cityId !== cityId);
  writeStorage(state);
}

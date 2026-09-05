import * as SQLite from "expo-sqlite";

import {
  type CityDefinition,
  DEFAULT_CITIES,
} from "@/lib/constants";

export type ThemePreference = "light" | "dark" | "system";

export type AppSettings = {
  use24Hour: boolean;
  theme: ThemePreference;
};

type CityRow = {
  id: string;
  label: string;
  region: string;
  timezone: string;
  latitude: number;
  longitude: number;
  sort_order: number;
  is_custom: number;
};

const DB_NAME = "chrona.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS saved_cities (
          id TEXT PRIMARY KEY NOT NULL,
          label TEXT NOT NULL,
          region TEXT NOT NULL,
          timezone TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          sort_order INTEGER NOT NULL,
          is_custom INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

function rowToCity(row: CityRow): CityDefinition & { isCustom?: boolean } {
  return {
    id: row.id,
    label: row.label,
    region: row.region,
    timezone: row.timezone,
    latitude: row.latitude,
    longitude: row.longitude,
    ...(row.is_custom ? { isCustom: true } : {}),
  };
}

export async function listSavedCities(): Promise<
  (CityDefinition & { isCustom?: boolean })[]
> {
  const db = await getDb();
  const rows = await db.getAllAsync<CityRow>(
    `SELECT id, label, region, timezone, latitude, longitude, sort_order, is_custom
     FROM saved_cities
     ORDER BY sort_order ASC, label ASC`
  );
  return rows.map(rowToCity);
}

export async function listCustomPlaces(): Promise<CityDefinition[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CityRow>(
    `SELECT id, label, region, timezone, latitude, longitude, sort_order, is_custom
     FROM saved_cities
     WHERE is_custom = 1
     ORDER BY label ASC`
  );
  return rows.map(rowToCity);
}

export async function replaceSavedCities(
  cities: (CityDefinition & { isCustom?: boolean })[]
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM saved_cities`);
    for (let i = 0; i < cities.length; i++) {
      const c = cities[i]!;
      await db.runAsync(
        `INSERT INTO saved_cities
          (id, label, region, timezone, latitude, longitude, sort_order, is_custom)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id,
        c.label,
        c.region,
        c.timezone,
        c.latitude,
        c.longitude,
        i,
        c.isCustom ? 1 : 0
      );
    }
  });
}

export async function insertSavedCity(
  city: CityDefinition & { isCustom?: boolean },
  sortOrder: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO saved_cities
      (id, label, region, timezone, latitude, longitude, sort_order, is_custom)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    city.id,
    city.label,
    city.region,
    city.timezone,
    city.latitude,
    city.longitude,
    sortOrder,
    city.isCustom ? 1 : 0
  );
}

export async function deleteSavedCity(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM saved_cities WHERE id = ?`, id);
}

export async function updateCityCoords(
  id: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE saved_cities SET latitude = ?, longitude = ? WHERE id = ?`,
    latitude,
    longitude,
    id
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    key
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value
  );
}

export async function loadSettings(): Promise<AppSettings> {
  const use24 = await getSetting("use24Hour");
  const theme = await getSetting("theme");
  return {
    use24Hour: use24 == null ? true : use24 === "true",
    theme:
      theme === "light" || theme === "dark" || theme === "system"
        ? theme
        : "system",
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await setSetting("use24Hour", settings.use24Hour ? "true" : "false");
  await setSetting("theme", settings.theme);
}

export async function loadOffsetMs(): Promise<number> {
  const raw = await getSetting("offsetMs");
  if (raw == null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function saveOffsetMs(offsetMs: number): Promise<void> {
  await setSetting("offsetMs", String(offsetMs));
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM meta WHERE key = ?`,
    key
  );
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value
  );
}

/**
 * Open DB, seed defaults on first run, return current rows.
 * Call once at app boot before rendering main UI.
 */
export async function bootstrapDatabase(): Promise<{
  cities: (CityDefinition & { isCustom?: boolean })[];
  customPlaces: CityDefinition[];
  settings: AppSettings;
  offsetMs: number;
}> {
  await getDb();

  const seeded = await getMeta("seeded_v1");
  let cities = await listSavedCities();

  if (!seeded && cities.length === 0) {
    const defaults = DEFAULT_CITIES.map((c) => ({ ...c, isCustom: false }));
    await replaceSavedCities(defaults);
    await setMeta("seeded_v1", "1");
    cities = await listSavedCities();
  } else if (!seeded) {
    await setMeta("seeded_v1", "1");
  }

  const [customPlaces, settings, offsetMs] = await Promise.all([
    listCustomPlaces(),
    loadSettings(),
    loadOffsetMs(),
  ]);

  return { cities, customPlaces, settings, offsetMs };
}

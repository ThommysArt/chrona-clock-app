import { create } from "zustand";

import {
  enrichCityCoords,
  hasSuspiciousCoords,
  makeCityId,
  resolvePlaceCoords,
} from "@/lib/cities";
import { type CityDefinition, DEFAULT_CITIES } from "@/lib/constants";
import * as db from "@/lib/db";
import { syncHomeScreenWidgets } from "@/widgets/sync-widgets";

function queueSyncWidgets(): void {
  void syncHomeScreenWidgets().catch(() => undefined);
}

type CitiesState = {
  cities: CityDefinition[];
  /** User-created places that may not exist in the geo catalog */
  customPlaces: CityDefinition[];
  ready: boolean;
  addCity: (city: CityDefinition) => Promise<void>;
  removeCity: (id: string) => Promise<void>;
  reorder: (fromIndex: number, toIndex: number) => Promise<void>;
  hasCity: (id: string) => boolean;
  /**
   * Create a custom place (name + region + timezone). Coords are resolved
   * automatically from the geo database — no manual lat/lon required.
   */
  createCustomPlace: (input: {
    label: string;
    region?: string;
    timezone: string;
  }) => Promise<CityDefinition | null>;
};

const defaultList: CityDefinition[] = DEFAULT_CITIES.map((c) => ({ ...c }));

function isDuplicate(cities: CityDefinition[], city: CityDefinition): boolean {
  return cities.some(
    (c) =>
      c.id === city.id ||
      (c.timezone === city.timezone &&
        c.label.toLowerCase() === city.label.toLowerCase())
  );
}

function withCustomFlag(
  city: CityDefinition,
  isCustom: boolean
): CityDefinition & { isCustom?: boolean } {
  return isCustom ? { ...city, isCustom: true } : { ...city };
}

export const useCitiesStore = create<CitiesState>((set, get) => ({
  cities: defaultList,
  customPlaces: [],
  ready: false,

  addCity: async (city) => {
    const { cities } = get();
    if (isDuplicate(cities, city)) return;

    const next = [...cities, city];
    set({ cities: next });
    try {
      await db.insertSavedCity(withCustomFlag(city, false), next.length - 1);
      queueSyncWidgets();
    } catch (e) {
      console.warn("[chrona] failed to persist addCity", e);
      set({ cities });
    }
  },

  removeCity: async (id) => {
    const prev = get().cities;
    const next = prev.filter((c) => c.id !== id);
    const nextCustom = get().customPlaces.filter((c) => c.id !== id);
    set({ cities: next, customPlaces: nextCustom });
    try {
      await db.deleteSavedCity(id);
      // Keep sort_order dense
      await db.replaceSavedCities(
        next.map((c) =>
          withCustomFlag(
            c,
            nextCustom.some((x) => x.id === c.id)
          )
        )
      );
      queueSyncWidgets();
    } catch (e) {
      console.warn("[chrona] failed to persist removeCity", e);
      set({ cities: prev });
    }
  },

  reorder: async (fromIndex, toIndex) => {
    const prev = get().cities;
    const next = [...prev];
    const [item] = next.splice(fromIndex, 1);
    if (!item) return;
    next.splice(toIndex, 0, item);
    const customIds = new Set(get().customPlaces.map((c) => c.id));
    set({ cities: next });
    try {
      await db.replaceSavedCities(
        next.map((c) => withCustomFlag(c, customIds.has(c.id)))
      );
      queueSyncWidgets();
    } catch (e) {
      console.warn("[chrona] failed to persist reorder", e);
      set({ cities: prev });
    }
  },

  hasCity: (id) => get().cities.some((c) => c.id === id),

  createCustomPlace: async (input) => {
    const label = input.label.trim();
    const region = (input.region ?? "").trim();
    const timezone = input.timezone.trim();
    if (!label || !timezone) return null;

    const coords = resolvePlaceCoords({ label, region, timezone });
    const id = `custom-${makeCityId(label, timezone)}-${Date.now().toString(36)}`;

    const city: CityDefinition = {
      id,
      label,
      region: region || coords.matchedLabel || timezone,
      timezone,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };

    const { cities, customPlaces } = get();
    if (isDuplicate(cities, city)) return null;

    const nextCustom = isDuplicate(customPlaces, city)
      ? customPlaces
      : [...customPlaces, city];
    const nextCities = [...cities, city];

    set({ cities: nextCities, customPlaces: nextCustom });
    try {
      await db.insertSavedCity(
        withCustomFlag(city, true),
        nextCities.length - 1
      );
      queueSyncWidgets();
    } catch (e) {
      console.warn("[chrona] failed to persist createCustomPlace", e);
      set({ cities, customPlaces });
      return null;
    }
    return city;
  },
}));

/**
 * Load cities from SQLite and fix known-bad coordinates from the old
 * "equator + offset" approximation.
 */
export async function hydrateCitiesStore(snapshot?: {
  cities: (CityDefinition & { isCustom?: boolean })[];
  customPlaces: CityDefinition[];
}): Promise<void> {
  const cities = snapshot?.cities ?? (await db.listSavedCities());
  const customPlaces = snapshot?.customPlaces ?? (await db.listCustomPlaces());
  const customIds = new Set(customPlaces.map((c) => c.id));

  let changed = false;
  const fixed: CityDefinition[] = cities.map((city) => {
    const base: CityDefinition = {
      id: city.id,
      label: city.label,
      region: city.region,
      timezone: city.timezone,
      latitude: city.latitude,
      longitude: city.longitude,
    };
    if (!hasSuspiciousCoords(base)) return base;
    const enriched = enrichCityCoords(base);
    if (!enriched) return base;
    changed = true;
    return { ...base, ...enriched };
  });

  const fixedCustom = customPlaces.map((c) => {
    if (!hasSuspiciousCoords(c)) return c;
    const enriched = enrichCityCoords(c);
    return enriched ? { ...c, ...enriched } : c;
  });

  if (changed) {
    await db.replaceSavedCities(
      fixed.map((c) =>
        withCustomFlag(c, customIds.has(c.id) || c.id.startsWith("custom-"))
      )
    );
  }

  useCitiesStore.setState({
    cities: fixed,
    customPlaces: fixedCustom,
    ready: true,
  });
  queueSyncWidgets();
}

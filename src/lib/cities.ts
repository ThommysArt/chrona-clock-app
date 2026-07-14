import { getTimeZones } from "@vvo/tzdb";

import {
  type CityDefinition,
  POPULAR_CITIES,
} from "@/lib/constants";

export type SearchableCity = CityDefinition & {
  countryName?: string;
  searchText: string;
};

const popularByTimezone = new Map(
  POPULAR_CITIES.map((c) => [c.timezone + "|" + c.label.toLowerCase(), c])
);

let cachedCatalog: SearchableCity[] | null = null;

/** Build searchable catalog from tzdb + curated popular cities */
export function getCityCatalog(): SearchableCity[] {
  if (cachedCatalog) return cachedCatalog;

  const fromPopular: SearchableCity[] = POPULAR_CITIES.map((c) => ({
    ...c,
    searchText: `${c.label} ${c.region} ${c.timezone}`.toLowerCase(),
  }));

  const seen = new Set(fromPopular.map((c) => c.id));
  const fromTzdb: SearchableCity[] = [];

  for (const tz of getTimeZones()) {
    for (const city of tz.mainCities) {
      const key = `${tz.name}|${city.toLowerCase()}`;
      const popular = popularByTimezone.get(key);
      if (popular) continue;

      const id = `${city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${tz.name}`;
      if (seen.has(id)) continue;
      seen.add(id);

      // Approximate coords from raw offset band when unknown (equator strip)
      const approxLon = (tz.currentTimeOffsetInMinutes / 60) * 15;
      fromTzdb.push({
        id,
        label: city,
        region: tz.countryName,
        timezone: tz.name,
        latitude: 0,
        longitude: approxLon,
        countryName: tz.countryName,
        searchText: `${city} ${tz.countryName} ${tz.name} ${tz.abbreviation}`.toLowerCase(),
      });
    }
  }

  // Popular first, then rest of world
  cachedCatalog = [...fromPopular, ...fromTzdb];
  return cachedCatalog;
}

export function searchCities(query: string, limit = 40): SearchableCity[] {
  const q = query.trim().toLowerCase();
  const catalog = getCityCatalog();
  if (!q) {
    return catalog.slice(0, limit);
  }

  const starts: SearchableCity[] = [];
  const contains: SearchableCity[] = [];

  for (const city of catalog) {
    if (city.label.toLowerCase().startsWith(q)) {
      starts.push(city);
    } else if (city.searchText.includes(q)) {
      contains.push(city);
    }
    if (starts.length + contains.length >= limit * 2) break;
  }

  return [...starts, ...contains].slice(0, limit);
}

export function findCityById(id: string): CityDefinition | undefined {
  return getCityCatalog().find((c) => c.id === id);
}

export function findCityByTimezone(timezone: string): CityDefinition | undefined {
  return (
    POPULAR_CITIES.find((c) => c.timezone === timezone) ??
    getCityCatalog().find((c) => c.timezone === timezone)
  );
}

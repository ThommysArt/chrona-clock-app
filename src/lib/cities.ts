import {
  cityMapping,
  findFromCityStateProvince,
  lookupViaCity,
} from "city-timezones";
import { getTimeZones } from "@vvo/tzdb";

import {
  type CityDefinition,
  POPULAR_CITIES,
} from "@/lib/constants";

/** Subset of city-timezones CityData we rely on */
type GeoCity = {
  lat: number;
  lng: number;
  pop: number;
  city: string;
  city_ascii: string;
  country: string;
  timezone: string;
  province?: string;
  state_ansi?: string;
  iso2?: string;
};

export type SearchableCity = CityDefinition & {
  countryName?: string;
  searchText: string;
  custom?: boolean;
  population?: number;
};

export type TimezoneOption = {
  name: string;
  countryName: string;
  abbreviation: string;
  mainCities: string[];
  searchText: string;
};

const popularById = new Map<string, CityDefinition>(
  POPULAR_CITIES.map((c) => [c.id, { ...c }])
);

let cachedCatalog: SearchableCity[] | null = null;
let cachedTimezones: TimezoneOption[] | null = null;
/** Largest city (by pop) per IANA timezone — used for coord fallbacks */
let primaryByTimezone: Map<string, GeoCity> | null = null;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function regionFromCity(c: GeoCity): string {
  const province = c.province?.trim();
  const country = c.country?.trim() || "";
  if (c.iso2 === "US" && c.state_ansi) {
    return `${c.state_ansi}, United States`;
  }
  if (province && country) {
    // Avoid "Berlin, Germany" style duplication when province === city name context
    if (province.toLowerCase() === country.toLowerCase()) return country;
    return `${province}, ${country}`;
  }
  return country || c.timezone;
}

function toSearchableFromGeo(c: GeoCity): SearchableCity {
  const id = `${slugify(c.city_ascii || c.city)}-${c.timezone}`;
  const region = regionFromCity(c);
  return {
    id,
    label: c.city,
    region,
    timezone: c.timezone,
    latitude: c.lat,
    longitude: c.lng,
    countryName: c.country,
    population: c.pop,
    searchText:
      `${c.city} ${c.city_ascii} ${region} ${c.country} ${c.province ?? ""} ${c.state_ansi ?? ""} ${c.timezone}`.toLowerCase(),
  };
}

function getPrimaryByTimezone(): Map<string, GeoCity> {
  if (primaryByTimezone) return primaryByTimezone;
  const map = new Map<string, GeoCity>();
  for (const city of cityMapping as GeoCity[]) {
    if (!city.timezone) continue;
    const prev = map.get(city.timezone);
    if (!prev || (city.pop ?? 0) > (prev.pop ?? 0)) {
      map.set(city.timezone, city);
    }
  }
  primaryByTimezone = map;
  return map;
}

/** Build searchable catalog: curated popular first, then city-timezones (real coords). */
export function getCityCatalog(): SearchableCity[] {
  if (cachedCatalog) return cachedCatalog;

  const fromPopular: SearchableCity[] = POPULAR_CITIES.map((c) => ({
    ...c,
    searchText: `${c.label} ${c.region} ${c.timezone}`.toLowerCase(),
    population: 10_000_000, // keep popular near the top of ties
  }));

  const seen = new Set(fromPopular.map((c) => c.id));
  // Also de-dupe by label|timezone so popular curated rows win
  const seenKey = new Set(
    fromPopular.map((c) => `${c.label.toLowerCase()}|${c.timezone}`)
  );

  const fromGeo: SearchableCity[] = [];
  for (const raw of cityMapping as GeoCity[]) {
    if (!raw.timezone || !raw.city) continue;
    const city = toSearchableFromGeo(raw);
    const key = `${city.label.toLowerCase()}|${city.timezone}`;
    if (seen.has(city.id) || seenKey.has(key)) continue;
    // Skip near-duplicates of popular labels in same zone
    const popularHit = POPULAR_CITIES.find(
      (p) =>
        p.timezone === city.timezone &&
        p.label.toLowerCase() === city.label.toLowerCase()
    );
    if (popularHit) continue;

    seen.add(city.id);
    seenKey.add(key);
    fromGeo.push(city);
  }

  // Sort geo by population desc for nicer default browsing
  fromGeo.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  cachedCatalog = [...fromPopular, ...fromGeo];
  return cachedCatalog;
}

function toCustomSearchable(customPlaces: CityDefinition[]): SearchableCity[] {
  return customPlaces.map((c) => ({
    ...c,
    custom: true,
    countryName: c.region,
    searchText: `${c.label} ${c.region} ${c.timezone} custom`.toLowerCase(),
  }));
}

export function searchCities(
  query: string,
  limit = 40,
  customPlaces: CityDefinition[] = []
): SearchableCity[] {
  const q = query.trim().toLowerCase();
  const catalog = [...toCustomSearchable(customPlaces), ...getCityCatalog()];
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

  // Prefer higher population within each bucket
  starts.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  contains.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  return [...starts, ...contains].slice(0, limit);
}

export function findCityById(id: string): CityDefinition | undefined {
  return popularById.get(id) ?? getCityCatalog().find((c) => c.id === id);
}

export function findCityByTimezone(timezone: string): CityDefinition | undefined {
  return (
    POPULAR_CITIES.find((c) => c.timezone === timezone) ??
    getCityCatalog().find((c) => c.timezone === timezone)
  );
}

/** IANA zones for the custom-place timezone picker */
export function getTimezoneOptions(): TimezoneOption[] {
  if (cachedTimezones) return cachedTimezones;

  cachedTimezones = getTimeZones().map((tz) => ({
    name: tz.name,
    countryName: tz.countryName,
    abbreviation: tz.abbreviation,
    mainCities: tz.mainCities,
    searchText:
      `${tz.name} ${tz.countryName} ${tz.abbreviation} ${tz.mainCities.join(" ")}`.toLowerCase(),
  }));

  return cachedTimezones;
}

export function searchTimezones(query: string, limit = 40): TimezoneOption[] {
  const q = query.trim().toLowerCase();
  const all = getTimezoneOptions();
  if (!q) return all.slice(0, limit);

  const starts: TimezoneOption[] = [];
  const contains: TimezoneOption[] = [];

  for (const tz of all) {
    if (
      tz.name.toLowerCase().startsWith(q) ||
      tz.countryName.toLowerCase().startsWith(q)
    ) {
      starts.push(tz);
    } else if (tz.searchText.includes(q)) {
      contains.push(tz);
    }
    if (starts.length + contains.length >= limit * 2) break;
  }

  return [...starts, ...contains].slice(0, limit);
}

function scoreGeoMatch(
  c: GeoCity,
  label: string,
  region: string,
  timezone: string
): number {
  let score = 0;
  const cityName = (c.city_ascii || c.city).toLowerCase();
  const labelL = label.toLowerCase();
  const regionL = region.toLowerCase();

  if (c.timezone === timezone) score += 100;
  if (cityName === labelL) score += 50;
  else if (cityName.startsWith(labelL) || labelL.startsWith(cityName)) score += 20;

  if (regionL) {
    const hay =
      `${c.province ?? ""} ${c.state_ansi ?? ""} ${c.country ?? ""}`.toLowerCase();
    if (regionL.split(/[\s,]+/).filter(Boolean).every((part) => hay.includes(part))) {
      score += 40;
    } else if (hay.includes(regionL)) {
      score += 25;
    }
  }

  // Population tie-break (log scale, max ~20)
  score += Math.min(20, Math.log10(Math.max(c.pop ?? 1, 1)));
  return score;
}

/**
 * Resolve real-world coordinates for a place.
 * Prefer geo hits in the chosen IANA zone; never place a custom US city in PNG
 * just because the name substring matched "New Britain".
 */
export function resolvePlaceCoords(input: {
  label: string;
  region?: string;
  timezone: string;
}): { latitude: number; longitude: number; matchedLabel?: string } {
  const label = input.label.trim();
  const region = input.region?.trim() ?? "";
  const timezone = input.timezone.trim();

  const candidates: GeoCity[] = [];
  const pushUnique = (list: GeoCity[]) => {
    for (const c of list) {
      if (!c?.timezone) continue;
      if (
        !candidates.some(
          (x) =>
            x.city === c.city &&
            x.timezone === c.timezone &&
            x.lat === c.lat &&
            x.lng === c.lng
        )
      ) {
        candidates.push(c);
      }
    }
  };

  if (label && region) {
    pushUnique(findFromCityStateProvince(`${label} ${region}`) as GeoCity[]);
  }
  if (label) {
    pushUnique(findFromCityStateProvince(label) as GeoCity[]);
    pushUnique(lookupViaCity(label) as GeoCity[]);
  }

  // Only accept geo hits that share the selected timezone (avoids PNG "New Britain")
  const inZone = candidates.filter((c) => c.timezone === timezone);
  if (inZone.length > 0) {
    const best = [...inZone].sort(
      (a, b) =>
        scoreGeoMatch(b, label, region, timezone) -
        scoreGeoMatch(a, label, region, timezone)
    )[0]!;
    return {
      latitude: best.lat,
      longitude: best.lng,
      matchedLabel: best.city,
    };
  }

  // Soft match: same country hint from region, still require timezone match failed
  // so fall through to zone primary — better near Hartford/NYC than wrong continent.
  const primary = getPrimaryByTimezone().get(timezone);
  if (primary) {
    return {
      latitude: primary.lat,
      longitude: primary.lng,
      matchedLabel: primary.city,
    };
  }

  // Last resort: offset band (should rarely hit if timezone is valid IANA)
  const tz = getTimeZones().find((t) => t.name === timezone);
  const lon = tz ? (tz.currentTimeOffsetInMinutes / 60) * 15 : 0;
  return { latitude: 0, longitude: lon };
}

/**
 * True when coords look like the old fake "equator + offset*15" approximation.
 */
export function hasSuspiciousCoords(city: CityDefinition): boolean {
  if (!Number.isFinite(city.latitude) || !Number.isFinite(city.longitude)) {
    return true;
  }
  // Old bug placed most non-popular cities at lat≈0
  if (Math.abs(city.latitude) < 0.05) {
    return true;
  }
  return false;
}

/**
 * If the geo DB knows this city, return corrected coords; otherwise null.
 */
export function enrichCityCoords(
  city: CityDefinition
): { latitude: number; longitude: number } | null {
  const resolved = resolvePlaceCoords({
    label: city.label,
    region: city.region,
    timezone: city.timezone,
  });

  // Only accept if we matched a real city or timezone primary (not pure offset band at 0,0-ish with no match)
  if (
    resolved.matchedLabel ||
    (Math.abs(resolved.latitude) > 0.05 &&
      Number.isFinite(resolved.longitude))
  ) {
    const latDiff = Math.abs(resolved.latitude - city.latitude);
    const lonDiff = Math.abs(resolved.longitude - city.longitude);
    if (latDiff > 0.5 || lonDiff > 0.5 || hasSuspiciousCoords(city)) {
      return {
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      };
    }
  }
  return null;
}

export function makeCityId(label: string, timezone: string): string {
  return `${slugify(label)}-${timezone}`;
}

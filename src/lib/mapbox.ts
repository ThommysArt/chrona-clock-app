import type { CityDefinition } from "./constants";
import { getZonedParts } from "./time";

/** Mapbox Standard basemap: globe projection + atmosphere, day/night presets. */
export const MAPBOX_STANDARD_STYLE = "mapbox://styles/mapbox/standard";

/** Public token env var — embedded at build time (`.env`, EAS secrets). */
export const MAPBOX_TOKEN_ENV = "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN";

/** Public Mapbox token, or "" when not configured. */
export function getMapboxToken(): string {
  const raw = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Pin chip text, e.g. "London · 14:30". */
export function cityMapLabel(city: CityDefinition, offsetMs: number, use24Hour: boolean): string {
  const time = getZonedParts(city.timezone, offsetMs, use24Hour).timeLabelShort;
  return `${city.label} · ${time}`;
}

export type MapCenter = {
  longitude: number;
  latitude: number;
};

/** Initial camera target: first saved city, else a mid-Atlantic overview. */
export function initialMapCenter(cities: CityDefinition[]): MapCenter {
  const first = cities[0];
  if (!first) return { longitude: -20, latitude: 25 };
  return { longitude: first.longitude, latitude: first.latitude };
}

/** Zoomed-out globe overview when empty, focused once cities exist. */
export function initialMapZoom(cityCount: number): number {
  return cityCount > 0 ? 2.2 : 1.5;
}

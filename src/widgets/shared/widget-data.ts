import { DEFAULT_CITIES, type CityDefinition } from "@/lib/constants";
import * as db from "@/lib/db";
import {
  formatRelativeOffset,
  getDeviceTimezone,
  getZonedParts,
} from "@/lib/time";
import { getWidgetCityId } from "@/widgets/shared/widget-prefs";

export type WidgetCityRow = {
  id: string;
  label: string;
  region: string;
  timezone: string;
  timeLabel: string;
  timeLabelShort: string;
  dateLabel: string;
  abbreviation: string;
  relative: string;
  isDaytime: boolean;
  isDevice: boolean;
  /** 0–1 dial progress for analog hands */
  dialProgress: number;
  hourHandProgress: number;
  minuteHandProgress: number;
  hour: number;
  minute: number;
  second: number;
};

export type WidgetPayload = {
  use24Hour: boolean;
  deviceTimezone: string;
  cities: WidgetCityRow[];
  /** Primary city: device TZ if saved, otherwise first */
  primary: WidgetCityRow | null;
  updatedAt: number;
};

function toRow(
  city: CityDefinition,
  use24Hour: boolean,
  offsetMs: number,
  deviceTz: string
): WidgetCityRow {
  const parts = getZonedParts(city.timezone, offsetMs, use24Hour);
  return {
    id: city.id,
    label: city.label,
    region: city.region,
    timezone: city.timezone,
    timeLabel: parts.timeLabel,
    timeLabelShort: parts.timeLabelShort,
    dateLabel: parts.dateLabel,
    abbreviation: parts.abbreviation,
    relative: formatRelativeOffset(city.timezone, offsetMs),
    isDaytime: parts.isDaytime,
    isDevice: city.timezone === deviceTz,
    dialProgress: parts.dialProgress,
    hourHandProgress: parts.hourHandProgress,
    minuteHandProgress: parts.minuteHandProgress,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

type RawCitySnapshot = {
  cities: CityDefinition[];
  use24Hour: boolean;
};

async function loadRawCities(): Promise<RawCitySnapshot> {
  try {
    const [saved, settings] = await Promise.all([
      db.listSavedCities(),
      db.loadSettings(),
    ]);
    return {
      cities:
        saved.length > 0 ? saved : DEFAULT_CITIES.map((c) => ({ ...c })),
      use24Hour: settings.use24Hour,
    };
  } catch (e) {
    console.warn("[chrona] widget payload load failed, using defaults", e);
    return {
      cities: DEFAULT_CITIES.map((c) => ({ ...c })),
      use24Hour: true,
    };
  }
}

function buildPayload(
  cities: CityDefinition[],
  use24Hour: boolean,
  /** Extra offset from real wall clock (usually 0 for widgets) */
  offsetMs = 0
): WidgetPayload {
  const deviceTimezone = getDeviceTimezone();
  const rows = cities.map((c) =>
    toRow(c, use24Hour, offsetMs, deviceTimezone)
  );
  const primary = rows.find((r) => r.isDevice) ?? rows[0] ?? null;
  return {
    use24Hour,
    deviceTimezone,
    cities: rows,
    primary,
    updatedAt: Date.now() + offsetMs,
  };
}

/**
 * Load cities + settings from SQLite and format wall times for widgets.
 * Works in the main app and in the Android widget headless JS context.
 * Widgets always show real wall-clock time (no time-travel offset).
 */
export async function loadWidgetPayload(): Promise<WidgetPayload> {
  const { cities, use24Hour } = await loadRawCities();
  return buildPayload(cities, use24Hour, 0);
}

/**
 * Resolve which city a per-instance widget should display.
 * Falls back to primary (device TZ / first saved) when unset or missing.
 */
export async function resolveWidgetCity(
  payload: WidgetPayload,
  widgetName: string,
  widgetId: number
): Promise<WidgetCityRow | null> {
  const preferredId = await getWidgetCityId(widgetName, widgetId);
  if (preferredId) {
    const match = payload.cities.find((c) => c.id === preferredId);
    if (match) return match;
  }
  return payload.primary;
}

/**
 * Build payloads for the next `minutes` minutes (for iOS WidgetKit timelines).
 */
export async function loadWidgetTimeline(
  minutes = 30
): Promise<{ date: Date; payload: WidgetPayload }[]> {
  const { cities, use24Hour } = await loadRawCities();
  const now = Date.now();
  return Array.from({ length: minutes }, (_, i) => {
    const offsetMs = i * 60_000;
    return {
      date: new Date(now + offsetMs),
      payload: buildPayload(cities, use24Hour, offsetMs),
    };
  });
}

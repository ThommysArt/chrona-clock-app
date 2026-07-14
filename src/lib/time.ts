import { Temporal } from "@js-temporal/polyfill";

export type ZonedParts = {
  hour: number;
  minute: number;
  second: number;
  day: number;
  month: number;
  year: number;
  dayOfWeek: number;
  offsetMinutes: number;
  /** e.g. PDT, BST, GMT+9 */
  abbreviation: string;
  /** 0–1 clock position for hour hand (12 = 0) */
  hourHandProgress: number;
  /** 0–1 clock position for minute hand */
  minuteHandProgress: number;
  /** Combined continuous hour+minute for multi-hand analog (0–1 around dial) */
  dialProgress: number;
  isDaytime: boolean;
  dateLabel: string;
  timeLabel: string;
  timeLabelShort: string;
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Instant representing "app now" = wall clock + offset */
export function appInstant(offsetMs: number): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(
    Date.now() + Math.round(offsetMs)
  );
}

export function getDeviceTimezone(): string {
  try {
    return Temporal.Now.timeZoneId();
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type PartsFormatter = Intl.DateTimeFormat;

/** Cached Intl formatters — Temporal polyfill is far too slow for scrubbing. */
const partsFormatterCache = new Map<string, PartsFormatter>();

function getPartsFormatter(timezone: string): PartsFormatter {
  let fmt = partsFormatterCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    });
    partsFormatterCache.set(timezone, fmt);
  }
  return fmt;
}

function readZonedMap(
  timezone: string,
  epochMs: number
): Record<string, string> {
  const map: Record<string, string> = {};
  try {
    for (const part of getPartsFormatter(timezone).formatToParts(
      new Date(epochMs)
    )) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
  } catch {
    for (const part of getPartsFormatter("UTC").formatToParts(
      new Date(epochMs)
    )) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
  }
  return map;
}

/** Offset of timezone vs UTC at epochMs, in minutes */
function offsetMinutesAt(timezone: string, epochMs: number): number {
  // Compare the same instant formatted in UTC vs zone (locale string trick)
  const d = new Date(epochMs);
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  try {
    const local = new Date(d.toLocaleString("en-US", { timeZone: timezone }));
    return Math.round((local.getTime() - utc.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

/**
 * Zone wall-clock parts for a given time-travel offset.
 * Uses cached Intl (not Temporal) so scrubbing stays responsive.
 */
export function getZonedParts(
  timezone: string,
  offsetMs: number,
  use24Hour: boolean
): ZonedParts {
  const epochMs = Date.now() + offsetMs;
  const map = readZonedMap(timezone, epochMs);

  // h23 → 0–23; some engines still emit "24" at midnight
  let hour = Number.parseInt(map.hour ?? "0", 10);
  if (hour === 24) hour = 0;
  const minute = Number.parseInt(map.minute ?? "0", 10);
  const second = Number.parseInt(map.second ?? "0", 10);
  const day = Number.parseInt(map.day ?? "1", 10);
  const month = Number.parseInt(map.month ?? "1", 10);
  const year = Number.parseInt(map.year ?? "1970", 10);

  const hour12 = hour % 12;
  const hourHandProgress = (hour12 + minute / 60 + second / 3600) / 12;
  const minuteHandProgress = (minute + second / 60) / 60;
  const dialProgress = hourHandProgress;

  const weekdayRaw = map.weekday ?? "Sun";
  const dayIndex = Math.max(
    0,
    WEEKDAYS.findIndex((w) => weekdayRaw.startsWith(w))
  );

  const abbreviation = map.timeZoneName ?? "";
  const offsetMinutes = offsetMinutesAt(timezone, epochMs);

  const dateLabel = `${WEEKDAYS[dayIndex]}, ${day} ${monthShort(month)}`;

  const h24 = pad2(hour);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const m = pad2(minute);
  const timeLabel = use24Hour
    ? `${h24}:${m}`
    : `${h12}:${m} ${hour < 12 ? "AM" : "PM"}`;
  const timeLabelShort = use24Hour ? `${h24}:${m}` : `${h12}:${m}`;

  const isDaytime = hour >= 6 && hour < 18;

  return {
    hour,
    minute,
    second,
    day,
    month,
    year,
    dayOfWeek: dayIndex,
    offsetMinutes,
    abbreviation,
    hourHandProgress,
    minuteHandProgress,
    dialProgress,
    isDaytime,
    dateLabel,
    timeLabel,
    timeLabelShort,
  };
}

function monthShort(month: number): string {
  return (
    [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ][month - 1] ?? ""
  );
}

/** Relative offset string vs device timezone, e.g. "Today, −8 hrs" */
export function formatRelativeOffset(
  cityTimezone: string,
  offsetMs: number
): string {
  const deviceTz = getDeviceTimezone();
  const city = getZonedParts(cityTimezone, offsetMs, true);
  const device = getZonedParts(deviceTz, offsetMs, true);

  // Prefer offset-based diff to avoid DST edge confusion
  const diffMinutes = city.offsetMinutes - device.offsetMinutes;
  const diffHours = diffMinutes / 60;

  let dayRelation = "Today";
  if (
    city.year !== device.year ||
    city.month !== device.month ||
    city.day !== device.day
  ) {
    const cityDayNum = city.year * 400 + city.month * 32 + city.day;
    const deviceDayNum = device.year * 400 + device.month * 32 + device.day;
    dayRelation = cityDayNum < deviceDayNum ? "Yesterday" : "Tomorrow";
  }

  if (Math.abs(diffHours) < 0.01) {
    return dayRelation;
  }

  const sign = diffHours > 0 ? "+" : "−";
  const abs = Math.abs(diffHours);
  const hrs = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${dayRelation}, ${sign}${hrs} hr${abs === 1 ? "" : "s"}`;
}

export function formatOffsetHours(offsetMs: number): string {
  const hours = offsetMs / (60 * 60 * 1000);
  if (Math.abs(hours) < 0.01) return "0h";
  const sign = hours > 0 ? "+" : "−";
  const abs = Math.abs(hours);
  const whole = Math.floor(abs);
  const mins = Math.round((abs - whole) * 60);
  if (mins === 0) return `${sign}${whole}h`;
  return `${sign}${whole}h ${mins}m`;
}

/** Sun direction for globe day/night (unit vector approx) — cheap UTC math */
export function sunDirectionFromTimestamp(
  offsetMs: number
): [number, number, number] {
  const d = new Date(Date.now() + offsetMs);
  const dayFraction =
    (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) / 24;
  // At 12:00 UTC sun is roughly over 0° longitude
  const longitudeRad = (0.5 - dayFraction) * Math.PI * 2;
  const x = Math.cos(longitudeRad);
  const z = Math.sin(longitudeRad);
  return [x, 0.15, z];
}

export function latLonToVector3(
  latitude: number,
  longitude: number,
  radius = 1
): [number, number, number] {
  const phi = ((90 - latitude) * Math.PI) / 180;
  const theta = ((longitude + 180) * Math.PI) / 180;
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}

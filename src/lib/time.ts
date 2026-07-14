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
  return Temporal.Now.instant().add({ milliseconds: Math.round(offsetMs) });
}

export function getDeviceTimezone(): string {
  try {
    return Temporal.Now.timeZoneId();
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }
}

export function getZonedParts(
  timezone: string,
  offsetMs: number,
  use24Hour: boolean
): ZonedParts {
  const instant = appInstant(offsetMs);
  let zoned: Temporal.ZonedDateTime;

  try {
    zoned = instant.toZonedDateTimeISO(timezone);
  } catch {
    zoned = instant.toZonedDateTimeISO("UTC");
  }

  const hour = zoned.hour;
  const minute = zoned.minute;
  const second = zoned.second;

  const hour12 = hour % 12;
  const hourHandProgress = (hour12 + minute / 60 + second / 3600) / 12;
  const minuteHandProgress = (minute + second / 60) / 60;
  // Single hand pointing to "wall time" on a 12h dial (hours + minutes)
  const dialProgress = hourHandProgress;

  const offsetMinutes = zoned.offsetNanoseconds / 60_000_000_000;

  let abbreviation = "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date(instant.epochMilliseconds));
    abbreviation = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    abbreviation = zoned.offset;
  }

  // Temporal dayOfWeek: Mon=1 … Sun=7 → JS-style Sun=0
  const dayIndex = zoned.dayOfWeek === 7 ? 0 : zoned.dayOfWeek;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dateLabel = `${weekdays[dayIndex]}, ${zoned.day} ${monthShort(zoned.month)}`;

  const h24 = pad2(hour);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const m = pad2(minute);
  const timeLabel = use24Hour
    ? `${h24}:${m}`
    : `${h12}:${m} ${hour < 12 ? "AM" : "PM"}`;
  const timeLabelShort = use24Hour ? `${h24}:${m}` : `${h12}:${m}`;

  // Rough daytime: 6:00–18:00 local
  const isDaytime = hour >= 6 && hour < 18;

  return {
    hour,
    minute,
    second,
    day: zoned.day,
    month: zoned.month,
    year: zoned.year,
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
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
      month - 1
    ] ?? ""
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

  const cityMinutes = city.hour * 60 + city.minute + city.day * 24 * 60;
  const deviceMinutes = device.hour * 60 + device.minute + device.day * 24 * 60;
  // Prefer offset-based diff to avoid DST edge confusion
  const diffMinutes = city.offsetMinutes - device.offsetMinutes;
  const diffHours = diffMinutes / 60;

  let dayRelation = "Today";
  // Compare calendar dates in each zone
  if (city.year !== device.year || city.month !== device.month || city.day !== device.day) {
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

/** Sun direction for globe day/night (unit vector approx) */
export function sunDirectionFromTimestamp(offsetMs: number): [number, number, number] {
  const instant = appInstant(offsetMs);
  const utc = instant.toZonedDateTimeISO("UTC");
  // Longitude of subsolar point roughly tracks UTC hour
  const dayFraction = (utc.hour + utc.minute / 60 + utc.second / 3600) / 24;
  // At 12:00 UTC sun is roughly over 0° longitude
  const longitudeRad = (0.5 - dayFraction) * Math.PI * 2;
  // Simple seasonal tilt ignored for v1
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

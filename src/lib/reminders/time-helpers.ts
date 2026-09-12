/**
 * Pure helpers for reminders — no native imports so this file (and its tests)
 * run on web, node, and native.
 */

export const REMINDER_MIN_LEAD_MS = 60_000;
export const REMINDER_MAX_RANGE_MS = 12 * 60 * 60 * 1000;
export const REMINDER_DEFAULT_DURATION_MS = 30 * 60_000;

export function isReminderTargetValid(
  targetEpochMs: number,
  nowMs = Date.now()
): { ok: boolean; reason?: string } {
  if (!Number.isFinite(targetEpochMs)) return { ok: false, reason: "Invalid time" };
  const delta = targetEpochMs - nowMs;
  if (delta < REMINDER_MIN_LEAD_MS) {
    return { ok: false, reason: "That time is in the past — scrub forward first" };
  }
  if (delta > REMINDER_MAX_RANGE_MS + 60_000) {
    return { ok: false, reason: "Time Travel only reaches ±12h" };
  }
  return { ok: true };
}

/** "at that time in Paris i need to do x" → absolute instant from the slider. */
export function targetFromOffset(offsetMs: number, nowMs = Date.now()): number {
  return nowMs + Math.round(offsetMs);
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Format epoch ms as wall time in a zone: "14:30". */
export function formatZonedTime(epochMs: number, timezone: string, use24Hour = true): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: use24Hour ? "h23" : "h12",
    }).format(new Date(epochMs));
    return parts;
  } catch {
    const d = new Date(epochMs);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

/** Format epoch ms as "Tue, 12 Sep · 14:30" in a zone. */
export function formatZonedDateTime(epochMs: number, timezone: string): string {
  try {
    const date = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(epochMs));
    return `${date} · ${formatZonedTime(epochMs, timezone)}`;
  } catch {
    return new Date(epochMs).toLocaleString();
  }
}

/** Google Calendar template dates use UTC basic format: YYYYMMDDTHHMMSSZ/... */
function toGcalStamp(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Google Calendar "create event" deep link — the web fallback and the
 * Android path when the user prefers their Google account in a browser.
 * Works without OAuth: opens pre-filled event form.
 */
export function buildGoogleCalendarTemplateUrl(input: {
  title: string;
  description?: string;
  location?: string;
  startMs: number;
  endMs?: number;
}): string {
  const end = input.endMs ?? input.startMs + REMINDER_DEFAULT_DURATION_MS;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title || "Reminder",
    dates: `${toGcalStamp(input.startMs)}/${toGcalStamp(end)}`,
  });
  if (input.description) params.set("details", input.description);
  if (input.location) params.set("location", input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsStamp(ms: number): string {
  return toGcalStamp(ms);
}

/** Minimal .ics file so web users can import into any calendar app. */
export function buildIcsContent(input: {
  title: string;
  description?: string;
  location?: string;
  startMs: number;
  endMs?: number;
}): string {
  const end = input.endMs ?? input.startMs + REMINDER_DEFAULT_DURATION_MS;
  const uid = `chrona-${input.startMs}-${Math.random().toString(36).slice(2)}@chrona`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chrona//Reminders//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(input.startMs)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(input.title || "Reminder")}`,
    ...(input.description ? [`DESCRIPTION:${icsEscape(input.description)}`] : []),
    ...(input.location ? [`LOCATION:${icsEscape(input.location)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT0M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(input.title || "Reminder")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

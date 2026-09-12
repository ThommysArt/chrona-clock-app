import { Platform } from "react-native";

import { REMINDER_DEFAULT_DURATION_MS } from "./time-helpers";

export type CalendarTarget = {
  id: string;
  title: string;
  /** e.g. Google account email — shown in the sheet so users can verify. */
  subtitle?: string;
  isGoogle?: boolean;
};

export type CreateEventInput = {
  title: string;
  notes?: string;
  location?: string;
  startMs: number;
  endMs?: number;
  timezone?: string;
  calendarId?: string;
};

function pickBestCalendar(
  calendars: {
    id: string;
    title: string;
    allowsModifications?: boolean;
    ownerAccount?: string;
    isPrimary?: boolean;
    type?: string;
  }[]
): CalendarTarget | null {
  const writable = calendars.filter((c) => c.allowsModifications !== false);
  const pool = writable.length > 0 ? writable : calendars;
  if (pool.length === 0) return null;
  const google = pool.find(
    (c) =>
      (c.ownerAccount ?? "").toLowerCase().includes("gmail") ||
      (c.ownerAccount ?? "").toLowerCase().includes("google")
  );
  const chosen =
    google ??
    pool.find((c) => c.isPrimary) ??
    pool.find((c) => (c.title ?? "").toLowerCase().includes("chrona")) ??
    pool[0]!;
  return {
    id: chosen.id,
    title: chosen.title || "Calendar",
    subtitle: chosen.ownerAccount,
  };
}

export async function getWritableCalendars(): Promise<CalendarTarget[]> {
  if (Platform.OS === "web") return [];
  const Calendar = await import("expo-calendar");
  const entityType =
    (Calendar as unknown as { EntityTypes?: { EVENT?: string } }).EntityTypes?.EVENT ?? "event";
  const calendars = (await (
    Calendar as unknown as {
      getCalendars: (t: string) => Promise<Record<string, unknown>[]>;
    }
  ).getCalendars(entityType)) as {
    id: string;
    title: string;
    allowsModifications?: boolean;
    ownerAccount?: string;
    isPrimary?: boolean;
  }[];
  return calendars.map((c) => ({
    id: c.id,
    title: c.title || "Calendar",
    subtitle: c.ownerAccount,
  }));
}

export async function ensureCalendarPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return true; // template URL needs no permission
  const Calendar = await import("expo-calendar");
  try {
    const existing = await (
      Calendar as unknown as {
        getCalendarPermissions: () => Promise<{ status: string }>;
      }
    ).getCalendarPermissions();
    if (existing.status === "granted") return true;
    const req = await (
      Calendar as unknown as {
        requestCalendarPermissions: () => Promise<{ status: string }>;
      }
    ).requestCalendarPermissions();
    return req.status === "granted";
  } catch {
    return false;
  }
}

/**
 * Create a device calendar event (native). On Android this writes into the
 * user's synced Google calendar when one is writable — that IS the Google
 * Calendar integration (events sync to calendar.google.com automatically).
 * Falls back to a local "Chrona" calendar when nothing writable exists.
 */
export async function createNativeCalendarEvent(
  input: CreateEventInput
): Promise<{ eventId: string | null; calendarTitle?: string }> {
  const Calendar = await import("expo-calendar");
  const Api = Calendar as unknown as {
    EntityTypes: { EVENT: string };
    getCalendars: (t: string) => Promise<
      {
        id: string;
        title: string;
        allowsModifications?: boolean;
        ownerAccount?: string;
        isPrimary?: boolean;
        source?: { id?: string; name?: string; type?: string };
        allowsModify?: boolean;
      }[]
    >;
    createCalendar: (d: Record<string, unknown>) => Promise<{ id: string; title: string } | string>;
  };

  const calendars = await Api.getCalendars(Api.EntityTypes.EVENT);
  let target = pickBestCalendar(calendars as never[]);
  let calendarId = input.calendarId ?? target?.id;

  if (!calendarId) {
    // No writable calendar — create a local "Chrona" one.
    try {
      const created = await Api.createCalendar({
        title: "Chrona",
        color: "#E11D48",
        entityType: Api.EntityTypes.EVENT,
        name: "Chrona",
        ownerAccount: "Chrona",
        accessLevel: "owner",
        source: (calendars[0] as { source?: unknown } | undefined)?.source ?? {
          name: "Chrona",
          type: "local",
          isLocalAccount: true,
        },
      });
      calendarId = typeof created === "string" ? created : (created as { id: string }).id;
      target = { id: calendarId, title: "Chrona" };
    } catch {
      return { eventId: null };
    }
  }

  const endMs = input.endMs ?? input.startMs + REMINDER_DEFAULT_DURATION_MS;
  // expo-calendar Next API: Calendar.get(id) → calendar.createEvent(details)
  const eventApi = Calendar as unknown as {
    ExpoCalendar?: {
      get: (id: string) => Promise<{
        createEvent: (d: Record<string, unknown>) => Promise<{ id: string } | string>;
      }>;
    };
  };
  try {
    if (eventApi.ExpoCalendar) {
      const cal = await eventApi.ExpoCalendar.get(calendarId);
      const event = await cal.createEvent({
        title: input.title || "Reminder",
        notes: input.notes ?? "",
        location: input.location ?? "",
        startDate: new Date(input.startMs),
        endDate: new Date(endMs),
        timeZone: input.timezone ?? undefined,
        alarms: [{ relativeOffset: 0 }],
      });
      const eventId = typeof event === "string" ? event : event.id;
      return { eventId, calendarTitle: target?.title };
    }
  } catch {
    // fall through to legacy API
  }

  // Legacy fallback (expo-calendar < 15 style).
  try {
    const legacy = Calendar as unknown as {
      createEventAsync: (calId: string, d: Record<string, unknown>) => Promise<string>;
    };
    if (typeof legacy.createEventAsync === "function") {
      const eventId = await legacy.createEventAsync(calendarId, {
        title: input.title || "Reminder",
        notes: input.notes ?? "",
        location: input.location ?? "",
        startDate: new Date(input.startMs),
        endDate: new Date(endMs),
        timeZone: input.timezone ?? undefined,
        alarms: [{ relativeOffset: 0 }],
      });
      return { eventId, calendarTitle: target?.title };
    }
  } catch {
    return { eventId: null };
  }
  return { eventId: null };
}

export async function deleteNativeCalendarEvent(eventId: string | null): Promise<void> {
  if (!eventId || Platform.OS === "web") return;
  try {
    const Calendar = await import("expo-calendar");
    const Api = Calendar as unknown as {
      ExpoCalendarEvent?: { get: (id: string) => Promise<{ delete: () => Promise<void> }> };
      deleteEventAsync?: (id: string) => Promise<void>;
    };
    if (Api.ExpoCalendarEvent) {
      const event = await Api.ExpoCalendarEvent.get(eventId);
      await event.delete();
      return;
    }
    if (typeof Api.deleteEventAsync === "function") {
      await Api.deleteEventAsync(eventId);
    }
  } catch {
    // Event already deleted externally — not fatal.
  }
}

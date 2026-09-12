import { Platform } from "react-native";
import { create } from "zustand";

import * as db from "@/lib/db";
import {
  createNativeCalendarEvent,
  deleteNativeCalendarEvent,
  ensureCalendarPermissions,
  getWritableCalendars,
  type CalendarTarget,
} from "@/lib/reminders/calendar-service";
import {
  cancelScheduledReminder,
  ensureNotificationPermissions,
  scheduleLocalReminder,
  showWebNotificationNow,
} from "@/lib/reminders/notification-service";
import {
  buildGoogleCalendarTemplateUrl,
  isReminderTargetValid,
  REMINDER_DEFAULT_DURATION_MS,
} from "@/lib/reminders/time-helpers";
import { newReminderId, type NewReminderInput, type Reminder } from "@/lib/reminders/types";

type RemindersState = {
  reminders: Reminder[];
  ready: boolean;
  lastError: string | null;
  calendarTargets: CalendarTarget[];
  /** Create + persist + schedule. Returns the reminder or an error string. */
  createReminder: (
    input: NewReminderInput
  ) => Promise<{ reminder?: Reminder; openedUrl?: string; error?: string }>;
  removeReminder: (id: string) => Promise<void>;
  removeRemindersForCity: (cityId: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadCalendarTargets: () => Promise<void>;
  /** Mark due reminders fired (web ticker + native fallback). */
  fireDueReminders: () => Promise<Reminder[]>;
};

function rowToReminder(row: db.ReminderRow): Reminder {
  return {
    id: row.id,
    cityId: row.cityId,
    cityLabel: row.cityLabel,
    timezone: row.timezone,
    targetEpochMs: row.targetEpochMs,
    title: row.title,
    note: row.note,
    createdAtMs: row.createdAtMs,
    notificationId: row.notificationId,
    calendarEventId: row.calendarEventId,
    notifyEnabled: row.notifyEnabled,
    calendarEnabled: row.calendarEnabled,
    fired: row.fired,
  };
}

export function remindersForCity(reminders: Reminder[], cityId: string): Reminder[] {
  return reminders
    .filter((r) => r.cityId === cityId && !r.fired)
    .sort((a, b) => a.targetEpochMs - b.targetEpochMs);
}

export const useRemindersStore = create<RemindersState>((set, get) => ({
  reminders: [],
  ready: false,
  lastError: null,
  calendarTargets: [],

  refresh: async () => {
    try {
      const rows = await db.listReminders();
      const now = Date.now();
      // Opportunistically mark long-past reminders fired (keeps list clean).
      const live = rows.filter((r) => !r.fired || r.targetEpochMs > now - 24 * 60 * 60_000);
      set({ reminders: live.map(rowToReminder), ready: true });
    } catch (e) {
      console.warn("[chrona] failed to load reminders", e);
      set({ ready: true });
    }
  },

  loadCalendarTargets: async () => {
    if (Platform.OS === "web") {
      set({ calendarTargets: [] });
      return;
    }
    try {
      const ok = await ensureCalendarPermissions().catch(() => false);
      if (!ok) {
        set({ calendarTargets: [] });
        return;
      }
      set({ calendarTargets: await getWritableCalendars() });
    } catch {
      set({ calendarTargets: [] });
    }
  },

  createReminder: async (input) => {
    const now = Date.now();
    const title = input.title.trim() || `Call time in ${input.cityLabel}`;
    const validation = isReminderTargetValid(input.targetEpochMs, now);
    if (!validation.ok) return { error: validation.reason ?? "Invalid time" };

    let notificationId: string | null = null;
    let calendarEventId: string | null = null;
    let openedUrl: string | undefined;

    if (input.notifyEnabled) {
      const granted = await ensureNotificationPermissions().catch(() => false);
      if (!granted) {
        return {
          error:
            Platform.OS === "web"
              ? "Browser notifications blocked — allow them and retry"
              : "Notification permission denied — enable it in Settings",
        };
      }
      const body = `${input.cityLabel} · ${new Date(input.targetEpochMs).toLocaleString()}`;
      notificationId = await scheduleLocalReminder({
        title,
        body,
        targetEpochMs: input.targetEpochMs,
        data: {
          reminderCity: input.cityLabel,
          reminderTimezone: input.timezone,
        },
      }).catch(() => null);
    }

    if (input.calendarEnabled) {
      if (Platform.OS === "web") {
        // No OAuth needed: pre-filled Google Calendar form in a new tab.
        openedUrl = buildGoogleCalendarTemplateUrl({
          title,
          description: `Chrona reminder — ${input.cityLabel} (${input.timezone})${
            input.note ? `\n${input.note}` : ""
          }`,
          location: input.cityLabel,
          startMs: input.targetEpochMs,
          endMs: input.targetEpochMs + REMINDER_DEFAULT_DURATION_MS,
        });
        try {
          window.open(openedUrl, "_blank", "noopener");
        } catch {
          // Popup blocked — caller still shows the link.
        }
      } else {
        const granted = await ensureCalendarPermissions().catch(() => false);
        if (!granted) {
          if (notificationId) await cancelScheduledReminder(notificationId);
          return {
            error: "Calendar permission denied — enable it in Settings",
          };
        }
        const res = await createNativeCalendarEvent({
          title,
          notes: `Chrona reminder — ${input.cityLabel} (${input.timezone})${
            input.note ? `\n${input.note}` : ""
          }`,
          location: input.cityLabel,
          startMs: input.targetEpochMs,
          endMs: input.targetEpochMs + REMINDER_DEFAULT_DURATION_MS,
          timezone: input.timezone,
        }).catch(() => ({ eventId: null as string | null }));
        calendarEventId = res.eventId;
        if (!calendarEventId) {
          if (notificationId) await cancelScheduledReminder(notificationId);
          return { error: "Couldn't write to any calendar on this device" };
        }
      }
    }

    const reminder: Reminder = {
      id: newReminderId(),
      cityId: input.cityId,
      cityLabel: input.cityLabel,
      timezone: input.timezone,
      targetEpochMs: input.targetEpochMs,
      title,
      note: input.note?.trim() ?? "",
      createdAtMs: now,
      notificationId,
      calendarEventId,
      notifyEnabled: input.notifyEnabled,
      calendarEnabled: input.calendarEnabled,
      fired: false,
    };
    try {
      await db.insertReminder({ ...reminder });
    } catch (e) {
      console.warn("[chrona] failed to persist reminder", e);
      return { error: "Couldn't save the reminder" };
    }
    set({ reminders: [...get().reminders, reminder] });
    return { reminder, openedUrl };
  },

  removeReminder: async (id) => {
    const existing = get().reminders.find((r) => r.id === id);
    set({ reminders: get().reminders.filter((r) => r.id !== id) });
    try {
      await db.deleteReminder(id);
    } catch (e) {
      console.warn("[chrona] failed to delete reminder", e);
    }
    if (existing?.notificationId) {
      await cancelScheduledReminder(existing.notificationId);
    }
    if (existing?.calendarEventId) {
      await deleteNativeCalendarEvent(existing.calendarEventId);
    }
  },

  fireDueReminders: async () => {
    const now = Date.now();
    const due = get().reminders.filter((r) => !r.fired && r.targetEpochMs <= now);
    if (due.length === 0) return [];
    // Web: surface via Browser Notification API (native already fired via OS).
    if (Platform.OS === "web") {
      for (const r of due) {
        showWebNotificationNow(
          r.title,
          `${r.cityLabel} · ${new Date(r.targetEpochMs).toLocaleString()}`
        );
      }
    }
    for (const r of due) {
      try {
        await db.updateReminder(r.id, { fired: true });
      } catch {
        // keep going
      }
    }
    set({
      reminders: get().reminders.map((r) =>
        due.some((d) => d.id === r.id) ? { ...r, fired: true } : r
      ),
    });
    return due;
  },

  removeRemindersForCity: async (cityId) => {
    const doomed = get().reminders.filter((r) => r.cityId === cityId);
    set({ reminders: get().reminders.filter((r) => r.cityId !== cityId) });
    try {
      await db.deleteRemindersForCity(cityId);
    } catch (e) {
      console.warn("[chrona] failed to delete city reminders", e);
    }
    for (const r of doomed) {
      if (r.notificationId) await cancelScheduledReminder(r.notificationId);
      if (r.calendarEventId) await deleteNativeCalendarEvent(r.calendarEventId);
    }
  },
}));

export async function hydrateRemindersStore(): Promise<void> {
  await useRemindersStore.getState().refresh();
}

/** Foreground ticker — fires due web reminders; harmless on native. */
let ticker: ReturnType<typeof setInterval> | null = null;
export function startReminderTicker(): () => void {
  if (ticker) clearInterval(ticker);
  ticker = setInterval(() => {
    void useRemindersStore
      .getState()
      .fireDueReminders()
      .catch(() => undefined);
  }, 15_000);
  // Fire immediately on start in case the tab was asleep past a reminder.
  void useRemindersStore
    .getState()
    .fireDueReminders()
    .catch(() => undefined);
  return () => {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

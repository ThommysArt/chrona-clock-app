export type Reminder = {
  id: string;
  cityId: string;
  cityLabel: string;
  timezone: string;
  /** Absolute UTC epoch ms when the reminder fires. */
  targetEpochMs: number;
  title: string;
  note: string;
  createdAtMs: number;
  /** expo-notifications identifier (native) — null on web. */
  notificationId: string | null;
  /** expo-calendar event id (native) — null when not added / on web. */
  calendarEventId: string | null;
  /** True when a local notification was requested. */
  notifyEnabled: boolean;
  /** True when a calendar event was requested. */
  calendarEnabled: boolean;
  fired: boolean;
};

export type NewReminderInput = {
  cityId: string;
  cityLabel: string;
  timezone: string;
  targetEpochMs: number;
  title: string;
  note?: string;
  notifyEnabled: boolean;
  calendarEnabled: boolean;
};

export function newReminderId(): string {
  return `rem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

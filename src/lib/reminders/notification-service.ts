import { Platform } from "react-native";

export const REMINDER_CHANNEL_ID = "chrona-reminders";

export type ScheduledReminder = {
  title: string;
  body: string;
  targetEpochMs: number;
  data?: Record<string, string>;
};

/**
 * Must be called once at boot (native only). Creates the Android channel so
 * the OS permission prompt can appear (Android 13+) and sets the foreground
 * handler so tapped notifications behave sanely.
 */
export async function setupReminderNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  const Notifications = await import("expo-notifications");
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: "Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#E11D48",
      sound: undefined,
    });
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function getNotificationPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined"
> {
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return "denied";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return "undetermined";
  }
  const Notifications = await import("expo-notifications");
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
  }
  const Notifications = await import("expo-notifications");
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Schedule an exact(ish) local notification. On Android 12+ the OS delivers
 * it exactly only when the user grants Alarms & reminders access — otherwise
 * expo-notifications falls back to an inexact alarm (may drift ~minutes).
 */
export async function scheduleLocalReminder(input: ScheduledReminder): Promise<string | null> {
  if (Platform.OS === "web") {
    // Web has no background scheduler — the store's foreground ticker fires
    // due reminders via the Browser Notification API. Permission first.
    await ensureNotificationPermissions().catch(() => false);
    return `web-${Date.now().toString(36)}`;
  }
  const Notifications = await import("expo-notifications");
  const date = new Date(input.targetEpochMs);
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      data: { ...(input.data ?? {}), kind: "chrona-reminder" },
      sound: undefined,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(Platform.OS === "android" ? { channelId: REMINDER_CHANNEL_ID } : {}),
    },
  });
  return id;
}

export async function cancelScheduledReminder(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  if (Platform.OS === "web") return;
  if (notificationId.startsWith("web-")) return;
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already fired / unknown id — not fatal.
  }
}

/** Foreground delivery on web — called by the reminders ticker. */
export function showWebNotificationNow(title: string, body: string): boolean {
  try {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission !== "granted") return false;
    const n = new Notification(title, { body, tag: `chrona-${Date.now()}` });
    // Auto-close after 8s so stray notifications don't pile up.
    setTimeout(() => n.close(), 8000);
    return true;
  } catch {
    return false;
  }
}

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

import type { CityDefinition } from "@/lib/constants";
import { fonts } from "@/lib/fonts";
import {
  formatZonedDateTime,
  formatZonedTime,
  isReminderTargetValid,
} from "@/lib/reminders/time-helpers";
import { useSettingsStore } from "@/store/settings-store";
import { useRemindersStore } from "@/store/reminders-store";

type Props = {
  visible: boolean;
  city: CityDefinition;
  /** Absolute UTC epoch ms captured from the Time Travel slider. */
  targetEpochMs: number;
  onClose: () => void;
};

function countdownLabel(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, targetMs - nowMs);
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
}

export function ReminderSheet({ visible, city, targetEpochMs, onClose }: Props): JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const use24Hour = useSettingsStore((s) => s.use24Hour);
  const createReminder = useRemindersStore((s) => s.createReminder);
  const calendarTargets = useRemindersStore((s) => s.calendarTargets);
  const loadCalendarTargets = useRemindersStore((s) => s.loadCalendarTargets);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [calendarEnabled, setCalendarEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  // Mounted fresh on every open (parent renders conditionally), so
  // initializers above are the reset. Tick the countdown while open.
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    void loadCalendarTargets();
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [loadCalendarTargets]);

  const validity = useMemo(
    () => isReminderTargetValid(targetEpochMs, nowMs),
    [targetEpochMs, nowMs]
  );

  const cityTime = formatZonedTime(targetEpochMs, city.timezone, use24Hour);
  const cityDate = formatZonedDateTime(targetEpochMs, city.timezone);

  const textPrimary = isDark ? "#FFFFFF" : "#111111";
  const textSecondary = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)";
  const cardBg = isDark ? "#1C1C1E" : "#FFFFFF";
  const inputBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

  const onSave = async () => {
    if (saving || !validity.ok) return;
    setSaving(true);
    setError(null);
    setSavedUrl(null);
    const res = await createReminder({
      cityId: city.id,
      cityLabel: city.label,
      timezone: city.timezone,
      targetEpochMs,
      title: title.trim() || `Check in with ${city.label}`,
      note,
      notifyEnabled,
      calendarEnabled,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (res.openedUrl) setSavedUrl(res.openedUrl);
    // Web calendar flow shows the fallback link briefly, then closes.
    if (res.openedUrl) {
      setTimeout(onClose, 1200);
    } else {
      onClose();
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      transparent={false}
      visible={visible}
    >
      <View style={[styles.root, { backgroundColor: cardBg }]}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={onClose} style={styles.closeBtn}>
            <Ionicons color={textSecondary} name="close" size={22} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Remind me</Text>
          <View style={styles.closeBtn} />
        </View>

        <View style={styles.timeCard}>
          <Ionicons color="#E11D48" name="notifications-outline" size={20} />
          <View style={styles.timeTextWrap}>
            <Text style={[styles.cityLine, { color: textPrimary }]}>
              {cityTime} in {city.label}{" "}
              <Text style={{ color: textSecondary }}>· {countdownLabel(targetEpochMs, nowMs)}</Text>
            </Text>
            <Text style={[styles.subLine, { color: textSecondary }]}>
              {cityDate} · {city.timezone}
            </Text>
          </View>
        </View>

        {!validity.ok && (
          <View style={styles.warnBox}>
            <Ionicons color="#FF9F0A" name="warning-outline" size={16} />
            <Text style={styles.warnText}>{validity.reason}</Text>
          </View>
        )}

        <Text style={[styles.label, { color: textSecondary }]}>What for?</Text>
        <TextInput
          autoFocus
          onChangeText={setTitle}
          placeholder={`e.g. Call team in ${city.label}`}
          placeholderTextColor={textSecondary}
          returnKeyType="done"
          style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
          value={title}
        />
        <TextInput
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={textSecondary}
          style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
          value={note}
        />

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>Notify me</Text>
            <Text style={[styles.rowSub, { color: textSecondary }]}>
              {Platform.OS === "web"
                ? "Browser notification when the time comes"
                : "Local notification — works offline"}
            </Text>
          </View>
          <Switch
            onValueChange={setNotifyEnabled}
            trackColor={{ true: "#E11D48" }}
            value={notifyEnabled}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>Add to calendar</Text>
            <Text style={[styles.rowSub, { color: textSecondary }]}>
              {Platform.OS === "web"
                ? "Opens pre-filled Google Calendar"
                : calendarTargets.length > 0
                  ? `Saves to ${calendarTargets[0]?.title}${
                      calendarTargets[0]?.subtitle ? ` (${calendarTargets[0]?.subtitle})` : ""
                    } — syncs to Google`
                  : "Saves to your device calendar"}
            </Text>
          </View>
          <Switch
            onValueChange={setCalendarEnabled}
            trackColor={{ true: "#E11D48" }}
            value={calendarEnabled}
          />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons color="#FF3B30" name="alert-circle-outline" size={16} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {savedUrl && (
          <Pressable
            onPress={() => {
              void Linking.openURL(savedUrl);
            }}
          >
            <Text style={styles.linkText}>Popup blocked? Tap here to open Google Calendar</Text>
          </Pressable>
        )}

        <Pressable
          disabled={!validity.ok || saving || (!notifyEnabled && !calendarEnabled)}
          onPress={() => {
            void onSave();
          }}
          style={[
            styles.saveBtn,
            {
              opacity: !validity.ok || saving || (!notifyEnabled && !calendarEnabled) ? 0.45 : 1,
            },
          ]}
        >
          <Text style={styles.saveText}>{saving ? "Saving…" : "Set reminder"}</Text>
        </Pressable>
        {!notifyEnabled && !calendarEnabled && (
          <Text style={[styles.hint, { color: textSecondary }]}>
            Pick at least one: notification or calendar.
          </Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cityLine: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 6,
    width: 34,
  },
  errorBox: {
    alignItems: "center",
    backgroundColor: "rgba(255,59,48,0.1)",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    padding: 10,
  },
  errorText: {
    color: "#FF3B30",
    flex: 1,
    fontSize: 13,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  input: {
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 14,
    textTransform: "uppercase",
  },
  linkText: {
    color: "#E11D48",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },
  root: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowSub: {
    fontSize: 13,
    marginTop: 2,
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    fontWeight: "600",
  },
  saveBtn: {
    alignItems: "center",
    backgroundColor: "#E11D48",
    borderRadius: 14,
    marginTop: 14,
    paddingVertical: 15,
  },
  saveText: {
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
    fontSize: 16,
    fontWeight: "600",
  },
  subLine: {
    fontSize: 13,
    marginTop: 2,
  },
  timeCard: {
    alignItems: "center",
    backgroundColor: "rgba(225,29,72,0.08)",
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
  timeTextWrap: {
    flex: 1,
  },
  warnBox: {
    alignItems: "center",
    backgroundColor: "rgba(255,159,10,0.12)",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    padding: 10,
  },
  warnText: {
    color: "#FF9F0A",
    flex: 1,
    fontSize: 13,
  },
});

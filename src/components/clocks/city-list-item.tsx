import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { JSX } from "react";
import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";

import { ReminderSheet } from "@/components/reminders/reminder-sheet";
import { RollingDigits } from "@/components/ui/rolling-digits";
import { ACCENT, type CityDefinition } from "@/lib/constants";
import { fonts } from "@/lib/fonts";
import { formatZonedTime } from "@/lib/reminders/time-helpers";
import { remindersForCity, useRemindersStore } from "@/store/reminders-store";
import { formatRelativeOffset, getDeviceTimezone, getZonedParts } from "@/lib/time";
import { useSettingsStore } from "@/store/settings-store";
import { useTimeStore } from "@/store/time-store";

type Props = {
  city: CityDefinition;
  onRemove?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
};

function CityListItemComponent({ city, onRemove, isFirst, isLast }: Props): JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const offsetMs = useTimeStore((s) => s.offsetMs);
  const isScrubbing = useTimeStore((s) => s.isScrubbing);
  // Live 1Hz tick only when not scrubbing — avoid extra list work on drag
  const nowMs = useTimeStore((s) => (s.isScrubbing ? 0 : s.nowMs));
  const use24Hour = useSettingsStore((s) => s.use24Hour);
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTargetMs, setSheetTargetMs] = useState(0);
  const allReminders = useRemindersStore((s) => s.reminders);
  const removeReminder = useRemindersStore((s) => s.removeReminder);
  const reminders = useMemo(() => remindersForCity(allReminders, city.id), [allReminders, city.id]);

  void nowMs;

  const parts = getZonedParts(city.timezone, offsetMs, use24Hour);
  const relative = formatRelativeOffset(city.timezone, offsetMs);
  const isDevice = city.timezone === getDeviceTimezone();

  const textPrimary = isDark ? "#FFFFFF" : "#111111";
  const textSecondary = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";

  return (
    <View style={styles.rowWrap}>
      <View style={styles.rail}>
        {!isFirst && (
          <View
            style={[
              styles.railLineTop,
              {
                backgroundColor: isDark ? "rgba(255,106,0,0.35)" : "rgba(255,106,0,0.4)",
              },
            ]}
          />
        )}
        <View style={[styles.railDot, parts.isDaytime ? styles.railDotDay : styles.railDotNight]} />
        {!isLast && (
          <View
            style={[
              styles.railLineBottom,
              {
                backgroundColor: isDark ? "rgba(255,106,0,0.35)" : "rgba(255,106,0,0.4)",
              },
            ]}
          />
        )}
      </View>

      <Pressable
        onLongPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onRemove?.();
        }}
        onPress={() => setExpanded((v) => !v)}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? "rgba(28,28,30,0.9)" : "#FFFFFF",
          },
        ]}
      >
        <View style={styles.mainRow}>
          <View style={styles.left}>
            <Text style={[styles.cityName, { color: textPrimary }]}>{city.label}</Text>
            <Text style={[styles.meta, { color: textSecondary }]}>
              {relative}
              {isDevice ? " · Device time zone" : ""}
            </Text>
            <Text style={[styles.region, { color: textSecondary }]}>{city.region}</Text>
          </View>

          <View style={styles.right}>
            <RollingDigits textStyle={styles.time} value={parts.timeLabelShort} />
            <View style={styles.abbrRow}>
              <Text style={[styles.abbr, { color: textSecondary }]}>{parts.abbreviation}</Text>
              <Ionicons
                color={textSecondary}
                name={expanded ? "chevron-up" : "chevron-down"}
                size={14}
              />
            </View>
          </View>
        </View>

        {expanded && (
          <View style={styles.expanded}>
            <Text style={[styles.dateLine, { color: textSecondary }]}>
              {parts.dateLabel} · UTC
              {parts.offsetMinutes >= 0 ? "+" : ""}
              {(parts.offsetMinutes / 60).toFixed(
                Number.isInteger(parts.offsetMinutes / 60) ? 0 : 1
              )}
            </Text>
            <View style={styles.digitRow}>
              {[parts.hour, parts.minute, parts.second].map((val, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.digitBox,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                    },
                  ]}
                >
                  <RollingDigits
                    digitWidth={18}
                    height={28}
                    textStyle={[styles.digit, { color: textPrimary }]}
                    value={val.toString().padStart(2, "0")}
                  />
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // Capture the slider instant at tap time — the store's
                // offsetMs is the authority, not render-time Date.now().
                setSheetTargetMs(Date.now() + offsetMs);
                setSheetOpen(true);
              }}
              style={[
                styles.remindBtn,
                {
                  backgroundColor: isDark ? "rgba(225,29,72,0.14)" : "rgba(225,29,72,0.08)",
                },
              ]}
            >
              <Ionicons color={ACCENT} name="notifications-outline" size={16} />
              <Text style={styles.remindText}>
                Remind me at {parts.timeLabelShort}
                {reminders.length > 0 ? ` · ${reminders.length} set` : ""}
              </Text>
            </Pressable>

            {reminders.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.reminderRow,
                  {
                    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)",
                  },
                ]}
              >
                <Ionicons
                  color={textSecondary}
                  name={r.calendarEventId ? "calendar-outline" : "notifications-outline"}
                  size={14}
                />
                <View style={styles.reminderTextWrap}>
                  <Text numberOfLines={1} style={[styles.reminderTitle, { color: textPrimary }]}>
                    {r.title}
                  </Text>
                  <Text style={[styles.reminderSub, { color: textSecondary }]}>
                    {formatZonedTime(r.targetEpochMs, r.timezone, use24Hour)}
                    {r.calendarEventId ? " · in calendar" : ""}
                    {r.notifyEnabled ? "" : " · calendar only"}
                  </Text>
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    void removeReminder(r.id);
                  }}
                >
                  <Ionicons color="#FF3B30" name="trash-outline" size={15} />
                </Pressable>
              </View>
            ))}

            {onRemove && (
              <Pressable
                onPress={() => {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  onRemove();
                }}
                style={styles.removeBtn}
              >
                <Ionicons color="#FF3B30" name="trash-outline" size={16} />
                <Text style={styles.removeText}>Remove city</Text>
              </Pressable>
            )}
          </View>
        )}
      </Pressable>
      {sheetOpen && (
        <ReminderSheet
          city={city}
          onClose={() => setSheetOpen(false)}
          targetEpochMs={sheetTargetMs}
          visible
        />
      )}
    </View>
  );
}

export const CityListItem = memo(CityListItemComponent);

const styles = StyleSheet.create({
  abbr: {
    fontSize: 12,
    fontWeight: "500",
  },
  abbrRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    justifyContent: "flex-end",
    marginTop: 2,
  },
  card: {
    borderCurve: "continuous",
    borderRadius: 16,
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cityName: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  dateLine: {
    fontSize: 13,
    marginBottom: 10,
  },
  digit: {
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  digitBox: {
    alignItems: "center",
    borderRadius: 10,
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  digitRow: {
    flexDirection: "row",
    gap: 8,
  },
  expanded: {
    borderTopColor: "rgba(128,128,128,0.15)",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  left: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  mainRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  rail: {
    alignItems: "center",
    marginRight: 10,
    width: 14,
  },
  railDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
    zIndex: 1,
  },
  railDotDay: {
    backgroundColor: ACCENT,
  },
  railDotNight: {
    backgroundColor: "#5E5CE6",
  },
  railLineBottom: {
    flex: 1,
    width: 2,
  },
  railLineTop: {
    flex: 1,
    width: 2,
  },
  region: {
    fontSize: 12,
    marginTop: 1,
  },
  remindBtn: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  remindText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: "600",
  },
  reminderRow: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  reminderSub: {
    fontSize: 12,
    marginTop: 1,
  },
  reminderTextWrap: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  removeBtn: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    paddingVertical: 4,
  },
  removeText: {
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "500",
  },
  right: {
    alignItems: "flex-end",
  },
  rowWrap: {
    flexDirection: "row",
    marginBottom: 10,
    minHeight: 88,
  },
  time: {
    color: ACCENT,
    fontFamily: fonts.semiBold,
    fontSize: 32,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    letterSpacing: -0.5,
  },
});

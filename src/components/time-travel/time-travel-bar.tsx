import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { ACCENT, TIME_TRAVEL_RANGE_MS } from "@/lib/constants";
import { fonts } from "@/lib/fonts";
import {
  formatOffsetHours,
  getDeviceTimezone,
  getZonedParts,
} from "@/lib/time";
import { useSettingsStore } from "@/store/settings-store";
import { useTimeStore } from "@/store/time-store";

type Props = {
  /** Use dark chrome styling (globe tab) */
  dark?: boolean;
};

const MINUTE_MS = 60_000;
/** Max rate we push scrub minutes into JS/Zustand — thumb never waits on this */
const SCRUB_COMMIT_MIN_MS = 120;

/**
 * Floating Time Travel card — solid fill (same language as the tab bar shell).
 */
export function TimeTravelBar({ dark }: Props): JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = dark ?? colorScheme === "dark";
  const offsetMs = useTimeStore((s) => s.offsetMs);
  const isScrubbing = useTimeStore((s) => s.isScrubbing);
  const scrubOffsetMs = useTimeStore((s) => s.scrubOffsetMs);
  const beginScrub = useTimeStore((s) => s.beginScrub);
  const endScrub = useTimeStore((s) => s.endScrub);
  const resetToNow = useTimeStore((s) => s.resetToNow);
  const nowMs = useTimeStore((s) => s.nowMs);
  const use24Hour = useSettingsStore((s) => s.use24Hour);

  const trackWidth = useSharedValue(1);
  const startOffset = useSharedValue(0);
  const liveOffset = useSharedValue(offsetMs);
  const lastPushedMinute = useSharedValue(Math.round(offsetMs / MINUTE_MS));
  const lastCommitAt = useSharedValue(0);
  const lastHapticHour = useRef(0);
  const pendingMinute = useSharedValue(Math.round(offsetMs / MINUTE_MS));

  useEffect(() => {
    if (isScrubbing) return;
    liveOffset.value = offsetMs;
    lastPushedMinute.value = Math.round(offsetMs / MINUTE_MS);
    pendingMinute.value = Math.round(offsetMs / MINUTE_MS);
  }, [offsetMs, isScrubbing, liveOffset, lastPushedMinute, pendingMinute]);

  const isNow = Math.abs(offsetMs) < 500;

  const deviceParts = useMemo(
    () => getZonedParts(getDeviceTimezone(), offsetMs, use24Hour),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offsetMs, use24Hour, nowMs]
  );

  const headerLabel = isNow
    ? "Time Travel"
    : `${deviceParts.timeLabelShort} (${formatOffsetHours(offsetMs)})`;

  const commitScrub = useCallback(
    (ms: number) => {
      scrubOffsetMs(ms);
      const hourBucket = Math.round(ms / (60 * 60 * 1000));
      if (hourBucket !== lastHapticHour.current) {
        lastHapticHour.current = hourBucket;
        void Haptics.selectionAsync();
      }
    },
    [scrubOffsetMs]
  );

  const onBegin = useCallback(() => {
    beginScrub();
  }, [beginScrub]);

  const onEnd = useCallback(
    (ms: number) => {
      endScrub(ms);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [endScrub]
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      "worklet";
      startOffset.value = liveOffset.value;
      lastPushedMinute.value = Math.round(liveOffset.value / MINUTE_MS);
      pendingMinute.value = lastPushedMinute.value;
      lastCommitAt.value = 0;
      runOnJS(onBegin)();
    })
    .onUpdate((e) => {
      "worklet";
      const width = trackWidth.value || 1;
      const deltaRatio = e.translationX / width;
      const deltaMs = deltaRatio * TIME_TRAVEL_RANGE_MS * 2;
      const next = Math.max(
        -TIME_TRAVEL_RANGE_MS,
        Math.min(TIME_TRAVEL_RANGE_MS, startOffset.value + deltaMs)
      );
      liveOffset.value = next;

      const minute = Math.round(next / MINUTE_MS);
      pendingMinute.value = minute;
      if (minute === lastPushedMinute.value) return;

      const now = performance.now();
      if (now - lastCommitAt.value < SCRUB_COMMIT_MIN_MS) return;

      lastCommitAt.value = now;
      lastPushedMinute.value = minute;
      runOnJS(commitScrub)(minute * MINUTE_MS);
    })
    .onEnd(() => {
      "worklet";
      const snapped = pendingMinute.value * MINUTE_MS;
      liveOffset.value = snapped;
      lastPushedMinute.value = pendingMinute.value;
      runOnJS(onEnd)(snapped);
    });

  const tap = Gesture.Tap().onEnd((e) => {
    "worklet";
    const width = trackWidth.value || 1;
    const ratio = Math.max(0, Math.min(1, e.x / width));
    const next = ratio * TIME_TRAVEL_RANGE_MS * 2 - TIME_TRAVEL_RANGE_MS;
    const snapped = Math.round(next / MINUTE_MS) * MINUTE_MS;
    liveOffset.value = snapped;
    lastPushedMinute.value = Math.round(snapped / MINUTE_MS);
    pendingMinute.value = lastPushedMinute.value;
    runOnJS(onBegin)();
    runOnJS(commitScrub)(snapped);
    runOnJS(onEnd)(snapped);
  });

  const gesture = Gesture.Race(pan, tap);

  const thumbStyle = useAnimatedStyle(() => {
    const progress =
      (liveOffset.value + TIME_TRAVEL_RANGE_MS) / (TIME_TRAVEL_RANGE_MS * 2);
    const p = Math.max(0, Math.min(1, progress));
    return {
      transform: [{ translateX: p * trackWidth.value }],
    };
  });

  const fillStyle = useAnimatedStyle(() => {
    const progress =
      (liveOffset.value + TIME_TRAVEL_RANGE_MS) / (TIME_TRAVEL_RANGE_MS * 2);
    const p = Math.max(0, Math.min(1, progress));
    return {
      width: p * trackWidth.value,
    };
  });

  const muted = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)";
  const text = isDark ? "#FFFFFF" : "#111111";
  // Thin track only — not a full card fill
  const trackBg = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";
  const fillColor = isDark
    ? "rgba(225, 29, 72, 0.4)"
    : "rgba(225, 29, 72, 0.22)";

  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              /* future: open extended timeline */
            }}
            style={styles.headerLeft}
          >
            <Text style={[styles.headerText, { color: text }]}>
              {headerLabel}
            </Text>
            <Ionicons color={muted} name="chevron-forward" size={14} />
          </Pressable>

          {!isNow ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                liveOffset.value = 0;
                lastPushedMinute.value = 0;
                pendingMinute.value = 0;
                resetToNow();
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
              }}
              style={styles.resetBtn}
            >
              <Ionicons color={ACCENT} name="refresh" size={16} />
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          ) : (
            <View style={styles.resetPlaceholder} />
          )}
        </View>

        <GestureDetector gesture={gesture}>
          <View
            onLayout={(e) => {
              trackWidth.value = e.nativeEvent.layout.width;
            }}
            style={styles.trackHit}
          >
            <View style={[styles.track, { backgroundColor: trackBg }]}>
              <Animated.View
                style={[
                  styles.trackFill,
                  fillStyle,
                  { backgroundColor: fillColor },
                ]}
              />
              <Animated.View style={[styles.thumb, thumbStyle]}>
                <View style={styles.thumbKnob} />
              </Animated.View>
            </View>
            <View style={styles.scaleRow}>
              <Text style={[styles.scaleText, { color: muted }]}>−12h</Text>
              <Text style={[styles.scaleText, { color: muted }]}>+12h</Text>
            </View>
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: "continuous",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 10,
    marginHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
  cardDark: {
    // Solid shell matching the floating tab bar
    backgroundColor: "rgba(28, 28, 30, 0.94)",
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  cardLight: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderColor: "rgba(0, 0, 0, 0.05)",
    shadowOpacity: 0.08,
  },
  content: {
    paddingBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    fontWeight: "600",
  },
  resetBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  resetPlaceholder: {
    height: 20,
    width: 56,
  },
  resetText: {
    color: ACCENT,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    fontWeight: "600",
  },
  scaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 2,
  },
  scaleText: {
    fontSize: 11,
    fontWeight: "500",
  },
  thumb: {
    marginLeft: -11,
    position: "absolute",
    top: -5,
  },
  thumbKnob: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.2)",
    elevation: 4,
    height: 22,
    width: 22,
  },
  track: {
    borderRadius: 3,
    height: 6,
    overflow: "visible",
    position: "relative",
    width: "100%",
  },
  trackFill: {
    borderRadius: 3,
    height: "100%",
  },
  trackHit: {
    // Transparent hit area only — never a second plate behind the track
    backgroundColor: "transparent",
    paddingVertical: 4,
  },
});

import type { JSX } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type RollingDigitProps = {
  digit: number;
  height: number;
  textStyle: TextStyle;
  width: number;
  /** When false, snap instantly (used while scrubbing). */
  animate: boolean;
};

/**
 * Apple Clock–style digit reel.
 * Strip is [9,0..9,0] so approaches from either side of a wrap stay continuous.
 */
function RollingDigit({
  digit,
  height,
  textStyle,
  width,
  animate,
}: RollingDigitProps): JSX.Element {
  const clamped = ((digit % 10) + 10) % 10;
  const index = useSharedValue(clamped);
  const prevRef = useRef(clamped);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === clamped) return;

    let delta = clamped - prev;
    if (delta > 5) delta -= 10;
    else if (delta < -5) delta += 10;

    const from = prev;
    const to = prev + delta;
    prevRef.current = clamped;

    cancelAnimation(index);

    if (!animate) {
      index.value = clamped;
      return;
    }

    // Start at `from` (may be -1 / 10 on wrap), ease to `to`, then rest on 0–9.
    index.value = from;
    index.value = withTiming(
      to,
      { duration: 220, easing: Easing.bezier(0.22, 1, 0.36, 1) },
      (finished) => {
        if (finished) {
          index.value = clamped;
        }
      }
    );
  }, [animate, clamped, index]);

  const reelStyle = useAnimatedStyle(() => ({
    // +1 because strip starts with a leading 9 for the 0→9 approach
    transform: [{ translateY: -(index.value + 1) * height }],
  }));

  const strip = useMemo(() => [9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0], []);

  return (
    <View style={{ height, overflow: "hidden", width }}>
      <Animated.View style={reelStyle}>
        {strip.map((n, i) => (
          <Text
            key={i}
            style={[
              textStyle,
              {
                fontVariant: ["tabular-nums"],
                height,
                includeFontPadding: false,
                lineHeight: height,
                textAlign: "center",
                width,
              },
            ]}
          >
            {n}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

type Props = {
  /** Digits / separators, e.g. `"15:42"` or `"3:05"` */
  value: string;
  textStyle: StyleProp<TextStyle>;
  /** Digit cell height; defaults from fontSize */
  height?: number;
  /** Per-digit width; defaults from fontSize */
  digitWidth?: number;
  /** Animate digit changes. Default true; disable while scrubbing. */
  animate?: boolean;
};

/**
 * Apple-style rolling time: each digit scrolls out and the next replaces it.
 */
export function RollingDigits({
  value,
  textStyle,
  height: heightProp,
  digitWidth: widthProp,
  animate = true,
}: Props): JSX.Element {
  const flatStyle = StyleSheet.flatten(textStyle) ?? {};
  const fontSize =
    typeof flatStyle.fontSize === "number" ? flatStyle.fontSize : 32;
  const height = heightProp ?? Math.round(fontSize * 1.15);
  const digitWidth = widthProp ?? Math.round(fontSize * 0.62);
  const colonWidth = Math.round(digitWidth * 0.45);

  return (
    <View style={[styles.row, { height }]}>
      {value.split("").map((ch, i) => {
        if (ch >= "0" && ch <= "9") {
          return (
            <RollingDigit
              animate={animate}
              digit={Number(ch)}
              height={height}
              key={`d-${i}`}
              textStyle={flatStyle}
              width={digitWidth}
            />
          );
        }
        const narrow = ch === ":" || ch === ".";
        return (
          <Text
            key={`s-${i}`}
            style={[
              flatStyle,
              {
                height,
                includeFontPadding: false,
                lineHeight: height,
                textAlign: narrow ? "center" : "left",
                ...(narrow ? { width: colonWidth } : {}),
              },
            ]}
          >
            {ch}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});

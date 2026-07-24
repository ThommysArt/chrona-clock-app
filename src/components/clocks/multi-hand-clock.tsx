import type { JSX } from "react";
import { useMemo } from "react";
import { useColorScheme, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { ACCENT, type CityDefinition } from "@/lib/constants";
import { fonts } from "@/lib/fonts";
import { getDeviceTimezone, getZonedParts } from "@/lib/time";
import { useSettingsStore } from "@/store/settings-store";
import { useTimeStore } from "@/store/time-store";

type Props = {
  cities: CityDefinition[];
  /**
   * Max outer size of the whole component (face + labels).
   * Dial is sized down so labels never clip the container/screen.
   */
  size?: number;
};

/** Soft Material tonal neutrals for secondary hands */
const NEUTRAL_HANDS_LIGHT = [
  "#49454F",
  "#625B71",
  "#79747E",
  "#5C5B60",
  "#6B6B70",
  "#78767A",
];
const NEUTRAL_HANDS_DARK = [
  "#CAC4D0",
  "#E8DEF8",
  "#CCC2DC",
  "#E6E1E5",
  "#D0C4C8",
  "#B0A7B8",
];

function polar(cx: number, cy: number, r: number, progress: number) {
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function estimateLabelWidth(label: string): number {
  // Soft Material chip: ~6.4px/char at 11pt medium + horizontal padding
  return Math.min(156, Math.max(68, label.length * 6.4 + 22));
}

/**
 * Spread labels slightly when multiple hands cluster so chips stay readable.
 * Pure geometric nudge along the arc — no layout engine needed.
 */
function deconflictProgress(progresses: number[]): number[] {
  const n = progresses.length;
  if (n <= 1) return progresses;

  const result = [...progresses];
  const minGap = 0.055; // ~20°

  // A few light relaxation passes
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let d = result[j]! - result[i]!;
        // Circular distance
        if (d > 0.5) d -= 1;
        if (d < -0.5) d += 1;
        if (Math.abs(d) >= minGap) continue;
        const push = ((minGap - Math.abs(d)) / 2) * (d >= 0 ? 1 : -1);
        result[i] = (result[i]! - push + 1) % 1;
        result[j] = (result[j]! + push + 1) % 1;
      }
    }
  }
  return result;
}

/**
 * Material-inspired multi-city analog dial.
 *
 * Design language:
 * - Soft elevation rings instead of hard strokes
 * - Rounded ticks / dots, no sharp geometry
 * - Tonal secondary hands + accent primary
 * - Soft Material 3 chips for city labels
 */
export function MultiHandClock({ cities, size = 320 }: Props): JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const offsetMs = useTimeStore((s) => s.offsetMs);
  const nowMs = useTimeStore((s) => s.nowMs);
  const use24Hour = useSettingsStore((s) => s.use24Hour);
  const deviceTz = getDeviceTimezone();

  const hands = useMemo(() => {
    const deviceIndex = cities.findIndex((c) => c.timezone === deviceTz);
    const primaryIndex = deviceIndex >= 0 ? deviceIndex : 0;
    const palette = isDark ? NEUTRAL_HANDS_DARK : NEUTRAL_HANDS_LIGHT;

    return cities.map((city, index) => {
      const parts = getZonedParts(city.timezone, offsetMs, use24Hour);
      const isPrimary = index === primaryIndex;
      const label = `${city.label} ${parts.timeLabelShort}`;
      return {
        city,
        parts,
        isPrimary,
        label,
        labelW: estimateLabelWidth(label),
        color: isPrimary ? ACCENT : palette[index % palette.length]!,
        progress: parts.dialProgress,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, offsetMs, use24Hour, nowMs, deviceTz, isDark]);

  const labelProgress = useMemo(
    () => deconflictProgress(hands.map((h) => h.progress)),
    [hands]
  );

  // Half the widest chip + gap outside the ring
  const maxHalfLabel = hands.reduce((m, h) => Math.max(m, h.labelW / 2), 40);
  const labelGap = 16;
  const radius = Math.max(72, size / 2 - maxHalfLabel - labelGap - 8);
  const svgSize = size;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const labelRadius = radius + labelGap;
  const faceOuter = radius + 12;

  // Draw secondary hands first so primary sits on top
  const ordered = [...hands]
    .map((h, i) => ({ ...h, labelProgress: labelProgress[i]! }))
    .sort((a, b) => Number(a.isPrimary) - Number(b.isPrimary));

  // —— Material tonal palette ——
  const faceTop = isDark ? "#2B2930" : "#FFFBFE";
  const faceBottom = isDark ? "#1C1B1F" : "#F3EDF7";
  const ringSoft = isDark ? "rgba(232,222,248,0.12)" : "rgba(103,80,164,0.08)";
  const ringAccent = isDark
    ? "rgba(251,113,133,0.22)"
    : "rgba(225,29,72,0.14)";
  const tickMajor = isDark ? "rgba(230,225,229,0.55)" : "rgba(73,69,79,0.45)";
  const tickMinor = isDark ? "rgba(230,225,229,0.18)" : "rgba(73,69,79,0.14)";
  const numberColor = isDark ? "rgba(230,225,229,0.72)" : "rgba(28,27,31,0.55)";
  const chipNeutralBg = isDark ? "#49454F" : "#E8DEF8";
  const chipNeutralFg = isDark ? "#E8DEF8" : "#1D192B";
  const shadowOuter = isDark
    ? "rgba(0,0,0,0.45)"
    : "rgba(103,80,164,0.10)";
  const shadowMid = isDark ? "rgba(0,0,0,0.28)" : "rgba(28,27,31,0.06)";
  const hubOuter = isDark ? "#E8DEF8" : ACCENT;

  return (
    <View style={{ width: svgSize, height: svgSize, overflow: "visible" }}>
      <Svg height={svgSize} width={svgSize}>
        <Defs>
          <LinearGradient id="m3Face" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0%" stopColor={faceTop} stopOpacity="1" />
            <Stop offset="100%" stopColor={faceBottom} stopOpacity="1" />
          </LinearGradient>
          <RadialGradient cx="50%" cy="42%" id="m3Glow" r="58%">
            <Stop
              offset="0%"
              stopColor={isDark ? "#3B2A32" : "#FFF5F7"}
              stopOpacity={isDark ? "0.55" : "0.9"}
            />
            <Stop
              offset="100%"
              stopColor={faceBottom}
              stopOpacity="0"
            />
          </RadialGradient>
          <RadialGradient cx="50%" cy="50%" id="m3Shadow" r="50%">
            <Stop offset="70%" stopColor={shadowOuter} stopOpacity="0" />
            <Stop offset="100%" stopColor={shadowOuter} stopOpacity="1" />
          </RadialGradient>
        </Defs>

        {/* Soft ambient elevation (Material shadow stack) */}
        <Circle
          cx={cx}
          cy={cy + 3}
          fill={shadowMid}
          opacity={0.55}
          r={faceOuter + 6}
        />
        <Circle
          cx={cx}
          cy={cy + 1}
          fill={shadowOuter}
          opacity={0.35}
          r={faceOuter + 3}
        />

        {/* Soft face disc */}
        <Circle
          cx={cx}
          cy={cy}
          fill="url(#m3Face)"
          r={faceOuter}
        />
        <Circle
          cx={cx}
          cy={cy}
          fill="url(#m3Glow)"
          r={faceOuter}
        />

        {/* Soft accent halo ring */}
        <Circle
          cx={cx}
          cy={cy}
          fill="none"
          r={radius + 4}
          stroke={ringAccent}
          strokeWidth={6}
        />
        {/* Subtle track ring */}
        <Circle
          cx={cx}
          cy={cy}
          fill="none"
          r={radius}
          stroke={ringSoft}
          strokeWidth={2.5}
        />

        {/* Minute dots — soft, low contrast */}
        {Array.from({ length: 60 }).map((_, i) => {
          if (i % 5 === 0) return null;
          const p = polar(cx, cy, radius - 8, i / 60);
          return (
            <Circle
              cx={p.x}
              cy={p.y}
              fill={tickMinor}
              key={`md-${i}`}
              r={1.25}
            />
          );
        })}

        {/* Hour markers — soft rounded pills (Material tick language) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const isCardinal = i % 3 === 0;
          const outer = polar(cx, cy, radius - 6, i / 12);
          const inner = polar(
            cx,
            cy,
            radius - (isCardinal ? 18 : 14),
            i / 12
          );
          return (
            <Line
              key={`hm-${i}`}
              stroke={isCardinal ? tickMajor : tickMinor}
              strokeLinecap="round"
              strokeWidth={isCardinal ? 3.25 : 2.25}
              x1={inner.x}
              x2={outer.x}
              y1={inner.y}
              y2={outer.y}
            />
          );
        })}

        {/* Soft cardinal numerals only — cleaner Material face */}
        {[12, 3, 6, 9].map((n) => {
          const pos = polar(cx, cy, radius - 34, (n % 12) / 12);
          return (
            <SvgText
              fill={numberColor}
              fontFamily={fonts.medium}
              fontSize={15}
              fontWeight="500"
              key={`n-${n}`}
              textAnchor="middle"
              x={pos.x}
              y={pos.y + 5}
            >
              {n}
            </SvgText>
          );
        })}

        {/* Hands + city chips */}
        {ordered.map(
          ({
            city,
            color,
            progress,
            isPrimary,
            label,
            labelW,
            labelProgress: lp,
          }) => {
            const handLen = isPrimary ? radius - 30 : radius - 44;
            const tip = polar(cx, cy, handLen, progress);
            // Soft counterweight tail (Material clock hands often have one)
            const tail = polar(cx, cy, isPrimary ? 14 : 10, (progress + 0.5) % 1);
            const raw = polar(cx, cy, labelRadius, lp);
            const labelH = 24;
            const halfW = labelW / 2;
            const halfH = labelH / 2;
            const pad = 3;
            const lx = Math.min(
              svgSize - halfW - pad,
              Math.max(halfW + pad, raw.x)
            );
            const ly = Math.min(
              svgSize - halfH - pad,
              Math.max(halfH + pad, raw.y)
            );

            return (
              <G key={city.id}>
                {/* Soft hand shadow */}
                <Line
                  opacity={0.12}
                  stroke="#000"
                  strokeLinecap="round"
                  strokeWidth={isPrimary ? 5 : 3}
                  x1={tail.x}
                  x2={tip.x + 0.8}
                  y1={tail.y + 1.2}
                  y2={tip.y + 1.2}
                />
                {/* Hand body */}
                <Line
                  stroke={color}
                  strokeLinecap="round"
                  strokeWidth={isPrimary ? 4 : 2.5}
                  x1={tail.x}
                  x2={tip.x}
                  y1={tail.y}
                  y2={tip.y}
                />
                {isPrimary && (
                  <>
                    {/* Soft tip glow */}
                    <Circle
                      cx={tip.x}
                      cy={tip.y}
                      fill={ACCENT}
                      opacity={0.22}
                      r={8}
                    />
                    <Circle cx={tip.x} cy={tip.y} fill={ACCENT} r={4} />
                  </>
                )}

                {/* Material 3 tonal chip */}
                <G transform={`translate(${lx - halfW}, ${ly - halfH})`}>
                  <Rect
                    fill={isPrimary ? ACCENT : chipNeutralBg}
                    height={labelH}
                    rx={12}
                    ry={12}
                    width={labelW}
                  />
                  <SvgText
                    fill={isPrimary ? "#FFFFFF" : chipNeutralFg}
                    fontFamily={fonts.medium}
                    fontSize={11}
                    fontWeight="500"
                    textAnchor="middle"
                    x={labelW / 2}
                    y={16}
                  >
                    {label}
                  </SvgText>
                </G>
              </G>
            );
          }
        )}

        {/* Soft Material hub */}
        <Circle cx={cx} cy={cy} fill={hubOuter} opacity={0.18} r={11} />
        <Circle cx={cx} cy={cy} fill={hubOuter} r={7} />
        <Circle
          cx={cx}
          cy={cy}
          fill={isDark ? "#1C1B1F" : "#FFFBFE"}
          r={3}
        />
      </Svg>
    </View>
  );
}

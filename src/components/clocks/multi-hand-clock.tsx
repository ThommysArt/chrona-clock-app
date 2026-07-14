import type { JSX } from "react";
import { useMemo } from "react";
import { useColorScheme, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
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

const NEUTRAL_HANDS = [
  "#1C1C1E",
  "#3A3A3C",
  "#636366",
  "#8E8E93",
  "#48484A",
  "#636366",
];

function polar(cx: number, cy: number, r: number, progress: number) {
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function estimateLabelWidth(label: string): number {
  // ~6.2px per character at 11pt semiBold + pill padding
  return Math.min(148, Math.max(64, label.length * 6.2 + 18));
}

/**
 * Multi-city analog dial.
 * Outer `size` is the full SVG box; the face is inset so city pills
 * (especially long ones at 3 / 9 o'clock) never get cut off.
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
        color: isPrimary ? ACCENT : NEUTRAL_HANDS[index % NEUTRAL_HANDS.length]!,
        progress: parts.dialProgress,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, offsetMs, use24Hour, nowMs, deviceTz]);

  // Half the widest pill + small gap outside the ring
  const maxHalfLabel = hands.reduce(
    (m, h) => Math.max(m, h.labelW / 2),
    40
  );
  const labelGap = 14;
  // Face radius so ring + labels fit inside `size`
  const radius = Math.max(
    70,
    size / 2 - maxHalfLabel - labelGap - 6
  );
  const svgSize = size;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const labelRadius = radius + labelGap;

  const ordered = [...hands].sort(
    (a, b) => Number(a.isPrimary) - Number(b.isPrimary)
  );

  const faceBg = isDark ? "#1C1C1E" : "#FFFFFF";
  const faceRing = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const tickMajor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)";
  const tickMinor = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)";
  const numberColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.38)";
  const neutralLabelBg = "#2C2C2E";

  return (
    <View style={{ width: svgSize, height: svgSize, overflow: "visible" }}>
      <Svg height={svgSize} width={svgSize}>
        <Defs>
          <LinearGradient id="faceShade" x1="0" x2="0" y1="0" y2="1">
            <Stop
              offset="0%"
              stopColor={isDark ? "#252528" : "#FFFFFF"}
              stopOpacity="1"
            />
            <Stop
              offset="100%"
              stopColor={isDark ? "#161618" : "#F7F7F8"}
              stopOpacity="1"
            />
          </LinearGradient>
        </Defs>

        <Circle
          cx={cx}
          cy={cy}
          fill="url(#faceShade)"
          r={radius + 10}
          stroke={faceRing}
          strokeWidth={1}
        />
        <Circle
          cx={cx}
          cy={cy}
          fill="none"
          r={radius}
          stroke={tickMinor}
          strokeWidth={1}
        />

        {Array.from({ length: 60 }).map((_, i) => {
          const isHour = i % 5 === 0;
          const outer = polar(cx, cy, radius - 2, i / 60);
          const inner = polar(cx, cy, radius - (isHour ? 14 : 7), i / 60);
          return (
            <Line
              key={`t-${i}`}
              stroke={isHour ? tickMajor : tickMinor}
              strokeLinecap="round"
              strokeWidth={isHour ? 2 : 1}
              x1={inner.x}
              x2={outer.x}
              y1={inner.y}
              y2={outer.y}
            />
          );
        })}

        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => {
          const pos = polar(cx, cy, radius - 28, (n % 12) / 12);
          const isCardinal = n % 3 === 0;
          return (
            <SvgText
              fill={numberColor}
              fontFamily={fonts.medium}
              fontSize={isCardinal ? 16 : 12}
              fontWeight={isCardinal ? "600" : "500"}
              key={`n-${n}`}
              textAnchor="middle"
              x={pos.x}
              y={pos.y + (isCardinal ? 5 : 4)}
            >
              {n}
            </SvgText>
          );
        })}

        {ordered.map(({ city, color, progress, isPrimary, label, labelW }) => {
          const handLen = isPrimary ? radius - 28 : radius - 42;
          const tip = polar(cx, cy, handLen, progress);
          const raw = polar(cx, cy, labelRadius, progress);
          const labelH = 22;

          // Clamp pill fully inside the SVG box so nothing is ever cut
          const halfW = labelW / 2;
          const halfH = labelH / 2;
          const pad = 2;
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
              <Line
                stroke={color}
                strokeLinecap="round"
                strokeWidth={isPrimary ? 3.5 : 1.75}
                x1={cx}
                x2={tip.x}
                y1={cy}
                y2={tip.y}
              />
              {isPrimary && (
                <Circle cx={tip.x} cy={tip.y} fill={ACCENT} r={3.5} />
              )}

              <G transform={`translate(${lx - halfW}, ${ly - halfH})`}>
                <Rect
                  fill={isPrimary ? ACCENT : neutralLabelBg}
                  height={labelH}
                  rx={11}
                  ry={11}
                  width={labelW}
                />
                <SvgText
                  fill="#FFFFFF"
                  fontFamily={fonts.semiBold}
                  fontSize={11}
                  fontWeight="600"
                  textAnchor="middle"
                  x={labelW / 2}
                  y={15}
                >
                  {label}
                </SvgText>
              </G>
            </G>
          );
        })}

        <Circle cx={cx} cy={cy} fill={ACCENT} r={6} />
        <Circle cx={cx} cy={cy} fill={faceBg} r={2.5} />
      </Svg>
    </View>
  );
}

"use no memo";

import type { JSX } from "react";
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";

import type { WidgetCityRow } from "@/widgets/shared/widget-data";
import {
  computeAnalogClockLayout,
  widgetTheme,
} from "@/widgets/shared/widget-layout";

type Theme = "light" | "dark";

type Props = {
  /** City for single-hand / digital readout (configured or primary) */
  city: WidgetCityRow | null;
  /** All cities for multi-hand mode on larger tiles */
  cities: WidgetCityRow[];
  theme?: Theme;
  width: number;
  height: number;
};

const NEUTRAL_LIGHT = [
  "#49454F",
  "#625B71",
  "#79747E",
  "#5C5B60",
  "#6B6B70",
  "#78767A",
];
const NEUTRAL_DARK = [
  "#CAC4D0",
  "#E8DEF8",
  "#CCC2DC",
  "#E6E1E5",
  "#D0C4C8",
  "#B0A7B8",
];

type HandSpec = {
  progress: number;
  color: string;
  isPrimary: boolean;
  label: string;
  /** Minute hand (shorter stroke width, longer length) */
  kind: "city" | "hour" | "minute";
};

/**
 * Analog home-screen clock. Small tiles show one city (hour + minute hands);
 * larger tiles draw multi-hand dials for every saved place.
 */
export function ChronaClockWidget({
  city,
  cities,
  theme = "light",
  width,
  height,
}: Props): JSX.Element {
  const isDark = theme === "dark";
  const colors = widgetTheme(isDark);
  const layout = computeAnalogClockLayout(width, height);
  const palette = isDark ? NEUTRAL_DARK : NEUTRAL_LIGHT;

  if (!city && cities.length === 0) {
    return (
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: colors.bg,
          borderRadius: 24,
          padding: layout.padding,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <TextWidget
          style={{
            color: colors.muted,
            fontSize: 13,
            fontFamily: "Manrope_500Medium",
          }}
          text="Add a city in Chrona"
        />
      </FlexWidget>
    );
  }

  const useMulti =
    layout.multiHand && cities.length > 1;

  let hands: HandSpec[];
  if (useMulti) {
    hands = cities.map((c, i) => {
      const isPrimary = city
        ? c.id === city.id
        : c.isDevice || i === 0;
      return {
        progress: c.dialProgress,
        color: isPrimary ? colors.accent : palette[i % palette.length]!,
        isPrimary,
        label: c.label,
        kind: "city" as const,
      };
    });
  } else {
    const c = city ?? cities[0]!;
    hands = [
      {
        progress: c.hourHandProgress,
        color: colors.accent,
        isPrimary: true,
        label: c.label,
        kind: "hour",
      },
      {
        progress: c.minuteHandProgress,
        color: isDark ? "#E8DEF8" : "#49454F",
        isPrimary: false,
        label: "",
        kind: "minute",
      },
    ];
  }

  const svg = buildClockSvg({
    size: layout.dialSize,
    isDark,
    accent: colors.accent,
    hands,
    showLabels: layout.showLabels && useMulti,
  });

  const focus = city ?? cities[0]!;
  const digital = focus.timeLabelShort;
  const label = focus.label;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: colors.bg,
        borderRadius: 24,
        padding: layout.padding,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <SvgWidget
        svg={svg}
        style={{
          height: layout.dialSize,
          width: layout.dialSize,
        }}
      />
      {layout.showDigital ? (
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 6,
            width: "match_parent",
          }}
        >
          <TextWidget
            style={{
              color: colors.title,
              fontSize: layout.cityFontSize,
              fontFamily: "Manrope_600SemiBold",
            }}
            text={label}
            maxLines={1}
            truncate="END"
          />
          <TextWidget
            style={{
              color: colors.accent,
              fontSize: layout.timeFontSize,
              fontFamily: "Manrope_700Bold",
              marginLeft: 8,
            }}
            text={digital}
          />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

function polar(cx: number, cy: number, r: number, progress: number) {
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function buildClockSvg(opts: {
  size: number;
  isDark: boolean;
  accent: string;
  hands: HandSpec[];
  showLabels: boolean;
}): string {
  const { size, isDark, accent, hands, showLabels } = opts;
  const cx = size / 2;
  const cy = size / 2;
  const pad = showLabels ? size * 0.14 : size * 0.06;
  const radius = Math.max(20, size / 2 - pad);
  const faceOuter = radius + Math.max(4, size * 0.03);

  const faceTop = isDark ? "#2B2930" : "#FFFBFE";
  const faceBottom = isDark ? "#1C1B1F" : "#F3EDF7";
  const ringSoft = isDark ? "rgba(232,222,248,0.18)" : "rgba(103,80,164,0.10)";
  const ringAccent = isDark
    ? "rgba(251,113,133,0.28)"
    : "rgba(225,29,72,0.16)";
  const tickMajor = isDark ? "rgba(230,225,229,0.55)" : "rgba(73,69,79,0.45)";
  const tickMinor = isDark ? "rgba(230,225,229,0.18)" : "rgba(73,69,79,0.14)";
  const numberColor = isDark
    ? "rgba(230,225,229,0.72)"
    : "rgba(28,27,31,0.55)";
  const chipBg = isDark ? "#49454F" : "#E8DEF8";
  const chipFg = isDark ? "#E8DEF8" : "#1D192B";

  const ticks: string[] = [];
  for (let i = 0; i < 12; i++) {
    const isCardinal = i % 3 === 0;
    const outer = polar(cx, cy, radius - 2, i / 12);
    const inner = polar(
      cx,
      cy,
      radius - (isCardinal ? size * 0.055 : size * 0.04),
      i / 12
    );
    ticks.push(
      `<line x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="${isCardinal ? tickMajor : tickMinor}" stroke-width="${isCardinal ? 2.5 : 1.75}" stroke-linecap="round"/>`
    );
  }

  const numerals: string[] = [];
  if (size >= 100) {
    for (const n of [12, 3, 6, 9]) {
      const pos = polar(cx, cy, radius - size * 0.1, (n % 12) / 12);
      numerals.push(
        `<text x="${pos.x.toFixed(1)}" y="${(pos.y + 4).toFixed(1)}" fill="${numberColor}" font-size="${Math.max(9, size * 0.05).toFixed(0)}" font-family="sans-serif" font-weight="500" text-anchor="middle">${n}</text>`
      );
    }
  }

  const ordered = [...hands].sort(
    (a, b) => Number(a.isPrimary) - Number(b.isPrimary)
  );

  const handLines: string[] = [];
  for (const hand of ordered) {
    let len: number;
    let sw: number;
    if (hand.kind === "minute") {
      len = radius * 0.78;
      sw = Math.max(1.5, size * 0.012);
    } else if (hand.kind === "hour") {
      len = radius * 0.55;
      sw = Math.max(2.5, size * 0.022);
    } else {
      // multi-city hand
      len = hand.isPrimary ? radius * 0.74 : radius * 0.68;
      sw = hand.isPrimary
        ? Math.max(2.5, size * 0.02)
        : Math.max(1.75, size * 0.014);
    }
    const tip = polar(cx, cy, len, hand.progress);
    handLines.push(
      `<line x1="${cx}" y1="${cy}" x2="${tip.x.toFixed(1)}" y2="${tip.y.toFixed(1)}" stroke="${hand.color}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>`
    );
  }

  const labels: string[] = [];
  if (showLabels) {
    const labelR = radius + Math.max(10, size * 0.07);
    const labeled = ordered.filter((h) => h.label && h.kind === "city").slice(0, 4);
    for (const hand of labeled) {
      const pos = polar(cx, cy, labelR, hand.progress);
      const text = hand.label.slice(0, 10);
      const bg = hand.isPrimary ? accent : chipBg;
      const fg = hand.isPrimary ? "#FFFFFF" : chipFg;
      const tw = Math.min(72, Math.max(28, text.length * 5.5 + 10));
      const th = Math.max(12, size * 0.055);
      labels.push(
        `<rect x="${(pos.x - tw / 2).toFixed(1)}" y="${(pos.y - th / 2).toFixed(1)}" width="${tw.toFixed(1)}" height="${th.toFixed(1)}" rx="${(th / 2).toFixed(1)}" fill="${bg}"/>`,
        `<text x="${pos.x.toFixed(1)}" y="${(pos.y + th * 0.22).toFixed(1)}" fill="${fg}" font-size="${Math.max(7, size * 0.035).toFixed(0)}" font-family="sans-serif" font-weight="600" text-anchor="middle">${escapeXml(text)}</text>`
      );
    }
  }

  const hubR = Math.max(3, size * 0.025);
  const hubOuter = Math.max(5, size * 0.04);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${faceTop}"/>
      <stop offset="100%" stop-color="${faceBottom}"/>
    </linearGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${faceOuter.toFixed(1)}" fill="url(#face)"/>
  <circle cx="${cx}" cy="${cy}" r="${(radius + 3).toFixed(1)}" fill="none" stroke="${ringAccent}" stroke-width="4"/>
  <circle cx="${cx}" cy="${cy}" r="${radius.toFixed(1)}" fill="none" stroke="${ringSoft}" stroke-width="2"/>
  ${ticks.join("\n  ")}
  ${numerals.join("\n  ")}
  ${handLines.join("\n  ")}
  <circle cx="${cx}" cy="${cy}" r="${hubOuter.toFixed(1)}" fill="${isDark ? "#E8DEF8" : accent}" opacity="0.35"/>
  <circle cx="${cx}" cy="${cy}" r="${hubR.toFixed(1)}" fill="${accent}"/>
  ${labels.join("\n  ")}
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

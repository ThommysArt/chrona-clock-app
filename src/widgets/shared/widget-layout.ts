/**
 * Android home-screen widget size math.
 *
 * Cell → dp formula (Android App Widget docs):
 *   sizeDp = 70 × cells − 30
 *   1→40, 2→110, 3→180, 4→250, 5→320, 6→390
 *
 * `widgetInfo.width` / `height` from react-native-android-widget are already in dp.
 * Always size layouts from those values — never hardcode a single aspect ratio.
 */

export const ANDROID_CELL_DP = (cells: number): number => 70 * cells - 30;

/** Approximate cell count from a reported dp dimension. */
export function approxCells(dp: number): number {
  if (dp <= 0) return 1;
  return Math.max(1, Math.round((dp + 30) / 70));
}

/** Hex colors typed for react-native-android-widget `ColorProp`. */
export type WidgetThemeColors = {
  bg: `#${string}`;
  title: `#${string}`;
  muted: `#${string}`;
  rowBg: `#${string}`;
  accent: `#${string}`;
  dayDot: `#${string}`;
  nightDot: `#${string}`;
};

export function widgetTheme(isDark: boolean): WidgetThemeColors {
  return {
    bg: isDark ? "#1C1B1F" : "#FFFBFE",
    title: isDark ? "#E6E1E5" : "#1C1B1F",
    muted: isDark ? "#CAC4D0" : "#49454F",
    rowBg: isDark ? "#2B2930" : "#F3EDF7",
    accent: "#E11D48",
    dayDot: "#E11D48",
    nightDot: "#5E5CE6",
  };
}

export type WorldClockLayout = {
  width: number;
  height: number;
  padding: number;
  headerHeight: number;
  listHeight: number;
  columns: 1 | 2;
  /** Fixed height for every city cell — equal cards, no stretch. */
  rowHeight: number;
  gap: number;
  showHeader: boolean;
  showMeta: boolean;
  cityFontSize: number;
  timeFontSize: number;
  metaFontSize: number;
  headerFontSize: number;
  brandFontSize: number;
  compact: boolean;
};

/**
 * Derive a world-clock layout from the actual widget bounds.
 * Supports 2×2, 2×4, 2×6, 4×2, 4×4, 4×6, etc.
 */
export function computeWorldClockLayout(
  width: number,
  height: number
): WorldClockLayout {
  const w = Math.max(40, Math.round(width));
  const h = Math.max(40, Math.round(height));
  const cellsW = approxCells(w);
  const cellsH = approxCells(h);

  const compact = w < 150 || h < 120;
  const padding = compact ? 8 : cellsW >= 4 ? 14 : 10;
  // Hide chrome on very short widgets so city rows get the space
  const showHeader = h >= 100;
  const headerHeight = showHeader ? (compact ? 20 : 26) : 0;
  const headerGap = showHeader ? 8 : 0;
  const gap = compact ? 4 : 6;

  const contentW = Math.max(1, w - padding * 2);
  const listHeight = Math.max(36, h - padding * 2 - headerHeight - headerGap);

  // Two columns once we have ~4 cells of width (or a clearly wide landscape)
  const columns: 1 | 2 =
    contentW >= 210 || (cellsW >= 4 && contentW >= 180) ? 2 : 1;

  // Meta line (offset · TZ) needs vertical room
  const showMeta = !compact && h >= 110;
  // Target a comfortable row; ListWidget scrolls when content overflows
  const idealRow = showMeta ? (compact ? 48 : 54) : compact ? 36 : 42;
  // On tall single-column widgets, gently grow rows so cards fill space evenly
  // without exceeding a sensible max (keeps cards equal, never stretch-weird)
  let rowHeight = idealRow;
  if (columns === 1 && listHeight > idealRow * 2) {
    // Estimate how many rows would fit at ideal size; grow slightly if only a few
    const fitAtIdeal = Math.max(1, Math.floor((listHeight + gap) / (idealRow + gap)));
    if (fitAtIdeal <= 4) {
      const grown = Math.floor((listHeight - gap * (fitAtIdeal - 1)) / fitAtIdeal);
      rowHeight = Math.min(72, Math.max(idealRow, grown));
    }
  }
  // Two-column cells can be a bit shorter
  if (columns === 2) {
    rowHeight = Math.min(rowHeight, showMeta ? 56 : 40);
  }

  return {
    width: w,
    height: h,
    padding,
    headerHeight,
    listHeight,
    columns,
    rowHeight,
    gap,
    showHeader,
    showMeta,
    cityFontSize: compact ? 12 : columns === 2 ? 13 : 14,
    timeFontSize: compact ? 16 : columns === 2 ? 18 : 22,
    metaFontSize: compact ? 10 : 11,
    headerFontSize: compact ? 13 : 15,
    brandFontSize: compact ? 10 : 11,
    compact,
  };
}

export type NowClockLayout = {
  width: number;
  height: number;
  padding: number;
  brandFontSize: number;
  cityFontSize: number;
  timeFontSize: number;
  metaFontSize: number;
  horizontal: boolean;
  compact: boolean;
};

/** Single-city digital clock — adapts to 2×2, 2×3, 4×2, etc. */
export function computeNowClockLayout(
  width: number,
  height: number
): NowClockLayout {
  const w = Math.max(40, Math.round(width));
  const h = Math.max(40, Math.round(height));
  const compact = w < 140 || h < 120;
  // Landscape-ish: put time beside city meta
  const horizontal = w >= h * 1.35 && w >= 200;
  const padding = compact ? 10 : horizontal ? 16 : 14;

  // Scale time type to the shorter side
  const shortSide = Math.min(w, h);
  let timeFontSize = Math.round(shortSide * (horizontal ? 0.28 : 0.32));
  timeFontSize = Math.min(horizontal ? 48 : 44, Math.max(compact ? 22 : 28, timeFontSize));

  return {
    width: w,
    height: h,
    padding,
    brandFontSize: compact ? 10 : 12,
    cityFontSize: compact ? 13 : horizontal ? 18 : 16,
    timeFontSize,
    metaFontSize: compact ? 10 : 12,
    horizontal,
    compact,
  };
}

export type AnalogClockLayout = {
  width: number;
  height: number;
  padding: number;
  /** Dial pixel size (square) */
  dialSize: number;
  showLabels: boolean;
  showDigital: boolean;
  multiHand: boolean;
  cityFontSize: number;
  timeFontSize: number;
  compact: boolean;
};

/** Analog / multi-hand clock face sizing. */
export function computeAnalogClockLayout(
  width: number,
  height: number
): AnalogClockLayout {
  const w = Math.max(40, Math.round(width));
  const h = Math.max(40, Math.round(height));
  const compact = w < 140 || h < 140;
  const padding = compact ? 6 : 10;
  const showDigital = h >= 150 && w >= 150;
  const showLabels = w >= 160 && h >= 160;
  // Multi-hand when we have room; single-hand on tiny tiles
  const multiHand = w >= 120 && h >= 120;
  const digitalH = showDigital ? 28 : 0;
  const dialSize = Math.max(
    48,
    Math.min(w - padding * 2, h - padding * 2 - digitalH)
  );

  return {
    width: w,
    height: h,
    padding,
    dialSize,
    showLabels,
    showDigital,
    multiHand,
    cityFontSize: compact ? 10 : 12,
    timeFontSize: compact ? 12 : 14,
    compact,
  };
}

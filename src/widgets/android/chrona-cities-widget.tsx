"use no memo";

import type { JSX } from "react";
import {
  FlexWidget,
  ListWidget,
  TextWidget,
} from "react-native-android-widget";

import type { WidgetCityRow } from "@/widgets/shared/widget-data";
import {
  computeWorldClockLayout,
  widgetTheme,
  type WorldClockLayout,
} from "@/widgets/shared/widget-layout";

type Theme = "light" | "dark";

type Props = {
  cities: WidgetCityRow[];
  theme?: Theme;
  /** Actual widget width in dp (from WidgetInfo) */
  width: number;
  /** Actual widget height in dp (from WidgetInfo) */
  height: number;
};

/**
 * Adaptive multi-city world clock.
 *
 * Layout is computed from real widget bounds so 2×2 / 2×4 / 4×2 / 4×4 / 4×6
 * all look intentional. Equal-height cards; ListWidget enables scrolling when
 * there are more cities than fit.
 */
export function ChronaCitiesWidget({
  cities,
  theme = "light",
  width,
  height,
}: Props): JSX.Element {
  const isDark = theme === "dark";
  const colors = widgetTheme(isDark);
  const layout = computeWorldClockLayout(width, height);

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
      }}
    >
      {layout.showHeader ? (
        <FlexWidget
          style={{
            width: "match_parent",
            height: layout.headerHeight,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <TextWidget
            style={{
              color: colors.title,
              fontSize: layout.headerFontSize,
              fontFamily: "Manrope_600SemiBold",
            }}
            text="World Clock"
          />
          <TextWidget
            style={{
              color: colors.accent,
              fontSize: layout.brandFontSize,
              fontFamily: "Manrope_600SemiBold",
            }}
            text="CHRONA"
          />
        </FlexWidget>
      ) : null}

      {cities.length === 0 ? (
        <FlexWidget
          style={{
            width: "match_parent",
            height: layout.listHeight,
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
            text="Add cities in Chrona"
          />
        </FlexWidget>
      ) : (
        <ListWidget
          style={{
            height: layout.listHeight,
            width: "match_parent",
          }}
        >
          {buildCityRows(cities, layout, colors)}
        </ListWidget>
      )}
    </FlexWidget>
  );
}

function buildCityRows(
  cities: WidgetCityRow[],
  layout: WorldClockLayout,
  colors: ReturnType<typeof widgetTheme>
): JSX.Element[] {
  const { columns, rowHeight, gap, width, padding } = layout;
  const contentW = Math.max(1, width - padding * 2);

  if (columns === 1) {
    return cities.map((city, index) => (
      <CityCard
        key={city.id}
        city={city}
        layout={layout}
        colors={colors}
        width={contentW}
        marginBottom={index === cities.length - 1 ? 0 : gap}
      />
    ));
  }

  // Two-column rows with explicit dp widths (weight+wrap_content is unreliable)
  const cellW = Math.floor((contentW - gap) / 2);
  const rows: JSX.Element[] = [];
  for (let i = 0; i < cities.length; i += 2) {
    const left = cities[i]!;
    const right = cities[i + 1];
    const isLast = i + 2 >= cities.length;
    rows.push(
      <FlexWidget
        key={`row-${left.id}`}
        style={{
          width: contentW,
          height: rowHeight,
          flexDirection: "row",
          marginBottom: isLast ? 0 : gap,
        }}
      >
        <CityCard
          city={left}
          layout={layout}
          colors={colors}
          width={cellW}
          marginRight={right ? gap : 0}
        />
        {right ? (
          <CityCard
            city={right}
            layout={layout}
            colors={colors}
            width={cellW}
          />
        ) : null}
      </FlexWidget>
    );
  }
  return rows;
}

type CardProps = {
  city: WidgetCityRow;
  layout: WorldClockLayout;
  colors: ReturnType<typeof widgetTheme>;
  width: number;
  marginBottom?: number;
  marginRight?: number;
};

function CityCard({
  city,
  layout,
  colors,
  width,
  marginBottom = 0,
  marginRight = 0,
}: CardProps): JSX.Element {
  return (
    <FlexWidget
      style={{
        width,
        height: layout.rowHeight,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.rowBg,
        borderRadius: layout.compact ? 12 : 14,
        paddingHorizontal: layout.compact ? 8 : 12,
        paddingVertical: 0,
        marginBottom,
        marginRight,
      }}
    >
      <FlexWidget
        style={{
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <TextWidget
          style={{
            color: colors.title,
            fontSize: layout.cityFontSize,
            fontFamily: "Manrope_600SemiBold",
          }}
          text={city.label}
          maxLines={1}
          truncate="END"
        />
        {layout.showMeta ? (
          <TextWidget
            style={{
              color: colors.muted,
              fontSize: layout.metaFontSize,
              fontFamily: "Manrope_500Medium",
              marginTop: 1,
            }}
            text={`${city.relative} · ${city.abbreviation}`}
            maxLines={1}
            truncate="END"
          />
        ) : null}
      </FlexWidget>
      <TextWidget
        style={{
          color: colors.accent,
          fontSize: layout.timeFontSize,
          fontFamily: "Manrope_700Bold",
          marginLeft: 6,
        }}
        text={city.timeLabelShort}
      />
    </FlexWidget>
  );
}

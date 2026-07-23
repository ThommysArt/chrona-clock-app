"use no memo";

import type { JSX } from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

import type { WidgetCityRow } from "@/widgets/shared/widget-data";
import {
  computeNowClockLayout,
  widgetTheme,
} from "@/widgets/shared/widget-layout";

type Theme = "light" | "dark";

type Props = {
  city: WidgetCityRow | null;
  theme?: Theme;
  /** Actual widget width in dp */
  width: number;
  /** Actual widget height in dp */
  height: number;
};

/**
 * Single-city digital clock. Adapts to 2×2, 2×3, 4×2, etc.
 * Long-press → Configure to pick which saved place to show.
 */
export function ChronaNowWidget({
  city,
  theme = "light",
  width,
  height,
}: Props): JSX.Element {
  const isDark = theme === "dark";
  const colors = widgetTheme(isDark);
  const layout = computeNowClockLayout(width, height);

  if (!city) {
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
            fontSize: 14,
            fontFamily: "Manrope_500Medium",
            textAlign: "center",
          }}
          text="Add a city in Chrona"
        />
      </FlexWidget>
    );
  }

  if (layout.horizontal) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: colors.bg,
          borderRadius: 24,
          padding: layout.padding,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <FlexWidget style={{ flexDirection: "column", flex: 1 }}>
          <TextWidget
            style={{
              color: colors.muted,
              fontSize: layout.brandFontSize,
              fontFamily: "Manrope_500Medium",
            }}
            text="CHRONA"
          />
          <TextWidget
            style={{
              color: colors.title,
              fontSize: layout.cityFontSize,
              fontFamily: "Manrope_600SemiBold",
              marginTop: 2,
            }}
            text={city.label}
            maxLines={1}
            truncate="END"
          />
          <FlexWidget
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 6,
            }}
          >
            <FlexWidget
              style={{
                height: 8,
                width: 8,
                borderRadius: 4,
                backgroundColor: city.isDaytime
                  ? colors.dayDot
                  : colors.nightDot,
                marginRight: 6,
              }}
            />
            <TextWidget
              style={{
                color: colors.muted,
                fontSize: layout.metaFontSize,
                fontFamily: "Manrope_500Medium",
              }}
              text={`${city.abbreviation} · ${city.dateLabel}`}
              maxLines={1}
              truncate="END"
            />
          </FlexWidget>
        </FlexWidget>
        <TextWidget
          style={{
            color: colors.accent,
            fontSize: layout.timeFontSize,
            fontFamily: "Manrope_700Bold",
            marginLeft: 12,
          }}
          text={city.timeLabelShort}
        />
      </FlexWidget>
    );
  }

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
        justifyContent: "space-between",
      }}
    >
      <FlexWidget style={{ flexDirection: "column" }}>
        <TextWidget
          style={{
            color: colors.muted,
            fontSize: layout.brandFontSize,
            fontFamily: "Manrope_500Medium",
          }}
          text="CHRONA"
        />
        <TextWidget
          style={{
            color: colors.title,
            fontSize: layout.cityFontSize,
            fontFamily: "Manrope_600SemiBold",
            marginTop: 2,
          }}
          text={city.label}
          maxLines={1}
          truncate="END"
        />
      </FlexWidget>

      <TextWidget
        style={{
          color: colors.accent,
          fontSize: layout.timeFontSize,
          fontFamily: "Manrope_700Bold",
        }}
        text={city.timeLabelShort}
      />

      <FlexWidget
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <FlexWidget
          style={{
            height: 8,
            width: 8,
            borderRadius: 4,
            backgroundColor: city.isDaytime
              ? colors.dayDot
              : colors.nightDot,
            marginRight: 6,
          }}
        />
        <TextWidget
          style={{
            color: colors.muted,
            fontSize: layout.metaFontSize,
            fontFamily: "Manrope_500Medium",
          }}
          text={`${city.abbreviation} · ${city.dateLabel}`}
          maxLines={1}
          truncate="END"
        />
      </FlexWidget>
    </FlexWidget>
  );
}

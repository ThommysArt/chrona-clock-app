import { HStack, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  cornerRadius,
  font,
  foregroundStyle,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type CityLine = {
  label: string;
  time: string;
  meta: string;
};

export type ChronaCitiesWidgetProps = {
  cities: CityLine[];
};

/**
 * iOS home-screen widget — multi-city world clock list.
 * Family drives how many rows we show (WidgetKit has fixed sizes, not free resize).
 */
const ChronaCitiesLayout = (
  props: ChronaCitiesWidgetProps,
  environment: WidgetEnvironment
) => {
  "widget";
  const isDark = environment.colorScheme === "dark";
  const bg = isDark ? "#1C1B1F" : "#FFFBFE";
  const title = isDark ? "#E6E1E5" : "#1C1B1F";
  const muted = isDark ? "#CAC4D0" : "#49454F";
  const accent = "#E11D48";
  const rowBg = isDark ? "#2B2930" : "#F3EDF7";

  const family = environment.widgetFamily;
  const max =
    family === "systemLarge"
      ? 6
      : family === "systemMedium"
        ? 4
        : 2;
  const compact = family === "systemSmall";
  const cities = (props.cities ?? []).slice(0, max);

  return (
    <VStack
      modifiers={[
        background(bg),
        cornerRadius(20),
        padding({ all: compact ? 10 : 14 }),
      ]}
    >
      {!compact ? (
        <HStack>
          <Text
            modifiers={[
              font({ size: 15, weight: "semibold" }),
              foregroundStyle(title),
            ]}
          >
            World Clock
          </Text>
          <Text
            modifiers={[
              font({ size: 11, weight: "semibold" }),
              foregroundStyle(accent),
            ]}
          >
            CHRONA
          </Text>
        </HStack>
      ) : null}

      {cities.length === 0 ? (
        <Text
          modifiers={[
            font({ size: 13, weight: "medium" }),
            foregroundStyle(muted),
          ]}
        >
          Add cities in Chrona
        </Text>
      ) : (
        cities.map((city) => (
          <HStack
            key={`${city.label}-${city.time}`}
            modifiers={[
              background(rowBg),
              cornerRadius(12),
              padding({ horizontal: compact ? 8 : 12, vertical: compact ? 6 : 8 }),
            ]}
          >
            <VStack>
              <Text
                modifiers={[
                  font({ size: compact ? 12 : 14, weight: "semibold" }),
                  foregroundStyle(title),
                ]}
              >
                {city.label}
              </Text>
              {!compact ? (
                <Text
                  modifiers={[
                    font({ size: 11, weight: "medium" }),
                    foregroundStyle(muted),
                  ]}
                >
                  {city.meta}
                </Text>
              ) : null}
            </VStack>
            <Text
              modifiers={[
                font({ size: compact ? 16 : 20, weight: "bold" }),
                foregroundStyle(accent),
              ]}
            >
              {city.time}
            </Text>
          </HStack>
        ))
      )}
    </VStack>
  );
};

const ChronaCitiesWidget = createWidget("ChronaCities", ChronaCitiesLayout);
export default ChronaCitiesWidget;

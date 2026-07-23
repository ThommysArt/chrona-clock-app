import { HStack, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  cornerRadius,
  font,
  foregroundStyle,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type ChronaNowWidgetProps = {
  cityLabel: string;
  timeLabel: string;
  meta: string;
  isDaytime: boolean;
};

/**
 * iOS home-screen widget — single city digital clock (Material-soft Chrona look).
 */
const ChronaNowLayout = (
  props: ChronaNowWidgetProps,
  environment: WidgetEnvironment
) => {
  "widget";
  const isDark = environment.colorScheme === "dark";
  const bg = isDark ? "#1C1B1F" : "#FFFBFE";
  const title = isDark ? "#E6E1E5" : "#1C1B1F";
  const muted = isDark ? "#CAC4D0" : "#49454F";
  const accent = "#E11D48";

  const label = props.cityLabel || "Chrona";
  const time = props.timeLabel || "--:--";
  const meta = props.meta || "Add cities in app";

  if (environment.widgetFamily === "systemSmall") {
    return (
      <VStack
        modifiers={[
          background(bg),
          cornerRadius(20),
          padding({ all: 14 }),
        ]}
      >
        <Text
          modifiers={[
            font({ size: 11, weight: "medium" }),
            foregroundStyle(muted),
          ]}
        >
          CHRONA
        </Text>
        <Text
          modifiers={[
            font({ size: 15, weight: "semibold" }),
            foregroundStyle(title),
          ]}
        >
          {label}
        </Text>
        <Text
          modifiers={[
            font({ size: 32, weight: "bold" }),
            foregroundStyle(accent),
          ]}
        >
          {time}
        </Text>
        <Text
          modifiers={[
            font({ size: 11, weight: "medium" }),
            foregroundStyle(muted),
          ]}
        >
          {meta}
        </Text>
      </VStack>
    );
  }

  return (
    <HStack
      modifiers={[
        background(bg),
        cornerRadius(20),
        padding({ all: 16 }),
      ]}
    >
      <VStack>
        <Text
          modifiers={[
            font({ size: 12, weight: "medium" }),
            foregroundStyle(muted),
          ]}
        >
          CHRONA
        </Text>
        <Text
          modifiers={[
            font({ size: 18, weight: "semibold" }),
            foregroundStyle(title),
          ]}
        >
          {label}
        </Text>
        <Text
          modifiers={[
            font({ size: 12, weight: "medium" }),
            foregroundStyle(muted),
          ]}
        >
          {meta}
        </Text>
      </VStack>
      <Text
        modifiers={[
          font({ size: 40, weight: "bold" }),
          foregroundStyle(accent),
        ]}
      >
        {time}
      </Text>
    </HStack>
  );
};

const ChronaNowWidget = createWidget("ChronaNow", ChronaNowLayout);
export default ChronaNowWidget;

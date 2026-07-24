import { HStack, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  cornerRadius,
  font,
  foregroundStyle,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type ChronaClockWidgetProps = {
  cityLabel: string;
  timeLabel: string;
  hourProgress: number;
  minuteProgress: number;
  isDaytime: boolean;
};

/**
 * iOS home-screen clock widget — digital readout styled like the analog face
 * branding (full multi-hand SVG is Android-only via SvgWidget).
 */
const ChronaClockLayout = (
  props: ChronaClockWidgetProps,
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
        CLOCK
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
          font({ size: 36, weight: "bold" }),
          foregroundStyle(accent),
        ]}
      >
        {time}
      </Text>
      <HStack>
        <Text
          modifiers={[
            font({ size: 11, weight: "medium" }),
            foregroundStyle(muted),
          ]}
        >
          {props.isDaytime ? "Day" : "Night"} · Chrona
        </Text>
      </HStack>
    </VStack>
  );
};

const ChronaClockWidget = createWidget("ChronaClock", ChronaClockLayout);
export default ChronaClockWidget;

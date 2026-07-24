import type { JSX } from "react";
import {
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";

import { MultiHandClock } from "@/components/clocks/multi-hand-clock";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  TabScreenShell,
  useCitySearch,
  useFloatingChromeInsets,
} from "@/components/ui/tab-screen-shell";
import { fonts } from "@/lib/fonts";
import { useCitiesStore } from "@/store/cities-store";

export default function ClockTab(): JSX.Element {
  const { searchOpen, openSearch, onSearchOpenChange } = useCitySearch();
  const cities = useCitiesStore((s) => s.cities);
  const { width, height } = useWindowDimensions();
  const chrome = useFloatingChromeInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Fit face + soft chips inside available space under floating chrome
  const availableH = Math.max(
    220,
    height - chrome.top - chrome.bottom * 0.55
  );
  const size = Math.min(width - 16, availableH, 400);

  return (
    <TabScreenShell
      floatingHeader={<ScreenHeader onAdd={openSearch} title="Clock" />}
      onSearchOpenChange={onSearchOpenChange}
      searchOpen={searchOpen}
    >
      <View
        style={[
          styles.center,
          {
            paddingBottom: chrome.bottom * 0.3,
            paddingTop: chrome.top * 0.35,
          },
        ]}
      >
        {cities.length === 0 ? (
          <View style={styles.empty}>
            <Text
              style={[
                styles.emptyTitle,
                { color: isDark ? "#E6E1E5" : "#1C1B1F" },
              ]}
            >
              No cities yet
            </Text>
            <Text
              style={[
                styles.emptyBody,
                {
                  color: isDark
                    ? "rgba(230,225,229,0.55)"
                    : "rgba(28,27,31,0.5)",
                },
              ]}
            >
              Tap + to add cities. Each city becomes a soft hand on the dial.
            </Text>
          </View>
        ) : (
          <>
            <MultiHandClock cities={cities} size={size} />
            <Text
              style={[
                styles.caption,
                {
                  color: isDark
                    ? "rgba(230,225,229,0.45)"
                    : "rgba(28,27,31,0.4)",
                },
              ]}
            >
              Accent hand follows your device time zone
            </Text>
          </>
        )}
      </View>
    </TabScreenShell>
  );
}

const styles = StyleSheet.create({
  caption: {
    fontFamily: fonts.medium,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.1,
    marginTop: 10,
    textAlign: "center",
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    overflow: "visible",
    paddingHorizontal: 8,
  },
  empty: {
    alignItems: "center",
    maxWidth: 280,
    paddingHorizontal: 24,
  },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },
  emptyTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    fontWeight: "600",
  },
});

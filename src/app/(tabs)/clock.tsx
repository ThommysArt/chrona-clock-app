import type { JSX } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { MultiHandClock } from "@/components/clocks/multi-hand-clock";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  TabScreenShell,
  useCitySearch,
  useFloatingChromeInsets,
} from "@/components/ui/tab-screen-shell";
import { useCitiesStore } from "@/store/cities-store";

export default function ClockTab(): JSX.Element {
  const { searchOpen, openSearch, onSearchOpenChange } = useCitySearch();
  const cities = useCitiesStore((s) => s.cities);
  const { width } = useWindowDimensions();
  const chrome = useFloatingChromeInsets();
  // Full component (face + labels) must fit screen width with side margins
  const size = Math.min(width - 8, 380);

  return (
    <TabScreenShell
      floatingHeader={
        <ScreenHeader onAdd={openSearch} title="Clock" />
      }
      onSearchOpenChange={onSearchOpenChange}
      searchOpen={searchOpen}
    >
      <View
        style={[
          styles.center,
          { paddingBottom: chrome.bottom * 0.35, paddingTop: chrome.top * 0.4 },
        ]}
      >
        <MultiHandClock cities={cities} size={size} />
      </View>
    </TabScreenShell>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    overflow: "visible",
    paddingHorizontal: 4,
  },
});

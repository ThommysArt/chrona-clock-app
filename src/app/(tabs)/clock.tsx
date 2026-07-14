import type { JSX } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { MultiHandClock } from "@/components/clocks/multi-hand-clock";
import { ScreenHeader } from "@/components/ui/screen-header";
import { TabScreenShell, useCitySearch } from "@/components/ui/tab-screen-shell";
import { useCitiesStore } from "@/store/cities-store";

export default function ClockTab(): JSX.Element {
  const { searchOpen, openSearch, onSearchOpenChange } = useCitySearch();
  const cities = useCitiesStore((s) => s.cities);
  const { width } = useWindowDimensions();
  // Full component (face + labels) must fit screen width with side margins
  const size = Math.min(width - 24, 340);

  return (
    <TabScreenShell
      onSearchOpenChange={onSearchOpenChange}
      searchOpen={searchOpen}
    >
      <ScreenHeader onAdd={openSearch} title="Clock" />
      <View style={styles.center}>
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
    paddingBottom: 40,
    paddingHorizontal: 4,
  },
});

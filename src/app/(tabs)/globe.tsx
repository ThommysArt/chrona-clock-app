import type { JSX } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";

import { EarthGlobe } from "@/components/globe/earth-globe";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  TabScreenShell,
  useCitySearch,
} from "@/components/ui/tab-screen-shell";
import { PAGE_BG } from "@/lib/constants";
import { useCitiesStore } from "@/store/cities-store";

/**
 * Full-bleed globe: earth paints the whole screen; header / time travel /
 * tab bar float above with progressive fades.
 */
export default function GlobeTab(): JSX.Element {
  const { searchOpen, openSearch, onSearchOpenChange } = useCitySearch();
  const cities = useCitiesStore((s) => s.cities);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const bg = isDark ? PAGE_BG.dark : PAGE_BG.light;

  return (
    <View style={[styles.page, { backgroundColor: bg }]}>
      <TabScreenShell
        floatingHeader={
          <ScreenHeader onAdd={openSearch} title="World Clock" />
        }
        immersive
        onSearchOpenChange={onSearchOpenChange}
        searchOpen={searchOpen}
      >
        <EarthGlobe cities={cities} />
      </TabScreenShell>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
});

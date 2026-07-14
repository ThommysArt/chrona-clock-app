import type { JSX } from "react";
import { ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";

import { CityListItem } from "@/components/clocks/city-list-item";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  TabScreenShell,
  useCitySearch,
  useFloatingChromeInsets,
} from "@/components/ui/tab-screen-shell";
import { useCitiesStore } from "@/store/cities-store";

export default function ListTab(): JSX.Element {
  const { searchOpen, openSearch, onSearchOpenChange } = useCitySearch();
  const cities = useCitiesStore((s) => s.cities);
  const removeCity = useCitiesStore((s) => s.removeCity);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const chrome = useFloatingChromeInsets();

  return (
    <TabScreenShell
      floatingHeader={
        <ScreenHeader onAdd={openSearch} title="Time Zones" />
      }
      onSearchOpenChange={onSearchOpenChange}
      searchOpen={searchOpen}
    >
      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: chrome.bottom, paddingTop: chrome.top },
        ]}
        // Content scrolls under the progressive header / bottom fades
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {cities.length === 0 ? (
          <View style={styles.empty}>
            <Text
              style={[styles.emptyTitle, { color: isDark ? "#FFF" : "#111" }]}
            >
              No cities yet
            </Text>
            <Text
              style={[
                styles.emptyBody,
                {
                  color: isDark
                    ? "rgba(255,255,255,0.5)"
                    : "rgba(0,0,0,0.45)",
                },
              ]}
            >
              Tap + to add cities and compare times across the world.
            </Text>
          </View>
        ) : (
          cities.map((city, index) => (
            <CityListItem
              city={city}
              isFirst={index === 0}
              isLast={index === cities.length - 1}
              key={city.id}
              onRemove={() => {
                void removeCity(city.id);
              }}
            />
          ))
        )}
      </ScrollView>
    </TabScreenShell>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: 32,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 16,
  },
  scroll: {
    flex: 1,
  },
});

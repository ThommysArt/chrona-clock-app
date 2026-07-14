import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/manrope";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ACCENT, DEFAULT_CITIES } from "@/lib/constants";
import { bootstrapDatabase } from "@/lib/db";
import { hydrateCitiesStore } from "@/store/cities-store";
import { hydrateSettingsStore } from "@/store/settings-store";
import { hydrateTimeStore, startTimeEngine } from "@/store/time-store";

import "../global.css";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout(): JSX.Element | null {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const snapshot = await bootstrapDatabase();
        if (cancelled) return;
        await Promise.all([
          hydrateCitiesStore({
            cities: snapshot.cities,
            customPlaces: snapshot.customPlaces,
          }),
          hydrateSettingsStore(snapshot.settings),
          hydrateTimeStore(snapshot.offsetMs),
        ]);
      } catch (e) {
        console.warn("[chrona] database bootstrap failed", e);
        // In-memory defaults so the UI still launches
        await hydrateCitiesStore({
          cities: DEFAULT_CITIES.map((c) => ({ ...c })),
          customPlaces: [],
        }).catch(() => undefined);
        await hydrateSettingsStore({
          use24Hour: true,
          theme: "system",
        }).catch(() => undefined);
        await hydrateTimeStore(0).catch(() => undefined);
      }
      if (!cancelled) setDbReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    return startTimeEngine();
  }, [dbReady]);

  useEffect(() => {
    if (fontsLoaded && dbReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbReady]);

  if (!fontsLoaded || !dbReady) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: ACCENT,
          flex: 1,
          justifyContent: "center",
        }}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}

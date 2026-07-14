import { Tabs } from "expo-router";
import type { JSX } from "react";

import { FloatingTabBar } from "@/components/nav/floating-tab-bar";

export default function TabsLayout(): JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          position: "absolute",
        },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "List" }} />
      <Tabs.Screen name="globe" options={{ title: "Globe" }} />
      <Tabs.Screen name="clock" options={{ title: "Clock" }} />
    </Tabs>
  );
}

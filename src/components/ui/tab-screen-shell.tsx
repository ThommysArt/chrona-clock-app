import type { JSX, ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CitySearchSheet } from "@/components/city/city-search-sheet";
import { ProgressiveBlurEdge } from "@/components/nav/progressive-blur-edge";
import { TimeTravelBar } from "@/components/time-travel/time-travel-bar";
import { PAGE_BG } from "@/lib/constants";

type Props = {
  children: ReactNode;
  dark?: boolean;
  contentBottomPad?: number;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  /**
   * Full-bleed immersive mode: transparent shell so content (e.g. globe)
   * paints edge-to-edge under floating chrome.
   */
  immersive?: boolean;
  /** Optional floating header slot (sits under top progressive fade) */
  floatingHeader?: ReactNode;
};

/** Shared chrome: page bg + time travel floating above tab bar + city sheet */
export function TabScreenShell({
  children,
  dark,
  contentBottomPad = 200,
  searchOpen,
  onSearchOpenChange,
  immersive = false,
  floatingHeader,
}: Props): JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = dark ?? colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const bg = isDark ? PAGE_BG.dark : PAGE_BG.light;
  const topFade = Math.max(insets.top + 96, 128);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: immersive ? "transparent" : bg },
      ]}
    >
      <View
        style={[
          styles.content,
          immersive
            ? styles.contentImmersive
            : { paddingBottom: contentBottomPad },
        ]}
      >
        {children}
      </View>

      {immersive && floatingHeader ? (
        <ProgressiveBlurEdge
          backgroundColor={bg}
          edge="top"
          fadeHeight={topFade}
        >
          {floatingHeader}
        </ProgressiveBlurEdge>
      ) : null}

      <View
        style={[
          styles.timeTravelDock,
          {
            bottom: Math.max(insets.bottom, 10) + 8 + 66 + 12,
          },
        ]}
        pointerEvents="box-none"
      >
        <TimeTravelBar dark={isDark} />
      </View>

      <CitySearchSheet
        onClose={() => onSearchOpenChange(false)}
        visible={searchOpen}
      />
    </View>
  );
}

/** Convenience hook for tabs that own search state */
export function useCitySearch() {
  const [searchOpen, setSearchOpen] = useState(false);
  return {
    searchOpen,
    openSearch: () => setSearchOpen(true),
    closeSearch: () => setSearchOpen(false),
    onSearchOpenChange: setSearchOpen,
  };
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentImmersive: {
    ...StyleSheet.absoluteFill,
  },
  root: {
    flex: 1,
  },
  timeTravelDock: {
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 15,
  },
});

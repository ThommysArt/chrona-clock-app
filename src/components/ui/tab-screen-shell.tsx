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
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  /**
   * Full-bleed immersive mode: transparent shell so content (e.g. globe)
   * paints edge-to-edge under floating chrome.
   */
  immersive?: boolean;
  /** Floating header slot under the top progressive fade */
  floatingHeader?: ReactNode;
};

/**
 * Shared chrome: content paints full-bleed; header / time-travel / tab bar
 * float above with progressive top + bottom fades (same idea as the globe).
 */
export function TabScreenShell({
  children,
  dark,
  searchOpen,
  onSearchOpenChange,
  immersive = false,
  floatingHeader,
}: Props): JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = dark ?? colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const bg = isDark ? PAGE_BG.dark : PAGE_BG.light;
  const topFade = Math.max(insets.top + 100, 132);
  // Tall enough to soften content under time-travel + tab bar
  const bottomFade = Math.max(insets.bottom + 200, 220);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: immersive ? "transparent" : bg },
      ]}
    >
      {/* Content fills the screen so list/clock can scroll under chrome */}
      <View
        style={[styles.content, immersive && styles.contentImmersive]}
      >
        {children}
      </View>

      {floatingHeader ? (
        <ProgressiveBlurEdge
          backgroundColor={bg}
          edge="top"
          fadeHeight={topFade}
        >
          {floatingHeader}
        </ProgressiveBlurEdge>
      ) : null}

      {/* Bottom fade behind time-travel (tab bar has its own edge fade too) */}
      <ProgressiveBlurEdge
        backgroundColor={bg}
        edge="bottom"
        fadeHeight={bottomFade}
        style={styles.bottomFade}
      >
        <View
          pointerEvents="box-none"
          style={[
            styles.timeTravelDock,
            {
              // Clear the floating tab pill + home indicator
              paddingBottom: Math.max(insets.bottom, 10) + 8 + 66 + 10,
            },
          ]}
        >
          <TimeTravelBar dark={isDark} />
        </View>
      </ProgressiveBlurEdge>

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

/** Scroll/content padding so first/last items clear floating chrome at rest */
export function useFloatingChromeInsets() {
  const insets = useSafeAreaInsets();
  return {
    top: Math.max(insets.top + 56, 88) + 8,
    bottom: Math.max(insets.bottom, 10) + 8 + 66 + 12 + 88,
  };
}

const styles = StyleSheet.create({
  bottomFade: {
    // Sit under the tab bar edge (zIndex 20) so tab pill stays on top
    zIndex: 15,
  },
  content: {
    ...StyleSheet.absoluteFill,
  },
  contentImmersive: {
    // Already absolute fill — keep explicit for clarity
  },
  root: {
    flex: 1,
  },
  timeTravelDock: {
    width: "100%",
  },
});

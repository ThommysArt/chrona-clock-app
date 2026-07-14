import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/lib/fonts";

type Props = {
  title: string;
  onAdd?: () => void;
  dark?: boolean;
  right?: JSX.Element;
};

export function ScreenHeader({ title, onAdd, dark, right }: Props): JSX.Element {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = dark ?? colorScheme === "dark";
  const text = isDark ? "#FFFFFF" : "#111111";
  const iconBg = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <Text style={[styles.title, { color: text }]}>{title}</Text>
      <View style={styles.actions}>
        {right}
        {onAdd && (
          <Pressable
            accessibilityLabel="Add city"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onAdd}
            style={[styles.addBtn, { backgroundColor: iconBg }]}
          >
            <Ionicons color={text} name="add" size={22} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  addBtn: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  title: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  wrap: {
    alignItems: "center",
    flexDirection: "row",
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
});

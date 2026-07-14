import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ACCENT } from "@/lib/constants";
import { searchCities, type SearchableCity } from "@/lib/cities";
import { useCitiesStore } from "@/store/cities-store";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function CitySearchSheet({ visible, onClose }: Props): JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const addCity = useCitiesStore((s) => s.addCity);
  const hasCity = useCitiesStore((s) => s.hasCity);
  const cities = useCitiesStore((s) => s.cities);

  const results = useMemo(() => searchCities(query, 50), [query]);

  const onSelect = (city: SearchableCity) => {
    if (
      hasCity(city.id) ||
      cities.some((c) => c.timezone === city.timezone && c.label === city.label)
    ) {
      onClose();
      return;
    }
    addCity({
      id: city.id,
      label: city.label,
      region: city.region,
      timezone: city.timezone,
      latitude: city.latitude,
      longitude: city.longitude,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setQuery("");
    onClose();
  };

  const bg = isDark ? "#1C1C1E" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#111111";
  const muted = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";
  const fieldBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: bg,
              paddingBottom: Math.max(insets.bottom, 16),
              paddingTop: 12,
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: text }]}>Add City</Text>
            <Pressable
              accessibilityLabel="Close"
              hitSlop={8}
              onPress={() => {
                setQuery("");
                onClose();
              }}
            >
              <Ionicons color={muted} name="close" size={24} />
            </Pressable>
          </View>

          <View style={[styles.searchField, { backgroundColor: fieldBg }]}>
            <Ionicons color={muted} name="search" size={18} />
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              onChangeText={setQuery}
              placeholder="Search cities or time zones"
              placeholderTextColor={muted}
              style={[styles.input, { color: text }]}
              value={query}
            />
            {query.length > 0 && (
              <Pressable hitSlop={8} onPress={() => setQuery("")}>
                <Ionicons color={muted} name="close-circle" size={18} />
              </Pressable>
            )}
          </View>

          <FlatList
            contentContainerStyle={styles.list}
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const saved =
                hasCity(item.id) ||
                cities.some(
                  (c) => c.timezone === item.timezone && c.label === item.label
                );
              return (
                <Pressable
                  disabled={saved}
                  onPress={() => onSelect(item)}
                  style={[
                    styles.row,
                    {
                      borderBottomColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.06)",
                      opacity: saved ? 0.45 : 1,
                    },
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.city, { color: text }]}>{item.label}</Text>
                    <Text style={[styles.region, { color: muted }]}>
                      {item.region} · {item.timezone}
                    </Text>
                  </View>
                  {saved ? (
                    <Ionicons color={ACCENT} name="checkmark-circle" size={22} />
                  ) : (
                    <Ionicons color={ACCENT} name="add-circle-outline" size={22} />
                  )}
                </Pressable>
              );
            }}
            style={styles.listFlex}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
    justifyContent: "flex-end",
  },
  city: {
    fontSize: 17,
    fontWeight: "600",
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "rgba(128,128,128,0.35)",
    borderRadius: 2,
    height: 4,
    marginBottom: 10,
    width: 36,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  list: {
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  listFlex: {
    flex: 1,
  },
  region: {
    fontSize: 13,
    marginTop: 2,
  },
  row: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  searchField: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "78%",
    maxHeight: 720,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
});

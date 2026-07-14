import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ACCENT } from "@/lib/constants";
import {
  resolvePlaceCoords,
  searchCities,
  searchTimezones,
  type SearchableCity,
  type TimezoneOption,
} from "@/lib/cities";
import { useCitiesStore } from "@/store/cities-store";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Mode = "search" | "create" | "pick-timezone";

type CreateForm = {
  label: string;
  region: string;
  timezone: string;
};

const emptyForm: CreateForm = {
  label: "",
  region: "",
  timezone: "",
};

export function CitySearchSheet({ visible, onClose }: Props): JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("search");
  const [tzQuery, setTzQuery] = useState("");
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addCity = useCitiesStore((s) => s.addCity);
  const createCustomPlace = useCitiesStore((s) => s.createCustomPlace);
  const hasCity = useCitiesStore((s) => s.hasCity);
  const cities = useCitiesStore((s) => s.cities);
  const customPlaces = useCitiesStore((s) => s.customPlaces);

  const results = useMemo(
    () => searchCities(query, 50, customPlaces),
    [query, customPlaces]
  );
  const timezoneResults = useMemo(
    () => searchTimezones(tzQuery, 50),
    [tzQuery]
  );

  const previewCoords = useMemo(() => {
    if (!form.timezone.trim()) return null;
    return resolvePlaceCoords({
      label: form.label || query,
      region: form.region,
      timezone: form.timezone,
    });
  }, [form.label, form.region, form.timezone, query]);

  const resetSheet = () => {
    setQuery("");
    setMode("search");
    setTzQuery("");
    setForm(emptyForm);
    setFormError(null);
    setSaving(false);
  };

  const bg = isDark ? "#1C1C1E" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#111111";
  const muted = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";
  const fieldBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  const isSaved = (city: SearchableCity) =>
    hasCity(city.id) ||
    cities.some(
      (c) => c.timezone === city.timezone && c.label === city.label
    );

  const onSelect = (city: SearchableCity) => {
    if (isSaved(city)) {
      onClose();
      return;
    }
    void addCity({
      id: city.id,
      label: city.label,
      region: city.region,
      timezone: city.timezone,
      latitude: city.latitude,
      longitude: city.longitude,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetSheet();
    onClose();
  };

  const openCreate = (prefillLabel = query.trim()) => {
    setForm({
      ...emptyForm,
      label: prefillLabel,
    });
    setFormError(null);
    setMode("create");
  };

  const applyTimezone = (tz: TimezoneOption) => {
    setForm((prev) => ({
      ...prev,
      timezone: tz.name,
      region: prev.region.trim()
        ? prev.region
        : tz.countryName || prev.region,
    }));
    setTzQuery("");
    setMode("create");
  };

  const submitCreate = async () => {
    const label = form.label.trim();
    const timezone = form.timezone.trim();
    if (!label) {
      setFormError("Enter a place name.");
      return;
    }
    if (!timezone) {
      setFormError("Choose a time zone.");
      return;
    }

    setSaving(true);
    setFormError(null);
    const created = await createCustomPlace({
      label,
      region: form.region.trim(),
      timezone,
    });
    setSaving(false);

    if (!created) {
      setFormError("That place is already in your list.");
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetSheet();
    onClose();
  };

  const closeSheet = () => {
    resetSheet();
    onClose();
  };

  const title =
    mode === "search"
      ? "Add City"
      : mode === "create"
        ? "New Place"
        : "Time Zone";

  return (
    <Modal
      animationType="slide"
      onRequestClose={closeSheet}
      presentationStyle="pageSheet"
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable onPress={closeSheet} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            {mode !== "search" ? (
              <Pressable
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={() => {
                  if (mode === "pick-timezone") {
                    setMode("create");
                    setTzQuery("");
                  } else {
                    setMode("search");
                    setFormError(null);
                  }
                }}
                style={styles.headerSide}
              >
                <Ionicons color={text} name="chevron-back" size={24} />
              </Pressable>
            ) : (
              <View style={styles.headerSide} />
            )}
            <Text style={[styles.title, { color: text }]}>{title}</Text>
            <Pressable
              accessibilityLabel="Close"
              hitSlop={8}
              onPress={closeSheet}
              style={[styles.headerSide, styles.headerSideEnd]}
            >
              <Ionicons color={muted} name="close" size={24} />
            </Pressable>
          </View>

          {mode === "search" && (
            <>
              <View style={[styles.searchField, { backgroundColor: fieldBg }]}>
                <Ionicons color={muted} name="search" size={18} />
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoFocus
                  onChangeText={setQuery}
                  placeholder="Search cities (e.g. Munich, New York)"
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
                ListFooterComponent={
                  <Pressable
                    onPress={() => openCreate(query.trim())}
                    style={[
                      styles.createCta,
                      {
                        backgroundColor: isDark
                          ? "rgba(225, 29, 72, 0.14)"
                          : "rgba(225, 29, 72, 0.08)",
                        borderColor: ACCENT,
                      },
                    ]}
                  >
                    <Ionicons color={ACCENT} name="add-circle" size={22} />
                    <View style={styles.createCtaText}>
                      <Text style={[styles.createCtaTitle, { color: ACCENT }]}>
                        {query.trim()
                          ? `Create “${query.trim()}”`
                          : "Create a new place"}
                      </Text>
                      <Text style={[styles.createCtaBody, { color: muted }]}>
                        Not in the catalog? Add a name, region, and time zone —
                        map location is filled in automatically.
                      </Text>
                    </View>
                  </Pressable>
                }
                contentContainerStyle={styles.list}
                data={results}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const saved = isSaved(item);
                  return (
                    <Pressable
                      disabled={saved}
                      onPress={() => onSelect(item)}
                      style={[
                        styles.row,
                        {
                          borderBottomColor: border,
                          opacity: saved ? 0.45 : 1,
                        },
                      ]}
                    >
                      <View style={styles.rowText}>
                        <View style={styles.rowTitleRow}>
                          <Text style={[styles.city, { color: text }]}>
                            {item.label}
                          </Text>
                          {item.custom ? (
                            <View
                              style={[
                                styles.badge,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(225, 29, 72, 0.2)"
                                    : "rgba(225, 29, 72, 0.12)",
                                },
                              ]}
                            >
                              <Text
                                style={[styles.badgeText, { color: ACCENT }]}
                              >
                                Custom
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.region, { color: muted }]}>
                          {item.region} · {item.timezone}
                        </Text>
                      </View>
                      {saved ? (
                        <Ionicons
                          color={ACCENT}
                          name="checkmark-circle"
                          size={22}
                        />
                      ) : (
                        <Ionicons
                          color={ACCENT}
                          name="add-circle-outline"
                          size={22}
                        />
                      )}
                    </Pressable>
                  );
                }}
                style={styles.listFlex}
              />
            </>
          )}

          {mode === "create" && (
            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.help, { color: muted }]}>
                Example: New Britain, Connecticut — pick America/New_York. We
                place the pin using the geo database (or the zone’s main city).
              </Text>

              <FieldLabel color={muted} label="Place name" />
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={(label) => {
                  setForm((f) => ({ ...f, label }));
                  setFormError(null);
                }}
                placeholder="New Britain"
                placeholderTextColor={muted}
                style={[
                  styles.formInput,
                  { backgroundColor: fieldBg, color: text },
                ]}
                value={form.label}
              />

              <FieldLabel color={muted} label="Region / state" />
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={(region) => setForm((f) => ({ ...f, region }))}
                placeholder="CT, United States"
                placeholderTextColor={muted}
                style={[
                  styles.formInput,
                  { backgroundColor: fieldBg, color: text },
                ]}
                value={form.region}
              />

              <FieldLabel color={muted} label="Time zone" />
              <Pressable
                onPress={() => {
                  setTzQuery(form.timezone);
                  setMode("pick-timezone");
                }}
                style={[
                  styles.formInput,
                  styles.formSelect,
                  { backgroundColor: fieldBg },
                ]}
              >
                <Text
                  style={{
                    color: form.timezone ? text : muted,
                    flex: 1,
                    fontSize: 16,
                  }}
                >
                  {form.timezone || "Choose IANA time zone"}
                </Text>
                <Ionicons color={muted} name="chevron-forward" size={18} />
              </Pressable>

              {previewCoords ? (
                <View
                  style={[
                    styles.preview,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                    },
                  ]}
                >
                  <Ionicons color={ACCENT} name="location" size={18} />
                  <View style={styles.previewText}>
                    <Text style={[styles.previewTitle, { color: text }]}>
                      Map pin
                      {previewCoords.matchedLabel
                        ? ` · near ${previewCoords.matchedLabel}`
                        : ""}
                    </Text>
                    <Text style={[styles.previewBody, { color: muted }]}>
                      {previewCoords.latitude.toFixed(4)},{" "}
                      {previewCoords.longitude.toFixed(4)}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.hint, { color: muted }]}>
                  Choose a time zone to preview where this place will appear on
                  the globe.
                </Text>
              )}

              {formError ? (
                <Text style={styles.error}>{formError}</Text>
              ) : null}

              <Pressable
                disabled={saving}
                onPress={() => void submitCreate()}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: ACCENT, opacity: saving ? 0.6 : 1 },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? "Saving…" : "Save place"}
                </Text>
              </Pressable>
            </ScrollView>
          )}

          {mode === "pick-timezone" && (
            <>
              <View style={[styles.searchField, { backgroundColor: fieldBg }]}>
                <Ionicons color={muted} name="search" size={18} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  onChangeText={setTzQuery}
                  placeholder="Search America/New_York, United States…"
                  placeholderTextColor={muted}
                  style={[styles.input, { color: text }]}
                  value={tzQuery}
                />
              </View>
              <FlatList
                contentContainerStyle={styles.list}
                data={timezoneResults}
                keyExtractor={(item) => item.name}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => applyTimezone(item)}
                    style={[styles.row, { borderBottomColor: border }]}
                  >
                    <View style={styles.rowText}>
                      <Text style={[styles.city, { color: text }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.region, { color: muted }]}>
                        {item.countryName}
                        {item.abbreviation ? ` · ${item.abbreviation}` : ""}
                        {item.mainCities[0] ? ` · ${item.mainCities[0]}` : ""}
                      </Text>
                    </View>
                    {form.timezone === item.name ? (
                      <Ionicons
                        color={ACCENT}
                        name="checkmark-circle"
                        size={22}
                      />
                    ) : (
                      <Ionicons
                        color={muted}
                        name="chevron-forward"
                        size={18}
                      />
                    )}
                  </Pressable>
                )}
                style={styles.listFlex}
              />
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function FieldLabel({
  label,
  color,
}: {
  label: string;
  color: string;
}): JSX.Element {
  return <Text style={[styles.fieldLabel, { color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
    justifyContent: "flex-end",
  },
  badge: {
    borderRadius: 6,
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  city: {
    fontSize: 17,
    fontWeight: "600",
  },
  createCta: {
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    padding: 14,
  },
  createCtaBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  createCtaText: {
    flex: 1,
  },
  createCtaTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginBottom: 6,
    marginTop: 14,
  },
  form: {
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  formInput: {
    borderRadius: 12,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  formSelect: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
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
    paddingHorizontal: 8,
  },
  headerSide: {
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: 40,
    paddingHorizontal: 8,
  },
  headerSideEnd: {
    alignItems: "flex-end",
  },
  help: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
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
  preview: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    padding: 12,
  },
  previewBody: {
    fontSize: 13,
    marginTop: 2,
  },
  previewText: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  primaryBtn: {
    alignItems: "center",
    borderRadius: 14,
    marginTop: 20,
    paddingVertical: 15,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
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
  rowTitleRow: {
    alignItems: "center",
    flexDirection: "row",
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
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
  },
});

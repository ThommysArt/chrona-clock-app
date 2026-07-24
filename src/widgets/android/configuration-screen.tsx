import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import type { WidgetConfigurationScreenProps } from "react-native-android-widget";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ACCENT } from "@/lib/constants";
import { ChronaClockWidget } from "@/widgets/android/chrona-clock-widget";
import { ChronaNowWidget } from "@/widgets/android/chrona-now-widget";
import {
  loadWidgetPayload,
  type WidgetCityRow,
  type WidgetPayload,
} from "@/widgets/shared/widget-data";
import { getWidgetCityId, setWidgetCityId } from "@/widgets/shared/widget-prefs";

/**
 * Android widget configuration UI.
 *
 * Triggered when adding a reconfigurable widget, or later via long-press →
 * Configure. Lets the user pick which saved place Chrona Time / Chrona Clock
 * should display.
 *
 * Registered as its own AppRegistry root — wrap SafeAreaProvider here.
 */
export function WidgetConfigurationScreen(
  props: WidgetConfigurationScreenProps
): JSX.Element {
  return (
    <SafeAreaProvider>
      <WidgetConfigurationScreenInner {...props} />
    </SafeAreaProvider>
  );
}

function WidgetConfigurationScreenInner({
  widgetInfo,
  setResult,
  renderWidget,
}: WidgetConfigurationScreenProps): JSX.Element {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();

  const [payload, setPayload] = useState<WidgetPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const widgetName = widgetInfo.widgetName;
  const canConfigure =
    widgetName === "ChronaNow" || widgetName === "ChronaClock";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await loadWidgetPayload();
        if (cancelled) return;
        setPayload(p);
        const stored = await getWidgetCityId(widgetName, widgetInfo.widgetId);
        const initial =
          stored && p.cities.some((c) => c.id === stored)
            ? stored
            : (p.primary?.id ?? p.cities[0]?.id ?? null);
        setSelectedId(initial);
      } catch (e) {
        console.warn("[chrona] widget config load failed", e);
        if (!cancelled) setError("Could not load cities");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [widgetName, widgetInfo.widgetId]);

  const selectedCity: WidgetCityRow | null =
    payload?.cities.find((c) => c.id === selectedId) ??
    payload?.primary ??
    null;

  const applyAndClose = useCallback(async () => {
    if (!payload || !selectedCity || !canConfigure) {
      setResult("cancel");
      return;
    }
    setSaving(true);
    try {
      await setWidgetCityId(widgetName, widgetInfo.widgetId, selectedCity.id);
      const w = widgetInfo.width || 110;
      const h = widgetInfo.height || 110;

      if (widgetName === "ChronaNow") {
        renderWidget({
          light: (
            <ChronaNowWidget
              city={selectedCity}
              theme="light"
              width={w}
              height={h}
            />
          ),
          dark: (
            <ChronaNowWidget
              city={selectedCity}
              theme="dark"
              width={w}
              height={h}
            />
          ),
        });
      } else {
        renderWidget({
          light: (
            <ChronaClockWidget
              city={selectedCity}
              cities={payload.cities}
              theme="light"
              width={w}
              height={h}
            />
          ),
          dark: (
            <ChronaClockWidget
              city={selectedCity}
              cities={payload.cities}
              theme="dark"
              width={w}
              height={h}
            />
          ),
        });
      }
      setResult("ok");
    } catch (e) {
      console.warn("[chrona] widget config save failed", e);
      setError("Could not save");
      setSaving(false);
    }
  }, [
    canConfigure,
    payload,
    renderWidget,
    selectedCity,
    setResult,
    widgetInfo.height,
    widgetInfo.widgetId,
    widgetInfo.width,
    widgetName,
  ]);

  const bg = isDark ? "#0c0c0e" : "#f2f2f7";
  const card = isDark ? "#1C1B1F" : "#FFFFFF";
  const title = isDark ? "#E6E1E5" : "#1C1B1F";
  const muted = isDark ? "#CAC4D0" : "#49454F";
  const border = isDark ? "#2B2930" : "#E7E0EC";

  const heading =
    widgetName === "ChronaClock"
      ? "Choose clock city"
      : widgetName === "ChronaNow"
        ? "Choose place"
        : "Widget settings";

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: bg,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 12,
        },
      ]}
    >
      <Text style={[styles.heading, { color: title }]}>{heading}</Text>
      <Text style={[styles.sub, { color: muted }]}>
        {canConfigure
          ? "Pick a saved city for this widget. You can change it later by long-pressing the widget and choosing Configure."
          : "This widget has no settings."}
      </Text>

      {error ? (
        <Text style={[styles.error, { color: ACCENT }]}>{error}</Text>
      ) : null}

      {!payload ? (
        <View style={styles.loading}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={payload.cities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const selected = item.id === selectedId;
            return (
              <Pressable
                onPress={() => setSelectedId(item.id)}
                style={[
                  styles.row,
                  {
                    backgroundColor: card,
                    borderColor: selected ? ACCENT : border,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.city, { color: title }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.meta, { color: muted }]}>
                    {item.timeLabelShort} · {item.abbreviation}
                    {item.isDevice ? " · Device" : ""}
                  </Text>
                </View>
                {selected ? (
                  <Ionicons
                    color={ACCENT}
                    name="checkmark-circle"
                    size={24}
                  />
                ) : (
                  <Ionicons
                    color={muted}
                    name="ellipse-outline"
                    size={24}
                  />
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={[styles.sub, { color: muted }]}>
              No cities saved. Open Chrona and add places first.
            </Text>
          }
        />
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => setResult("cancel")}
          style={[styles.btn, styles.btnGhost, { borderColor: border }]}
        >
          <Text style={[styles.btnText, { color: title }]}>Cancel</Text>
        </Pressable>
        <Pressable
          disabled={saving || !selectedCity || !canConfigure}
          onPress={() => void applyAndClose()}
          style={[
            styles.btn,
            styles.btnPrimary,
            {
              backgroundColor: ACCENT,
              opacity: saving || !selectedCity || !canConfigure ? 0.5 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.btnText, { color: "#fff" }]}>Done</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  error: {
    fontSize: 13,
    marginBottom: 8,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  city: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 8,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: {
    borderWidth: 1,
  },
  btnPrimary: {},
  btnText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

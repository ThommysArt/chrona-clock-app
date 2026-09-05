import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View, useColorScheme } from "react-native";

import { ACCENT, type CityDefinition } from "@/lib/constants";
import { fonts } from "@/lib/fonts";
import {
  MAPBOX_STANDARD_STYLE,
  cityMapLabel,
  getMapboxToken,
  initialMapCenter,
  initialMapZoom,
} from "@/lib/mapbox";
import { useSettingsStore } from "@/store/settings-store";
import { useTimeStore } from "@/store/time-store";

import type * as RNMapbox from "@rnmapbox/maps";
// eslint-disable-next-line import/namespace
import type * as MapboxGL from "mapbox-gl";

type GlobeProps = {
  cities: CityDefinition[];
};

let cachedNativeMaps: typeof RNMapbox | null = null;

/** Never called on web — the native SDK is only required on iOS/Android. */
function getNativeMaps(): typeof RNMapbox {
  if (!cachedNativeMaps) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedNativeMaps = require("@rnmapbox/maps") as typeof RNMapbox;
  }
  return cachedNativeMaps;
}

let cachedMapboxGL: typeof MapboxGL | null = null;
let mapboxCssLoaded = false;

/** Never called on native — mapbox-gl touches `document` at import time. */
function getMapboxGL(): typeof MapboxGL {
  if (!mapboxCssLoaded) {
    mapboxCssLoaded = true;
    // Styles the canvas, logo, and attribution controls.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("mapbox-gl/dist/mapbox-gl.css");
  }
  if (!cachedMapboxGL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedMapboxGL = require("mapbox-gl") as typeof MapboxGL;
  }
  return cachedMapboxGL;
}

/** City id → chip text. Minute bucket rolls labels over while watching. */
function useCityLabels(
  cities: CityDefinition[],
  offsetMs: number,
  use24Hour: boolean,
  minuteBucket: number
): Map<string, string> {
  return useMemo(() => {
    // Referenced so the memo busts each minute while watching live time.
    void minuteBucket;
    const next = new Map<string, string>();
    for (const city of cities) {
      next.set(city.id, cityMapLabel(city, offsetMs, use24Hour));
    }
    return next;
  }, [cities, offsetMs, use24Hour, minuteBucket]);
}

function NativeGlobe({ cities }: GlobeProps): JSX.Element {
  const Maps = getNativeMaps();
  const isDark = useColorScheme() === "dark";
  const offsetMs = useTimeStore((s) => s.offsetMs);
  const nowMs = useTimeStore((s) => s.nowMs);
  const use24Hour = useSettingsStore((s) => s.use24Hour);
  const minuteBucket = Math.floor(nowMs / 60_000);

  const labels = useCityLabels(cities, offsetMs, use24Hour, minuteBucket);

  // Camera set once — later city edits must not yank the user's view.
  const [initialCamera] = useState(() => {
    const center = initialMapCenter(cities);
    return {
      centerCoordinate: [center.longitude, center.latitude] as [number, number],
      zoomLevel: initialMapZoom(cities.length),
    };
  });

  useEffect(() => {
    void Maps.setAccessToken(getMapboxToken());
  }, [Maps]);

  const { Camera, MapView, MarkerView, StyleImport } = Maps;
  const chipBg = isDark ? "rgba(20,20,22,0.9)" : "rgba(255,255,255,0.94)";
  const timeColor = isDark ? "#fff" : "#111";
  const sepColor = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)";

  return (
    <View style={styles.fill}>
      <MapView
        compassEnabled={false}
        projection="globe"
        scaleBarEnabled={false}
        style={styles.fill}
        styleURL={MAPBOX_STANDARD_STYLE}
      >
        <StyleImport config={{ lightPreset: isDark ? "night" : "day" }} existing id="basemap" />
        <Camera defaultSettings={initialCamera} />
        {cities.map((city) => (
          <MarkerView
            allowOverlap
            anchor={{ x: 0.5, y: 1 }}
            coordinate={[city.longitude, city.latitude]}
            key={city.id}
          >
            <View pointerEvents="none" style={nativeStyles.pin}>
              <View style={[nativeStyles.chip, { backgroundColor: chipBg }]}>
                <Text numberOfLines={1} style={[nativeStyles.name, { color: ACCENT }]}>
                  {city.label}
                </Text>
                <Text style={[nativeStyles.sep, { color: sepColor }]}>{" · "}</Text>
                <Text numberOfLines={1} style={[nativeStyles.time, { color: timeColor }]}>
                  {labels.get(city.id) ?? ""}
                </Text>
              </View>
              <View style={[nativeStyles.dot, { backgroundColor: ACCENT }]} />
            </View>
          </MarkerView>
        ))}
      </MapView>
    </View>
  );
}

/** v3 exposes the token on the default export; plain CJS shims put it on top. */
function setWebAccessToken(mapboxgl: typeof MapboxGL, token: string): void {
  const candidate = mapboxgl as unknown as {
    default?: { accessToken?: string };
    accessToken?: string;
  };
  const target = candidate.default ?? candidate;
  target.accessToken = token;
}

function applyWebAtmosphere(map: MapboxGL.Map, isDark: boolean): void {
  try {
    map.setFog({
      color: "rgb(186, 210, 235)",
      "high-color": "rgb(36, 92, 223)",
      "horizon-blend": 0.02,
      "space-color": isDark ? "rgb(11, 11, 25)" : "rgb(168, 196, 232)",
      "star-intensity": isDark ? 0.6 : 0,
    });
  } catch {
    // Cached/legacy styles without fog support still render the map.
  }
}

function applyWebLightPreset(map: MapboxGL.Map, isDark: boolean): void {
  try {
    map.setConfigProperty("basemap", "lightPreset", isDark ? "night" : "day");
  } catch {
    // Non-Standard styles have no basemap config — ignore.
  }
}

function paintWebPin(el: HTMLElement, label: string, time: string, isDark: boolean): void {
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.alignItems = "center";
  el.style.pointerEvents = "none";

  let chip = el.querySelector<HTMLElement>(":scope > [data-role='chip']");
  let name = el.querySelector<HTMLElement>(":scope [data-role='name']");
  let timeEl = el.querySelector<HTMLElement>(":scope [data-role='time']");
  let dot = el.querySelector<HTMLElement>(":scope > [data-role='dot']");

  if (!chip || !name || !timeEl || !dot) {
    el.innerHTML = "";
    chip = document.createElement("div");
    chip.dataset.role = "chip";
    chip.style.display = "flex";
    chip.style.flexDirection = "row";
    chip.style.alignItems = "center";
    chip.style.borderRadius = "9px";
    chip.style.padding = "4px 8px";
    chip.style.fontFamily = `${fonts.semiBold}, Manrope, system-ui, sans-serif`;
    chip.style.fontSize = "11px";
    chip.style.lineHeight = "1.2";
    chip.style.whiteSpace = "nowrap";
    chip.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";

    name = document.createElement("span");
    name.dataset.role = "name";
    name.style.fontFamily = "inherit";
    name.style.color = ACCENT;

    const sep = document.createElement("span");
    sep.textContent = " · ";
    sep.style.margin = "0 4px";

    timeEl = document.createElement("span");
    timeEl.dataset.role = "time";
    timeEl.style.fontFamily = `${fonts.medium}, Manrope, system-ui, sans-serif`;
    timeEl.style.fontVariantNumeric = "tabular-nums";

    chip.append(name, sep, timeEl);

    dot = document.createElement("div");
    dot.dataset.role = "dot";
    dot.style.width = "12px";
    dot.style.height = "12px";
    dot.style.borderRadius = "50%";
    dot.style.marginTop = "4px";
    dot.style.border = "2px solid #fff";
    dot.style.background = ACCENT;
    dot.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";

    el.append(chip, dot);
  }

  name.textContent = label;
  timeEl.textContent = time;
  chip.style.background = isDark ? "rgba(20,20,22,0.9)" : "rgba(255,255,255,0.94)";
  timeEl.style.color = isDark ? "#fff" : "#111";
}

function WebGlobe({ cities }: GlobeProps): JSX.Element {
  const isDark = useColorScheme() === "dark";
  const offsetMs = useTimeStore((s) => s.offsetMs);
  const nowMs = useTimeStore((s) => s.nowMs);
  const use24Hour = useSettingsStore((s) => s.use24Hour);
  const minuteBucket = Math.floor(nowMs / 60_000);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxGL.Map | null>(null);
  const markersRef = useRef(new Map<string, MapboxGL.Marker>());

  const initialRef = useRef<{
    cities: CityDefinition[];
    isDark: boolean;
  } | null>(null);
  if (initialRef.current === null) {
    initialRef.current = { cities, isDark };
  }

  const labels = useCityLabels(cities, offsetMs, use24Hour, minuteBucket);

  useEffect(() => {
    const container = containerRef.current;
    const initial = initialRef.current;
    if (!container || !initial || mapRef.current) return;

    const mapboxgl = getMapboxGL();
    setWebAccessToken(mapboxgl, getMapboxToken());
    const center = initialMapCenter(initial.cities);
    const map = new mapboxgl.Map({
      center: [center.longitude, center.latitude],
      container,
      projection: "globe",
      style: MAPBOX_STANDARD_STYLE,
      zoom: initialMapZoom(initial.cities.length),
    });
    map.on("style.load", () => {
      applyWebAtmosphere(map, initial.isDark);
      applyWebLightPreset(map, initial.isDark);
    });
    mapRef.current = map;
    const markers = markersRef.current;
    return () => {
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      applyWebAtmosphere(map, isDark);
      applyWebLightPreset(map, isDark);
    };
    if (map.isStyleLoaded()) {
      apply();
      return;
    }
    map.once("load", apply);
    return () => {
      map.off("load", apply);
    };
  }, [isDark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const city of cities) {
      seen.add(city.id);
      let marker = markersRef.current.get(city.id);
      if (!marker) {
        const mapboxgl = getMapboxGL();
        const el = document.createElement("div");
        marker = new mapboxgl.Marker({ anchor: "bottom", element: el })
          .setLngLat([city.longitude, city.latitude])
          .addTo(map);
        markersRef.current.set(city.id, marker);
      } else {
        marker.setLngLat([city.longitude, city.latitude]);
      }
      paintWebPin(marker.getElement(), city.label, labels.get(city.id) ?? "", isDark);
    }
    for (const [id, marker] of Array.from(markersRef.current.entries())) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [cities, labels, isDark]);

  return (
    <View
      ref={(node) => {
        containerRef.current = node as unknown as HTMLDivElement | null;
      }}
      style={styles.fill}
    />
  );
}

/**
 * Mapbox globe — native (@rnmapbox/maps) and web (mapbox-gl) share this API.
 * Standard style with globe projection; pins show live city times.
 */
export function MapboxGlobe({ cities }: GlobeProps): JSX.Element {
  if (Platform.OS === "web") {
    return <WebGlobe cities={cities} />;
  }
  return <NativeGlobe cities={cities} />;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});

const nativeStyles = StyleSheet.create({
  chip: {
    alignItems: "center",
    borderRadius: 9,
    elevation: 3,
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  dot: {
    borderColor: "#fff",
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    marginTop: 4,
    width: 12,
  },
  name: {
    flexShrink: 0,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  pin: {
    alignItems: "center",
  },
  sep: {
    fontFamily: fonts.medium,
    fontSize: 11,
    marginHorizontal: 4,
  },
  time: {
    flexShrink: 0,
    fontFamily: fonts.medium,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
});

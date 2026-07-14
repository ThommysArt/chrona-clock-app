import { Html, OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Asset } from "expo-asset";
import type { ComponentType, JSX } from "react";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as THREE from "three";

// Web uses DOM canvas; native needs the expo-gl entry (`/native`)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Canvas } = (
  Platform.OS === "web"
    ? require("@react-three/fiber")
    : require("@react-three/fiber/native")
) as { Canvas: ComponentType<Record<string, unknown>> };

import { ACCENT, type CityDefinition } from "@/lib/constants";
import { fonts } from "@/lib/fonts";
import {
  getZonedParts,
  latLonToVector3,
  sunDirectionFromTimestamp,
} from "@/lib/time";
import { useSettingsStore } from "@/store/settings-store";
import { useTimeStore } from "@/store/time-store";

// NASA Blue Marble / three-globe assets (bundled)
const EARTH_DAY = require("../../../assets/earth/earth-day.jpg");
const EARTH_NIGHT = require("../../../assets/earth/earth-night.jpg");
const EARTH_TOPO = require("../../../assets/earth/earth-topology.png");

type EarthMaps = {
  day: THREE.Texture;
  night: THREE.Texture;
  topo: THREE.Texture;
};

function applyTextureDefaults(tex: THREE.Texture, isColor = true): THREE.Texture {
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = 8;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function solidTexture(r: number, g: number, b: number): THREE.Texture {
  const data = new Uint8Array([r, g, b, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  return applyTextureDefaults(tex);
}

/**
 * THREE.TextureLoader / ImageLoader touch `document` (DOM Image) — broken on RN.
 * Web: standard TextureLoader.
 * Native: expo-asset + the same DataTexture path expo-three uses (no `document`).
 */
async function loadTexture(moduleId: number): Promise<THREE.Texture> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error("Failed to resolve earth texture asset");

  if (Platform.OS === "web") {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        uri,
        (tex) => resolve(applyTextureDefaults(tex)),
        undefined,
        reject
      );
    });
  }

  // Native path — never touch document / DOM Image
  let width = asset.width;
  let height = asset.height;
  if (!width || !height) {
    const size = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
      }
    );
    width = size.width;
    height = size.height;
  }

  const texture = new THREE.Texture();
  // Forces expo-gl to pass the native asset through gl.texImage2D verbatim
  // (same trick as expo-three's TextureLoader on native)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (texture as any).isDataTexture = true;
  texture.image = {
    data: asset,
    width,
    height,
  };
  texture.flipY = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return applyTextureDefaults(texture);
}

function useEarthMaps(): { maps: EarthMaps | null; error: string | null } {
  const [maps, setMaps] = useState<EarthMaps | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [day, night, topo] = await Promise.all([
          loadTexture(EARTH_DAY),
          loadTexture(EARTH_NIGHT),
          loadTexture(EARTH_TOPO),
        ]);
        if (!cancelled) {
          setMaps({ day, night, topo });
          setError(null);
        }
      } catch {
        // Expected on some Expo Go / hermes builds if asset decode fails.
        // Solid colors keep the globe interactive either way.
        if (!cancelled) {
          setError("fallback");
          setMaps({
            day: solidTexture(40, 100, 180),
            night: solidTexture(8, 16, 40),
            topo: solidTexture(80, 80, 80),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { maps, error };
}

type Props = {
  cities: CityDefinition[];
};

function EarthWithPins({
  cities,
  offsetMs,
  use24Hour,
  maps,
}: {
  cities: CityDefinition[];
  offsetMs: number;
  use24Hour: boolean;
  maps: EarthMaps;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.012;
    }
  });

  const textureYaw = Math.PI;
  const useHtmlLabels = Platform.OS === "web";

  return (
    <group ref={groupRef} rotation={[0, textureYaw, 0]}>
      <mesh>
        <sphereGeometry args={[1, 72, 72]} />
        <meshStandardMaterial
          bumpMap={maps.topo}
          bumpScale={0.02}
          emissive={new THREE.Color("#243a58")}
          emissiveIntensity={0.55}
          emissiveMap={maps.night}
          map={maps.day}
          metalness={0.01}
          roughness={0.68}
          roughnessMap={maps.topo}
        />
      </mesh>

      {/* Atmosphere glow */}
      <mesh scale={1.028}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          color="#9fd0ff"
          opacity={0.16}
          side={THREE.BackSide}
          transparent
        />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#c5e4ff"
          depthWrite={false}
          opacity={0.08}
          side={THREE.BackSide}
          transparent
        />
      </mesh>

      {cities.map((city) => {
        const [x, y, z] = latLonToVector3(
          city.latitude,
          city.longitude,
          1.014
        );
        const parts = getZonedParts(city.timezone, offsetMs, use24Hour);
        return (
          <group key={city.id} position={[x, y, z]}>
            {/* Compact pins */}
            <mesh>
              <sphereGeometry args={[0.0075, 12, 12]} />
              <meshBasicMaterial color={ACCENT} />
            </mesh>
            {useHtmlLabels ? (
              <Html
                center
                distanceFactor={5.5}
                occlude={false}
                position={[0, 0.05, 0]}
                style={{ pointerEvents: "none", userSelect: "none" }}
                zIndexRange={[100, 0]}
              >
                <div
                  style={{
                    background: "rgba(20, 20, 22, 0.88)",
                    borderRadius: 9,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                    color: "#fff",
                    fontFamily:
                      "Manrope, system-ui, -apple-system, sans-serif",
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "3px 7px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ color: ACCENT }}>{city.label}</span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      margin: "0 4px",
                    }}
                  >
                    ·
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {parts.timeLabelShort}
                  </span>
                </div>
              </Html>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function SunLight({ offsetMs }: { offsetMs: number }) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const dir = sunDirectionFromTimestamp(offsetMs);

  useFrame(() => {
    const [x, y, z] = sunDirectionFromTimestamp(offsetMs);
    if (lightRef.current) {
      lightRef.current.position.set(x * 10, y * 10 + 2, z * 10);
    }
    if (fillRef.current) {
      fillRef.current.position.set(-x * 6, 4, -z * 6);
    }
    if (rimRef.current) {
      rimRef.current.position.set(-x * 4, 2, z * 8);
    }
  });

  return (
    <>
      {/* Key sun — bright warm daylight */}
      <directionalLight
        color="#fff6e8"
        intensity={4.2}
        position={[dir[0] * 10, dir[1] * 10 + 2, dir[2] * 10]}
        ref={lightRef}
      />
      {/* Cool fill so night side stays readable */}
      <directionalLight
        color="#b4cfff"
        intensity={1.15}
        position={[-dir[0] * 6, 4, -dir[2] * 6]}
        ref={fillRef}
      />
      {/* Soft rim / edge light */}
      <directionalLight
        color="#e8f0ff"
        intensity={0.55}
        position={[-dir[0] * 4, 2, dir[2] * 8]}
        ref={rimRef}
      />
      <ambientLight intensity={0.75} />
      <hemisphereLight
        color="#f0f6ff"
        groundColor="#4a3a28"
        intensity={0.85}
      />
    </>
  );
}

function ClearColor({ color }: { color: string }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.setClearColor(color, 1);
  }, [gl, color]);
  return <color attach="background" args={[color]} />;
}

function Scene({
  cities,
  maps,
  bg,
}: {
  cities: CityDefinition[];
  maps: EarthMaps;
  bg: string;
}) {
  const offsetMs = useTimeStore((s) => s.offsetMs);
  const nowMs = useTimeStore((s) => s.nowMs);
  const use24Hour = useSettingsStore((s) => s.use24Hour);
  void nowMs;

  return (
    <>
      <ClearColor color={bg} />
      <SunLight offsetMs={offsetMs} />
      <EarthWithPins
        cities={cities}
        maps={maps}
        offsetMs={offsetMs}
        use24Hour={use24Hour}
      />
      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        maxDistance={6}
        minDistance={1.8}
        rotateSpeed={0.6}
        zoomSpeed={0.75}
      />
    </>
  );
}

/**
 * Interactive 3D Earth — full-bleed under floating chrome.
 * Textures: web TextureLoader; native expo-asset (no `document`).
 */
export function EarthGlobe({ cities }: Props): JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const bg = isDark ? "#0c0c0e" : "#f2f2f7";
  const { maps, error } = useEarthMaps();
  const { width: winW, height: winH } = useWindowDimensions();
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const width = layout.width > 0 ? layout.width : winW;
  const height =
    layout.height > 0 ? layout.height : Math.max(360, winH);

  if (!maps) {
    return (
      <View style={[styles.wrap, styles.loading, { backgroundColor: bg }]}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text
          style={{
            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
            fontFamily: fonts.medium,
            fontSize: 13,
            marginTop: 12,
          }}
        >
          {error ? "Preparing Earth…" : "Loading Earth…"}
        </Text>
      </View>
    );
  }

  return (
    <View
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w > 0 && h > 0) setLayout({ width: w, height: h });
      }}
      style={[styles.wrap, { backgroundColor: bg }]}
    >
      <Canvas
        // Pull camera back so the globe isn't over-cropped by default
        camera={{ fov: 42, position: [0, 0.2, 3.9] }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }: { gl: THREE.WebGLRenderer }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.55;
        }}
        style={{ width, height }}
      >
        <Suspense fallback={null}>
          <Scene bg={bg} cities={cities} maps={maps} />
        </Suspense>
      </Canvas>

      {/* Native: HTML labels aren't available — compact city chips overlay */}
      {Platform.OS !== "web" ? (
        <NativeCityChips cities={cities} isDark={isDark} />
      ) : null}
    </View>
  );
}

function NativeCityChips({
  cities,
  isDark,
}: {
  cities: CityDefinition[];
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const offsetMs = useTimeStore((s) => s.offsetMs);
  const nowMs = useTimeStore((s) => s.nowMs);
  const use24Hour = useSettingsStore((s) => s.use24Hour);
  void nowMs;

  // Sit just under the floating header / top fade
  const top = insets.top + 56;

  return (
    <View pointerEvents="none" style={[styles.chips, { top }]}>
      {cities.map((c) => {
        const p = getZonedParts(c.timezone, offsetMs, use24Hour);
        return (
          <View
            key={c.id}
            style={[
              styles.chip,
              {
                backgroundColor: isDark
                  ? "rgba(28,28,30,0.88)"
                  : "rgba(255,255,255,0.9)",
              },
            ]}
          >
            <Text
              style={{
                color: ACCENT,
                fontFamily: fonts.semiBold,
                fontSize: 11,
              }}
            >
              {c.label}
            </Text>
            <Text
              style={{
                color: isDark ? "#fff" : "#111",
                fontFamily: fonts.medium,
                fontSize: 11,
                marginLeft: 6,
              }}
            >
              {p.timeLabelShort}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 10,
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    left: 12,
    position: "absolute",
    right: 12,
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
});

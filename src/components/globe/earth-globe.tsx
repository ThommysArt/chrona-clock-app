import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { ComponentType, JSX } from "react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import * as THREE from "three";

import { ACCENT, type CityDefinition } from "@/lib/constants";
import { fonts } from "@/lib/fonts";
import {
  getZonedParts,
  latLonToVector3,
  sunDirectionFromTimestamp,
} from "@/lib/time";
import { useSettingsStore } from "@/store/settings-store";
import { useTimeStore } from "@/store/time-store";

// Web uses DOM canvas; native needs the expo-gl entry (`/native`)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Canvas } = (
  Platform.OS === "web"
    ? require("@react-three/fiber")
    : require("@react-three/fiber/native")
) as { Canvas: ComponentType<Record<string, unknown>> };

// Flat digital base (generated from Natural Earth 110m) + vector overlays
const EARTH_BASE = require("../../../assets/earth/earth-digital-base.png");

// Natural Earth 110m country borders (bundled GeoJSON via Metro JSON require)
type CountryGeometry =
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] }
  | { type: string; coordinates: unknown };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const COUNTRIES = require("../../../assets/earth/countries-110m.json") as {
  features: { geometry: CountryGeometry | null }[];
};

type EarthMaps = {
  day: THREE.Texture;
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

const BORDER_RADIUS = 1.004;
const GRATICULE_RADIUS = 1.0018;

function pushSegment(
  out: number[],
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
  radius: number
): void {
  // Split at the antimeridian so borders don't smear across the map
  if (Math.abs(lonA - lonB) > 180) return;
  const [ax, ay, az] = latLonToVector3(latA, lonA, radius);
  const [bx, by, bz] = latLonToVector3(latB, lonB, radius);
  out.push(ax, ay, az, bx, by, bz);
}

function buildBorderPositions(): Float32Array {
  const out: number[] = [];
  for (const feature of COUNTRIES.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    const polygons =
      geometry.type === "Polygon"
        ? [(geometry.coordinates as [number, number][][])]
        : geometry.type === "MultiPolygon"
          ? (geometry.coordinates as [number, number][][][])
          : [];
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (let i = 0; i + 1 < ring.length; i++) {
          const a = ring[i]!;
          const b = ring[i + 1]!;
          pushSegment(out, a[1]!, a[0]!, b[1]!, b[0]!, BORDER_RADIUS);
        }
      }
    }
  }
  return new Float32Array(out);
}

function buildGraticulePositions(step = 15, sample = 2): Float32Array {
  const out: number[] = [];
  for (let lon = -180; lon < 180; lon += step) {
    for (let lat = -90; lat < 90; lat += sample) {
      pushSegment(
        out,
        lat,
        lon,
        Math.min(lat + sample, 90),
        lon,
        GRATICULE_RADIUS
      );
    }
  }
  for (let lat = -75; lat <= 75; lat += step) {
    for (let lon = -180; lon < 180; lon += sample) {
      pushSegment(out, lat, lon, lat, lon + sample, GRATICULE_RADIUS);
    }
  }
  return new Float32Array(out);
}

let cachedBorderGeometry: THREE.BufferGeometry | null = null;
let cachedGraticuleGeometry: THREE.BufferGeometry | null = null;

function getBorderGeometry(): THREE.BufferGeometry {
  if (!cachedBorderGeometry) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(buildBorderPositions(), 3)
    );
    cachedBorderGeometry = geometry;
  }
  return cachedBorderGeometry;
}

function getGraticuleGeometry(): THREE.BufferGeometry {
  if (!cachedGraticuleGeometry) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(buildGraticulePositions(), 3)
    );
    cachedGraticuleGeometry = geometry;
  }
  return cachedGraticuleGeometry;
}

/**
 * expo-gl's native `loadImage` only accepts `{ localUri: "file://..." }`.
 * Android preview/release APKs often leave asset URIs schemeless (drawable ids),
 * so we copy into the cache directory first when needed.
 */
async function resolveFileLocalUri(asset: Asset): Promise<string> {
  await asset.downloadAsync();
  const source = asset.localUri ?? asset.uri;
  if (!source) throw new Error("Failed to resolve earth texture asset");

  if (source.startsWith("file://")) {
    return source;
  }

  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) throw new Error("FileSystem.cacheDirectory unavailable");

  const ext = asset.type || "jpg";
  const id = asset.hash || asset.name || String(asset);
  const dest = `${cacheRoot}chrona-earth-${id}.${ext}`;
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists) {
    await FileSystem.copyAsync({ from: source, to: dest });
  }
  return dest.startsWith("file://") ? dest : `file://${dest}`;
}

/**
 * THREE.TextureLoader / ImageLoader touch `document` (DOM Image) — broken on RN.
 * Web: standard TextureLoader.
 * Native: file:// URI through DataTexture so expo-gl can decode the pixels.
 */
async function loadTexture(moduleId: number): Promise<THREE.Texture> {
  const asset = Asset.fromModule(moduleId);

  if (Platform.OS === "web") {
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) throw new Error("Failed to resolve earth texture asset");
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        uri,
        (tex) => resolve(applyTextureDefaults(tex)),
        undefined,
        reject
      );
    });
  }

  const localUri = await resolveFileLocalUri(asset);

  let width = asset.width;
  let height = asset.height;
  if (!width || !height) {
    const size = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        Image.getSize(
          localUri,
          (w, h) => resolve({ width: w, height: h }),
          reject
        );
      }
    );
    width = size.width;
    height = size.height;
  }

  const texture = new THREE.Texture();
  // Forces three.js through the DataTexture upload path; expo-gl then decodes
  // via localUri (file://) instead of a DOM Image.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (texture as any).isDataTexture = true;
  texture.image = {
    data: { localUri },
    width,
    height,
  };
  texture.flipY = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  return applyTextureDefaults(texture);
}

function useEarthMaps(): { maps: EarthMaps | null; error: string | null } {
  const [maps, setMaps] = useState<EarthMaps | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [day] = await Promise.all([loadTexture(EARTH_BASE)]);
        if (!cancelled) {
          setMaps({ day });
          setError(null);
        }
      } catch {
        // Expected on some Expo Go / hermes builds if asset decode fails.
        // Solid colors keep the globe interactive either way.
        if (!cancelled) {
          setError("fallback");
          setMaps({
            day: solidTexture(16, 16, 20),
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

/** Screen-space pin label projected from a lat/lon on the spinning globe */
export type ProjectedPin = {
  id: string;
  x: number;
  y: number;
  visible: boolean;
};

const _pinLocal = new THREE.Vector3();
const _pinWorld = new THREE.Vector3();
const _toCamera = new THREE.Vector3();
const _normal = new THREE.Vector3();

function EarthWithPins({
  cities,
  maps,
  onPinsProjected,
}: {
  cities: CityDefinition[];
  maps: EarthMaps;
  onPinsProjected: (pins: ProjectedPin[]) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  const onPinsRef = useRef(onPinsProjected);
  onPinsRef.current = onPinsProjected;
  const lastProjectMs = useRef(0);
  // Cache local positions so we don't recompute lat/lon every frame
  const localPositions = useRef<
    { id: string; pos: THREE.Vector3 }[]
  >([]);

  useEffect(() => {
    localPositions.current = cities.map((city) => {
      const [x, y, z] = latLonToVector3(
        city.latitude,
        city.longitude,
        1.018
      );
      return { id: city.id, pos: new THREE.Vector3(x, y, z) };
    });
  }, [cities]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    group.rotation.y += delta * 0.012;

    // ~8fps label projection — enough for motion, cheap on JS
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastProjectMs.current < 120) return;
    lastProjectMs.current = now;

    group.updateWorldMatrix(true, false);
    const matrix = group.matrixWorld;
    const camPos = camera.position;

    const projected: ProjectedPin[] = localPositions.current.map(
      ({ id, pos }) => {
        _pinWorld.copy(pos).applyMatrix4(matrix);

        // Front-face test: surface normal ≈ position from origin
        _normal.copy(_pinWorld).normalize();
        _toCamera.copy(camPos).sub(_pinWorld).normalize();
        const facing = _normal.dot(_toCamera) > 0.08;

        _pinLocal.copy(_pinWorld).project(camera);
        const sx = (_pinLocal.x * 0.5 + 0.5) * size.width;
        const sy = (-_pinLocal.y * 0.5 + 0.5) * size.height;
        const inFrustum =
          _pinLocal.z > -1 &&
          _pinLocal.z < 1 &&
          sx > -40 &&
          sx < size.width + 40 &&
          sy > -40 &&
          sy < size.height + 40;

        return {
          id,
          x: sx,
          y: sy,
          visible: facing && inFrustum,
        };
      }
    );

    onPinsRef.current(projected);
  });

  // Align equirectangular texture so (0,0) sits at the expected meridian
  const textureYaw = Math.PI;

  // Static vector overlays — built once from bundled 110m borders + graticule
  const borderGeometry = useMemo(() => getBorderGeometry(), []);
  const graticuleGeometry = useMemo(() => getGraticuleGeometry(), []);

  return (
    <group ref={groupRef} rotation={[0, textureYaw, 0]}>
      <mesh>
        <sphereGeometry args={[1, 72, 72]} />
        <meshStandardMaterial
          map={maps.day}
          metalness={0.05}
          roughness={0.92}
        />
      </mesh>

      {/* Country borders — crisp vector strokes above the flat fills */}
      <lineSegments geometry={borderGeometry}>
        <lineBasicMaterial
          color="#a1a1aa"
          depthWrite={false}
          opacity={0.55}
          transparent
        />
      </lineSegments>

      {/* Lat/long graticule — faint digital-scan grid */}
      <lineSegments geometry={graticuleGeometry}>
        <lineBasicMaterial
          color="#71717a"
          depthWrite={false}
          opacity={0.28}
          transparent
        />
      </lineSegments>

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
          1.018
        );
        return (
          <group key={city.id} position={[x, y, z]}>
            {/* Pin head */}
            <mesh>
              <sphereGeometry args={[0.018, 16, 16]} />
              <meshBasicMaterial color={ACCENT} />
            </mesh>
            {/* Soft outer halo for readability */}
            <mesh scale={1.9}>
              <sphereGeometry args={[0.018, 12, 12]} />
              <meshBasicMaterial
                color={ACCENT}
                depthWrite={false}
                opacity={0.28}
                transparent
              />
            </mesh>
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
  onPinsProjected,
}: {
  cities: CityDefinition[];
  maps: EarthMaps;
  bg: string;
  onPinsProjected: (pins: ProjectedPin[]) => void;
}) {
  const offsetMs = useTimeStore((s) => s.offsetMs);
  const nowMs = useTimeStore((s) => s.nowMs);
  void nowMs;

  return (
    <>
      <ClearColor color={bg} />
      <SunLight offsetMs={offsetMs} />
      <EarthWithPins
        cities={cities}
        maps={maps}
        onPinsProjected={onPinsProjected}
      />
      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        maxDistance={6}
        minDistance={1.8}
        // A bit snappier orbit; zoom left alone
        rotateSpeed={1.05}
        zoomSpeed={0.75}
      />
    </>
  );
}

/**
 * Interactive 3D Earth — full-bleed under floating chrome.
 * Textures: web TextureLoader; native expo-asset (no `document`).
 * City labels are projected into screen space so they sit on the pin points.
 */
export function EarthGlobe({ cities }: Props): JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const bg = isDark ? "#0c0c0e" : "#f2f2f7";
  const { maps, error } = useEarthMaps();
  const { width: winW, height: winH } = useWindowDimensions();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [projectedPins, setProjectedPins] = useState<ProjectedPin[]>([]);

  const width = layout.width > 0 ? layout.width : winW;
  const height =
    layout.height > 0 ? layout.height : Math.max(360, winH);

  const handlePinsProjected = useCallback((pins: ProjectedPin[]) => {
    setProjectedPins((prev) => {
      if (prev.length !== pins.length) return pins;
      for (let i = 0; i < pins.length; i++) {
        const a = prev[i]!;
        const b = pins[i]!;
        // Larger threshold → fewer React commits while the globe spins
        if (
          a.id !== b.id ||
          a.visible !== b.visible ||
          Math.abs(a.x - b.x) > 2.5 ||
          Math.abs(a.y - b.y) > 2.5
        ) {
          return pins;
        }
      }
      return prev;
    });
  }, []);

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
          <Scene
            bg={bg}
            cities={cities}
            maps={maps}
            onPinsProjected={handlePinsProjected}
          />
        </Suspense>
      </Canvas>

      <CityPinLabels
        cities={cities}
        isDark={isDark}
        pins={projectedPins}
      />
    </View>
  );
}

/** Fixed box around each pin so the chip can center without width:0 crush */
const PIN_LABEL_BOX = 168;

function CityPinLabels({
  cities,
  isDark,
  pins,
}: {
  cities: CityDefinition[];
  isDark: boolean;
  pins: ProjectedPin[];
}) {
  const offsetMs = useTimeStore((s) => s.offsetMs);
  const nowMs = useTimeStore((s) => s.nowMs);
  const use24Hour = useSettingsStore((s) => s.use24Hour);
  void nowMs;

  // Times only recompute when the clock offset changes — not on every pin move
  const times = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cities) {
      map.set(c.id, getZonedParts(c.timezone, offsetMs, use24Hour).timeLabelShort);
    }
    return map;
  }, [cities, offsetMs, use24Hour]);

  const byId = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins]);

  return (
    <View pointerEvents="none" style={styles.labelsLayer}>
      {cities.map((c) => {
        const pin = byId.get(c.id);
        if (!pin?.visible) return null;
        const timeLabel = times.get(c.id) ?? "";
        return (
          <View
            key={c.id}
            style={[
              styles.pinAnchor,
              {
                left: pin.x - PIN_LABEL_BOX / 2,
                top: pin.y - 30,
                width: PIN_LABEL_BOX,
              },
            ]}
          >
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: isDark
                    ? "rgba(20,20,22,0.9)"
                    : "rgba(255,255,255,0.94)",
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: ACCENT,
                  flexShrink: 0,
                  fontFamily: fonts.semiBold,
                  fontSize: 11,
                }}
              >
                {c.label}
              </Text>
              <Text
                style={{
                  color: isDark
                    ? "rgba(255,255,255,0.55)"
                    : "rgba(0,0,0,0.35)",
                  fontFamily: fonts.medium,
                  fontSize: 11,
                  marginHorizontal: 4,
                }}
              >
                ·
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: isDark ? "#fff" : "#111",
                  flexShrink: 0,
                  fontFamily: fonts.medium,
                  fontSize: 11,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {timeLabel}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 9,
    elevation: 3,
    flexDirection: "row",
    flexWrap: "nowrap",
    maxWidth: PIN_LABEL_BOX,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  labelsLayer: {
    ...StyleSheet.absoluteFill,
    overflow: "visible",
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinAnchor: {
    alignItems: "center",
    justifyContent: "flex-start",
    position: "absolute",
  },
  wrap: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
});

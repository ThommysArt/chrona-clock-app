import type { ConfigContext, ExpoConfig } from "expo/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * App variants (side-by-side installable on the same device):
 *   APP_VARIANT=development → Chrona Dev     · com.thommysart24.chrona.dev
 *   APP_VARIANT=preview     → Chrona Preview · com.thommysart24.chrona.preview
 *   APP_VARIANT=production  → Chrona         · com.thommysart24.chrona  (default)
 *
 * Version is owned by package.json ("version") so APK labels and the store
 * version stay in one place. Bump package.json (e.g. 1.0.0 → 1.0.1) before release.
 */

export type AppVariant = "development" | "preview" | "production";

function readPackageVersion(): string {
  try {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    if (pkg.version && /^\d+\.\d+\.\d+/.test(pkg.version)) return pkg.version;
  } catch {
    // fall through
  }
  return "1.0.0";
}

/** 1.0.0 → 1000000 (major*1_000_000 + minor*1_000 + patch) */
export function versionToCode(version: string): number {
  const [maj = "0", min = "0", pat = "0"] = version.split(".");
  const major = Number.parseInt(maj, 10) || 0;
  const minor = Number.parseInt(min, 10) || 0;
  const patch = Number.parseInt(pat.split("-")[0] ?? "0", 10) || 0;
  return major * 1_000_000 + minor * 1_000 + patch;
}

export function resolveVariant(raw?: string | null): AppVariant {
  const v = (raw ?? process.env.APP_VARIANT ?? "production").toLowerCase().trim();
  if (v === "development" || v === "dev") return "development";
  if (v === "preview" || v === "pre") return "preview";
  return "production";
}

export function variantPackageId(variant: AppVariant): string {
  switch (variant) {
    case "development":
      return "com.thommysart24.chrona.dev";
    case "preview":
      return "com.thommysart24.chrona.preview";
    default:
      return "com.thommysart24.chrona";
  }
}

export function variantAppName(variant: AppVariant): string {
  switch (variant) {
    case "development":
      return "Chrona Dev";
    case "preview":
      return "Chrona Preview";
    default:
      return "Chrona";
  }
}

export function variantScheme(variant: AppVariant): string {
  switch (variant) {
    case "development":
      return "chrona-dev";
    case "preview":
      return "chrona-preview";
    default:
      return "chrona";
  }
}

function variantWidgetSuffix(variant: AppVariant): string {
  switch (variant) {
    case "development":
      return " (Dev)";
    case "preview":
      return " (Preview)";
    default:
      return "";
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = resolveVariant(process.env.APP_VARIANT);
  const version = readPackageVersion();
  const versionCode = versionToCode(version);
  const packageId = variantPackageId(variant);
  const name = variantAppName(variant);
  const scheme = variantScheme(variant);
  const widgetSuffix = variantWidgetSuffix(variant);

  return {
    ...config,
    name,
    slug: "chrona-clock-app",
    owner: "thommysart24",
    version,
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme,
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      bundleIdentifier: packageId,
      infoPlist: {
        CFBundleDisplayName: name,
      },
    },
    android: {
      package: packageId,
      versionCode,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#eeeeee",
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          resizeMode: "contain",
          backgroundColor: "#eeeeee",
        },
      ],
      "expo-status-bar",
      "expo-asset",
      "expo-file-system",
      "expo-sqlite",
      "expo-dev-client",
      // Force work-runtime + work-runtime-ktx onto the same version so
      // react-native-android-widget (2.8.1) and expo-widgets/Glance (ktx 2.7.1)
      // do not produce checkReleaseDuplicateClasses failures.
      "./plugins/withAndroidWorkManagerAlign.js",
      [
        "expo-widgets",
        {
          widgets: [
            {
              name: "ChronaNow",
              displayName: `Chrona Time${widgetSuffix}`,
              description: "Current time for a chosen city",
              contentMarginsDisabled: true,
              supportedFamilies: ["systemSmall", "systemMedium"],
            },
            {
              name: "ChronaCities",
              displayName: `Chrona World Clock${widgetSuffix}`,
              description: "Times for your saved cities",
              contentMarginsDisabled: true,
              supportedFamilies: [
                "systemSmall",
                "systemMedium",
                "systemLarge",
              ],
            },
            {
              name: "ChronaClock",
              displayName: `Chrona Clock${widgetSuffix}`,
              description: "Analog clock for a chosen city",
              contentMarginsDisabled: true,
              supportedFamilies: ["systemSmall", "systemMedium", "systemLarge"],
            },
          ],
        },
      ],
      [
        "react-native-android-widget",
        {
          fonts: [
            "./node_modules/@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf",
            "./node_modules/@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf",
            "./node_modules/@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf",
          ],
          widgets: [
            {
              // Digital single-city. Default 2×2; resizable to 2×3, 4×2, etc.
              // min* use Android formula: 70×cells − 30
              name: "ChronaNow",
              label: `Chrona Time${widgetSuffix}`,
              description: "Digital time for a city you choose",
              minWidth: "110dp",
              minHeight: "110dp",
              targetCellWidth: 2,
              targetCellHeight: 2,
              resizeMode: "horizontal|vertical",
              // Long-press widget → Configure to pick place (optional on add)
              widgetFeatures: "reconfigurable|configuration_optional",
              updatePeriodMillis: 1800000,
            },
            {
              // World list. Default 4×2; free resize 2×2 … 4×6 etc.
              name: "ChronaCities",
              label: `Chrona World Clock${widgetSuffix}`,
              description: "Scrollable times for your saved cities",
              minWidth: "110dp",
              minHeight: "110dp",
              targetCellWidth: 4,
              targetCellHeight: 2,
              resizeMode: "horizontal|vertical",
              updatePeriodMillis: 1800000,
            },
            {
              // Analog face. Default 2×2; multi-hand when enlarged.
              name: "ChronaClock",
              label: `Chrona Clock${widgetSuffix}`,
              description: "Analog multi-hand clock for your cities",
              minWidth: "110dp",
              minHeight: "110dp",
              targetCellWidth: 2,
              targetCellHeight: 2,
              resizeMode: "horizontal|vertical",
              widgetFeatures: "reconfigurable|configuration_optional",
              updatePeriodMillis: 1800000,
            },
          ],
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "4945cf20-7756-46ef-9bd1-8e50d535bbd6",
      },
      appVariant: variant,
      appVersion: version,
      appVersionCode: versionCode,
    },
  };
};

# Chrona

A beautifully designed offline-first world clock app built with Expo.

Three synchronized views share a single timestamp:

1. **List** — saved cities with local times, offsets, and day/night indicators  
2. **Globe** — orthographic Earth with city pins and day/night terminator  
3. **Clock** — soft Material-style multi-hand analog dial for every saved city  

**Time Travel** (±12h) lives above the floating tab bar and updates every screen at once.

## Home screen widgets

Chrona ships with home-screen widgets (not available in Expo Go — use a **development build** or EAS build).

| Widget | Platforms | Size | Shows |
|--------|-----------|------|--------|
| **Chrona Time** (`ChronaNow`) | Android + iOS | Resizable (default 2×2) | Digital time for a **chosen** city |
| **Chrona World Clock** (`ChronaCities`) | Android + iOS | Resizable (default 4×2) | Scrollable list of saved cities |
| **Chrona Clock** (`ChronaClock`) | Android + iOS | Resizable (default 2×2) | Analog face (multi-hand when large) |

### Android sizing & configuration

Widgets use Android’s cell formula (`70 × cells − 30` dp) with `resizeMode: horizontal|vertical`, so you can place **2×2, 2×4, 4×2, 4×4, 4×6, 2×6**, etc. Layout is computed from the **actual** widget width/height on every add/resize/update — equal-height city cards, optional 2-column grid when wide, and a scrollable `ListWidget` when there are more cities than fit.

**Chrona Time** and **Chrona Clock** are reconfigurable: long-press the widget → **Configure** (or set the place when adding) to pick which saved city that instance shows. Preferences are stored per widget id in SQLite.

Widgets refresh when you open the app, change cities/settings, about once a minute while the app is open, and at least every 30 minutes on Android in the background.

> Changing widget definitions in `app.config.ts` requires a native rebuild (`pnpm prebuild:preview` / `pnpm build:preview`, etc.).

## App variants (side-by-side installs)

Dev, preview, and production use different package IDs so they can sit on the same device without uninstalling each other:

| Variant | Launcher name | Android package | Versioned APK |
|---------|---------------|-----------------|---------------|
| `development` | Chrona Dev | `com.thommysart24.chrona.dev` | `dist/chrona-1.0.0-dev.apk` |
| `preview` | Chrona Preview | `com.thommysart24.chrona.preview` | `dist/chrona-1.0.0-preview.apk` |
| `production` | Chrona | `com.thommysart24.chrona` | `dist/chrona-1.0.0-prod.apk` |

Version comes from `package.json` (`version` → `versionName` + `versionCode`). Bump that before a release.

### Local Android builds

Requires Android SDK (`ANDROID_HOME`). Profiles: **dev** (debug + dev client) and **preview** (release APK).

```bash
# Edit version once in package.json → "version": "1.0.0"

pnpm run build:dev && pnpm run install:dev
pnpm run build:preview && pnpm run install:preview
# Both apps stay installed (different package ids)
```

Switching variants re-runs `expo prebuild --clean` so the package id updates. Use `--skip-prebuild` only when you know `android/` already matches the variant:

```bash
APP_VARIANT=preview node scripts/build-apk.mjs release --skip-prebuild
```

### Metro against a variant

```bash
pnpm dev              # Chrona Dev
pnpm dev:preview      # Chrona Preview
```

### EAS cloud (optional)

```bash
pnpm run eas:dev
pnpm run eas:preview
pnpm run eas:prod
```

## Stack

- Expo Router + React Native
- HeroUI Native + Uniwind (Tailwind)
- Zustand + SQLite (offline storage)
- `@js-temporal/polyfill` + `@vvo/tzdb`
- Reanimated + Gesture Handler
- `react-native-android-widget` (Android home widgets)
- `expo-widgets` + `@expo/ui` (iOS home widgets)
- expo-dev-client (custom development builds)
- expo-haptics / expo-blur / expo-linear-gradient

## Get started

```bash
pnpm install
pnpm dev
```

Then open a **development build** (not Expo Go for widgets), Android emulator, or iOS Simulator.  
Widgets require a custom dev client / production build.

## Project layout

```
src/
  app/(tabs)/     # List · Globe · Clock
  components/     # Tab bar, Time Travel, clock, globe, city search
  widgets/        # Android + iOS home-screen widgets
  store/          # time · cities · settings
  lib/            # time engine, storage, city catalog
scripts/          # local APK build + install helpers
app.config.ts     # Expo config + APP_VARIANT side-by-side packages
index.ts          # Expo Router entry + Android widget task handler
```

## Scripts

| Command | Description |
|--------|-------------|
| `pnpm dev` | Metro for Chrona Dev |
| `pnpm dev:preview` | Metro for Chrona Preview |
| `pnpm build:dev` | Prebuild (dev) + debug APK → `dist/chrona-*-dev.apk` |
| `pnpm build:preview` | Prebuild (preview) + release APK → `dist/chrona-*-preview.apk` |
| `pnpm install:dev` | `adb install -r` the versioned dev APK |
| `pnpm install:preview` | `adb install -r` the versioned preview APK |
| `pnpm android` | `expo run:android` (dev variant) |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

## Product spec

See [docs/Chrona_Product_Spec.md](docs/Chrona_Product_Spec.md).

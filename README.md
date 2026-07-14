# Chrona

A beautifully designed offline-first world clock app built with Expo.

Three synchronized views share a single timestamp:

1. **List** — saved cities with local times, offsets, and day/night indicators  
2. **Globe** — orthographic Earth with city pins and day/night terminator  
3. **Clock** — multi-hand analog dial for every saved city  

**Time Travel** (±12h) lives above the iOS-26 style floating tab bar and updates every screen at once.

## Stack

- Expo Router + React Native
- HeroUI Native + Uniwind (Tailwind)
- Zustand + MMKV (web falls back to `localStorage`)
- `@js-temporal/polyfill` + `@vvo/tzdb`
- Reanimated + Gesture Handler
- expo-haptics / expo-blur / expo-linear-gradient

## Get started

```bash
pnpm install
pnpm start
```

Then open iOS Simulator, Android emulator, Expo Go, or press `w` for web.

## Project layout

```
src/
  app/(tabs)/     # List · Globe · Clock
  components/     # Tab bar, Time Travel, clock, globe, city search
  store/          # time · cities · settings
  lib/            # time engine, storage, city catalog
```

## Scripts

| Command | Description |
|--------|-------------|
| `pnpm start` | Expo dev server |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

## Product spec

See [docs/Chrona_Product_Spec.md](docs/Chrona_Product_Spec.md).

# Chrona (Working Name) Product Specification

## Overview

Chrona is a beautifully designed offline-first world clock application built with Expo. Rather than being a simple list of clocks, it helps users visualize time across multiple locations through three synchronized experiences:

1. World Clocks
2. Interactive Globe
3. Time Travel

Every screen is driven by a single shared timestamp, so changing time anywhere updates the entire application.

## Goals

- Instantly understand current time anywhere.
- Visualize global time differences.
- Explore future and past times with a smooth timeline.
- Work completely offline.
- Deliver premium animations and performance.

## Core Principles

- Offline first
- Fast startup
- Beautiful motion
- Minimal UI
- No account required
- Native feel

## Target Users

- Remote workers
- International teams
- Travelers
- Students
- Developers
- Anyone coordinating across time zones

## Tech Stack

- Expo
- Expo Router
- HeroUI Native
- NativeWind
- React Native Reanimated
- React Native Gesture Handler
- Zustand
- react-native-mmkv
- @js-temporal/polyfill
- @vvo/tzdb
- @react-three/fiber
- @react-three/drei
- three
- expo-haptics

## Architecture

One global timestamp drives every feature.

```
Current Timestamp
        |
   +----+----+
   |    |    |
 Clock Globe Time Travel
```

## Navigation

### Tab 1: Clocks

Features:
- Saved cities
- Current local time
- Date
- UTC offset
- Day/Night indicator
- Reorder favorites
- Search and add cities
- Delete cities

### Tab 2: Globe

Features:
- Interactive 3D Earth
- Pin for every saved city
- Atmospheric glow
- Day/night terminator
- Earth rotates according to current timestamp
- Pinch to zoom
- Drag to rotate
- Tap city to inspect

### Tab 3: Time Travel

Features:
- Large horizontal timeline
- Drag hours, days, weeks
- Instant update of all saved cities
- Jump back to "Now"
- Smooth animation

## Shared Time Engine

The slider changes one timestamp only.

Every screen reads from that timestamp.

No duplicated logic.

## Data Model

```ts
Settings {
  use24Hour: boolean
  theme: "light" | "dark" | "system"
}

SavedCity {
  timezone: string
}
```

## Storage

MMKV stores:
- Favorite cities
- Settings
- Last selected timestamp

No backend required.

## Offline Support

Everything works without internet.

Included locally:
- IANA timezone database
- Time calculations
- User settings

## Animations

- Smooth clock transitions
- Globe rotation
- Time slider
- Shared element transitions
- Haptics for timeline ticks

## Future Ideas

- Business hours visualization
- Meeting overlap assistant
- Weather
- Sunrise/sunset
- Cloud sync
- Calendar integration

## Non Goals (v1)

- User accounts
- Backend
- Widgets
- Apple Watch
- Payments

## Success Metrics

- Startup under 2 seconds
- 60 FPS interactions
- Offline functionality
- Minimal battery usage
- Intuitive time travel experience

## Version 1 Checklist

- World clocks
- City search
- Save favorites
- 3D globe
- Day/night visualization
- Time travel slider
- Offline storage
- Dark mode
- 12/24-hour format

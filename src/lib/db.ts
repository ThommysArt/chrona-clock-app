/**
 * Platform entry point for app storage (types + fallback only).
 *
 * Metro resolves `@/lib/db` to `db.native.ts` on iOS/Android (expo-sqlite)
 * and to `db.web.ts` on web (localStorage) — this file is never bundled.
 * It exists so `tsc` (which has no platform awareness) can resolve the
 * module; native behavior always comes from `db.native.ts`.
 */
export * from "./db.native";

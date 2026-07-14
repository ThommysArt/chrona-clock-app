import { create } from "zustand";

import { STORAGE_KEYS, TIME_TRAVEL_RANGE_MS, TICK_MS } from "@/lib/constants";
import { loadJson, saveJson } from "@/lib/storage";
import { appInstant } from "@/lib/time";

type TimeState = {
  /** Offset from real wall-clock time (ms). 0 = now. */
  offsetMs: number;
  /** Epoch ms of "app now" — updates every tick for consumers */
  nowMs: number;
  /** True while the user is dragging Time Travel (UI can stay light) */
  isScrubbing: boolean;
  setOffsetMs: (ms: number) => void;
  resetToNow: () => void;
  /**
   * Live scrub update. Snaps to 1-minute steps and skips no-ops so
   * Temporal/list recompute doesn't thrash every pan pixel.
   */
  scrubOffsetMs: (ms: number) => void;
  beginScrub: () => void;
  endScrub: (finalMs?: number) => void;
  tick: () => void;
};

function clampOffset(ms: number): number {
  return Math.max(-TIME_TRAVEL_RANGE_MS, Math.min(TIME_TRAVEL_RANGE_MS, ms));
}

/** Snap to whole minutes — keeps UI smooth while scrubbing */
function snapMinute(ms: number): number {
  const minute = 60_000;
  return Math.round(ms / minute) * minute;
}

const initialOffset = clampOffset(loadJson(STORAGE_KEYS.offsetMs, 0));

export const useTimeStore = create<TimeState>((set, get) => ({
  offsetMs: initialOffset,
  nowMs: appInstant(initialOffset).epochMilliseconds,
  isScrubbing: false,

  setOffsetMs: (ms) => {
    const offsetMs = clampOffset(ms);
    saveJson(STORAGE_KEYS.offsetMs, offsetMs);
    set({
      offsetMs,
      nowMs: Date.now() + offsetMs,
    });
  },

  scrubOffsetMs: (ms) => {
    const offsetMs = snapMinute(clampOffset(ms));
    const prev = get().offsetMs;
    // Skip identical minute — paired with UI-thread minute gate on the slider
    if (offsetMs === prev) return;
    set({
      offsetMs,
      // Cheap wall-clock math while scrubbing (no Temporal)
      nowMs: Date.now() + offsetMs,
    });
  },

  beginScrub: () => set({ isScrubbing: true }),

  endScrub: (finalMs) => {
    const offsetMs =
      finalMs === undefined
        ? get().offsetMs
        : snapMinute(clampOffset(finalMs));
    saveJson(STORAGE_KEYS.offsetMs, offsetMs);
    set({
      isScrubbing: false,
      offsetMs,
      // Precise Temporal instant once at the end
      nowMs: appInstant(offsetMs).epochMilliseconds,
    });
  },

  resetToNow: () => {
    saveJson(STORAGE_KEYS.offsetMs, 0);
    set({
      offsetMs: 0,
      isScrubbing: false,
      nowMs: appInstant(0).epochMilliseconds,
    });
  },

  tick: () => {
    // Don't fight the scrubber
    if (get().isScrubbing) return;
    const { offsetMs } = get();
    set({ nowMs: appInstant(offsetMs).epochMilliseconds });
  },
}));

/** @deprecated prefer endScrub — kept for call sites */
export function persistOffset(): void {
  const { offsetMs } = useTimeStore.getState();
  saveJson(STORAGE_KEYS.offsetMs, offsetMs);
}

let tickTimer: ReturnType<typeof setInterval> | null = null;

export function startTimeEngine(): () => void {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    useTimeStore.getState().tick();
  }, TICK_MS);
  return () => {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

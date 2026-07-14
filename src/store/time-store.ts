import { create } from "zustand";

import { TIME_TRAVEL_RANGE_MS, TICK_MS } from "@/lib/constants";
import * as db from "@/lib/db";
import { appInstant } from "@/lib/time";

type TimeState = {
  /** Offset from real wall-clock time (ms). 0 = now. */
  offsetMs: number;
  /** Epoch ms of "app now" — updates every tick for consumers */
  nowMs: number;
  /** True while the user is dragging Time Travel (UI can stay light) */
  isScrubbing: boolean;
  ready: boolean;
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

function writeOffsetMs(offsetMs: number): void {
  void db.saveOffsetMs(offsetMs).catch((e) => {
    console.warn("[chrona] failed to persist offsetMs", e);
  });
}

export const useTimeStore = create<TimeState>((set, get) => ({
  offsetMs: 0,
  nowMs: Date.now(),
  isScrubbing: false,
  ready: false,

  setOffsetMs: (ms) => {
    const offsetMs = clampOffset(ms);
    writeOffsetMs(offsetMs);
    set({
      offsetMs,
      nowMs: Date.now() + offsetMs,
    });
  },

  scrubOffsetMs: (ms) => {
    const offsetMs = snapMinute(clampOffset(ms));
    const prev = get().offsetMs;
    // Skip identical minute — paired with UI-thread throttle on the slider
    if (offsetMs === prev) return;
    // Keep store writes minimal while dragging; consumers re-render from this
    set({
      offsetMs,
      nowMs: Date.now() + offsetMs,
      isScrubbing: true,
    });
  },

  beginScrub: () => set({ isScrubbing: true }),

  endScrub: (finalMs) => {
    const offsetMs =
      finalMs === undefined
        ? get().offsetMs
        : snapMinute(clampOffset(finalMs));
    writeOffsetMs(offsetMs);
    set({
      isScrubbing: false,
      offsetMs,
      // Precise Temporal instant once at the end
      nowMs: appInstant(offsetMs).epochMilliseconds,
    });
  },

  resetToNow: () => {
    writeOffsetMs(0);
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
    // Cheap — avoid Temporal on the 1Hz live tick
    set({ nowMs: Date.now() + offsetMs });
  },
}));

/** @deprecated prefer endScrub — kept for call sites */
export function persistOffset(): void {
  writeOffsetMs(useTimeStore.getState().offsetMs);
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

export async function hydrateTimeStore(offsetMs?: number): Promise<void> {
  const raw = offsetMs ?? (await db.loadOffsetMs());
  const clamped = clampOffset(raw);
  useTimeStore.setState({
    offsetMs: clamped,
    nowMs: appInstant(clamped).epochMilliseconds,
    ready: true,
  });
}

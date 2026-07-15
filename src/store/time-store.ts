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
  /**
   * Bumped on every begin/end scrub so in-flight UI work can ignore stale
   * commits from a previous gesture.
   */
  scrubEpoch: number;
  /** Monotonic id for the active scrub gesture — stale JS work must not apply */
  scrubSession: number;
  ready: boolean;
  setOffsetMs: (ms: number) => void;
  resetToNow: () => void;
  /**
   * Live scrub update. Snaps to 1-minute steps and skips no-ops so
   * Temporal/list recompute doesn't thrash every pan pixel.
   * Synchronous — the slider is the authority; deferred writes caused
   * older gestures to overwrite newer ones.
   */
  scrubOffsetMs: (ms: number, session: number) => void;
  beginScrub: (session: number) => void;
  endScrub: (finalMs: number | undefined, session: number) => void;
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
  scrubEpoch: 0,
  scrubSession: 0,
  ready: false,

  setOffsetMs: (ms) => {
    const offsetMs = clampOffset(ms);
    writeOffsetMs(offsetMs);
    set({
      offsetMs,
      nowMs: Date.now() + offsetMs,
    });
  },

  scrubOffsetMs: (ms, session) => {
    const state = get();
    if (session !== state.scrubSession) return;
    if (!state.isScrubbing) return;
    const offsetMs = snapMinute(clampOffset(ms));
    if (offsetMs === state.offsetMs) return;
    set({
      offsetMs,
      nowMs: Date.now() + offsetMs,
    });
  },

  beginScrub: (session) =>
    set((state) => ({
      isScrubbing: true,
      scrubSession: session,
      scrubEpoch: state.scrubEpoch + 1,
    })),

  endScrub: (finalMs, session) => {
    const state = get();
    if (session !== state.scrubSession) return;
    const offsetMs =
      finalMs === undefined
        ? state.offsetMs
        : snapMinute(clampOffset(finalMs));
    writeOffsetMs(offsetMs);
    set((s) => ({
      isScrubbing: false,
      scrubEpoch: s.scrubEpoch + 1,
      offsetMs,
      // Precise Temporal instant once at the end
      nowMs: appInstant(offsetMs).epochMilliseconds,
    }));
  },

  resetToNow: () => {
    writeOffsetMs(0);
    set((state) => ({
      offsetMs: 0,
      isScrubbing: false,
      scrubEpoch: state.scrubEpoch + 1,
      nowMs: appInstant(0).epochMilliseconds,
    }));
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

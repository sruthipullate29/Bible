import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ScheduledCue } from "@openbeam/streams"

interface ScheduleState {
  // The ordered list of verse cues
  cues: ScheduledCue[]

  // Sermon timer
  sermonStartTime: number | null   // Date.now() when sermon started
  elapsedPauseMs: number           // Accumulated ms from previous run segments
  isRunning: boolean

  // Which cue is currently being displayed
  activeCueId: string | null

  // Track which cue IDs have already fired this session (to avoid re-firing)
  firedCueIds: Set<string>

  // UI
  scheduleOpen: boolean

  // ── CRUD ────────────────────────────────────────────────────────────────────
  addCue: (cue: ScheduledCue) => void
  removeCue: (id: string) => void
  updateCue: (id: string, patch: Partial<ScheduledCue>) => void
  reorderCues: (fromIndex: number, toIndex: number) => void
  clearCues: () => void

  // ── Timer controls ───────────────────────────────────────────────────────────
  startSermon: () => void
  pauseSermon: () => void
  resetSermon: () => void

  // ── Cue control ──────────────────────────────────────────────────────────────
  setActiveCue: (id: string | null) => void
  markCueFired: (id: string) => void

  // ── UI ───────────────────────────────────────────────────────────────────────
  setScheduleOpen: (open: boolean) => void
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      cues: [],
      sermonStartTime: null,
      elapsedPauseMs: 0,
      isRunning: false,
      activeCueId: null,
      firedCueIds: new Set(),
      scheduleOpen: false,

      // ── CRUD ──────────────────────────────────────────────────────────────────
      addCue: (cue) =>
        set((s) => ({ cues: [...s.cues, cue] })),

      removeCue: (id) =>
        set((s) => ({
          cues: s.cues.filter((c) => c.id !== id),
          activeCueId: s.activeCueId === id ? null : s.activeCueId,
        })),

      updateCue: (id, patch) =>
        set((s) => ({
          cues: s.cues.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      reorderCues: (fromIndex, toIndex) =>
        set((s) => {
          const cues = [...s.cues]
          const [moved] = cues.splice(fromIndex, 1)
          cues.splice(toIndex, 0, moved)
          return { cues }
        }),

      clearCues: () =>
        set({ cues: [], activeCueId: null }),

      // ── Timer controls ────────────────────────────────────────────────────────
      startSermon: () => {
        const { isRunning, sermonStartTime, elapsedPauseMs } = get()
        if (isRunning) return
        // If resuming after a pause: shift the start time forward by elapsed pause
        const now = Date.now()
        set({
          isRunning: true,
          sermonStartTime: sermonStartTime === null
            ? now
            : now - elapsedPauseMs,
        })
      },

      pauseSermon: () => {
        const { isRunning, sermonStartTime } = get()
        if (!isRunning || sermonStartTime === null) return
        const elapsed = Date.now() - sermonStartTime
        set({ isRunning: false, elapsedPauseMs: elapsed })
      },

      resetSermon: () =>
        set({
          isRunning: false,
          sermonStartTime: null,
          elapsedPauseMs: 0,
          activeCueId: null,
          firedCueIds: new Set(),
        }),

      // ── Cue control ───────────────────────────────────────────────────────────
      setActiveCue: (id) => set({ activeCueId: id }),

      markCueFired: (id) =>
        set((s) => {
          const next = new Set(s.firedCueIds)
          next.add(id)
          return { firedCueIds: next }
        }),

      // ── UI ─────────────────────────────────────────────────────────────────────
      setScheduleOpen: (open) => set({ scheduleOpen: open }),
    }),
    {
      name: "openbeam-schedule",
      // Don't persist ephemeral runtime state
      partialize: (s) => ({
        cues: s.cues,
      }),
    }
  )
)

/** Returns current sermon elapsed time in milliseconds */
export function getSermonElapsedMs(): number {
  const { isRunning, sermonStartTime, elapsedPauseMs } = useScheduleStore.getState()
  if (!isRunning || sermonStartTime === null) return elapsedPauseMs
  return Date.now() - sermonStartTime
}

/** Formats milliseconds as HH:MM:SS */
export function formatElapsed(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/** Parses "MM:SS" or "HH:MM:SS" into total seconds */
export function parseTimeInput(input: string): number | null {
  const parts = input.trim().split(":").map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 2) {
    const [m, s] = parts
    if (s >= 60) return null
    return m * 60 + s
  }
  if (parts.length === 3) {
    const [h, m, s] = parts
    if (m >= 60 || s >= 60) return null
    return h * 3600 + m * 60 + s
  }
  return null
}

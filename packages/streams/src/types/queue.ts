import type { Verse } from "./bible"

export interface QueueItem {
  id: string
  verse: Verse
  reference: string
  confidence: number
  source: "manual" | "ai-direct" | "ai-semantic" | "ai-cloud"
  added_at: number
}

/** A pre-planned verse cue for the Verse Scheduler */
export interface ScheduledCue {
  id: string
  /** Human-readable label, e.g. "Opening text" */
  label: string
  /** Verse reference string, e.g. "John 3:16" */
  reference: string
  /** Bible book number (1–66) */
  bookNumber: number
  chapter: number
  verse: number
  /** Seconds from sermon start when this cue fires (0 = manual only) */
  offsetSeconds: number
  /** How long to display the verse in seconds (0 = until manually cleared) */
  displayDuration: number
  /** Which translation ID to use (falls back to active translation if null) */
  translationId: number | null
  /** Full verse text, cached after first load */
  verseText?: string
}

import { useEffect, useRef } from "react"
import { useScheduleStore, getSermonElapsedMs } from "@/stores/schedule-store"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { api } from "@/services"
import { toVerseRenderData } from "@/hooks/use-broadcast"
import type { ScheduledCue } from "@openbeam/streams"
import type { Verse } from "@/types"

/**
 * Background hook that drives the verse scheduler.
 *
 * - Ticks every 500ms while the sermon is running
 * - Fires a cue when elapsed time >= cue.offsetSeconds (and cue hasn't fired yet)
 * - Fetches verse text from the API if not already cached
 * - Auto-clears the live verse after displayDuration seconds (if > 0)
 * - Mount once at the app root — it produces no UI
 */
export function useScheduleRunner() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const tick = async () => {
      const state = useScheduleStore.getState()
      if (!state.isRunning) return

      const elapsedMs = getSermonElapsedMs()
      const elapsedSecs = elapsedMs / 1000

      // Find the next unfired cue whose offset has passed
      const due = state.cues.find(
        (c) =>
          c.offsetSeconds > 0 &&
          !state.firedCueIds.has(c.id) &&
          elapsedSecs >= c.offsetSeconds
      )

      if (due) {
        await presentCue(due)
      }
    }

    intervalRef.current = setInterval(tick, 500)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return null
}

/**
 * Present a single cue immediately (used both by the auto-scheduler and
 * manual "Present now" button).
 */
export async function presentCue(cue: ScheduledCue) {
  const scheduleState = useScheduleStore.getState()
  const bibleState = useBibleStore.getState()

  // Mark as fired so it doesn't repeat
  scheduleState.markCueFired(cue.id)
  scheduleState.setActiveCue(cue.id)

  // Determine translation
  const translationId = cue.translationId ?? bibleState.activeTranslationId
  const translationAbbr =
    bibleState.translations.find((t) => t.id === translationId)?.abbreviation ?? "NIV"

  // Try to get verse from cache (verseText already on cue) or fetch
  let verse: Verse | null = null
  if (cue.verseText) {
    verse = {
      id: 0,
      translation_id: translationId,
      book_number: cue.bookNumber,
      book_name: cue.reference.split(" ").slice(0, -1).join(" "),
      book_abbreviation: "",
      chapter: cue.chapter,
      verse: cue.verse,
      text: cue.verseText,
    }
  } else {
    try {
      verse = await api.getVerse(translationId, cue.bookNumber, cue.chapter, cue.verse)
      // Cache the text back onto the cue
      if (verse?.text) {
        scheduleState.updateCue(cue.id, { verseText: verse.text })
      }
    } catch {
      // silently ignore API errors
    }
  }

  if (!verse) return

  const renderData = toVerseRenderData(verse, translationAbbr)

  // Push to live display (turns on Live if it was off? — no, respect user's Live toggle)
  useBroadcastStore.getState().setLiveVerse(renderData)

  // Auto-clear after displayDuration if set
  const { displayDuration } = cue
  if (displayDuration > 0) {
    const clearTimer = setTimeout(() => {
      // Only clear if this cue is still the active one
      const current = useScheduleStore.getState().activeCueId
      if (current === cue.id) {
        useBroadcastStore.getState().setLiveVerse(null)
        useScheduleStore.getState().setActiveCue(null)
      }
    }, displayDuration * 1000)

    // Keep track so we can cancel on unmount (stored in module scope via closure)
    return () => clearTimeout(clearTimer)
  }
}

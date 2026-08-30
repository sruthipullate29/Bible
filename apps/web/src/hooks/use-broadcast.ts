import { useBroadcastStore } from "@/stores/broadcast-store"
import type { VerseRenderData } from "@/types"
import type { Verse } from "@/types"

export function toVerseRenderData(
  verse: Verse,
  _translation?: string,
  secondaryVerse?: Verse | null,
  _secondaryTranslation?: string,
): VerseRenderData {
  if (secondaryVerse && secondaryVerse.text) {
    const secRef = secondaryVerse.book_name
      ? `${secondaryVerse.book_name} ${secondaryVerse.chapter}:${secondaryVerse.verse}`
      : ""
    const primRef = `${verse.book_name} ${verse.chapter}:${verse.verse}`
    const reference = secRef && secRef !== primRef ? `${primRef}  •  ${secRef}` : primRef

    return {
      reference,
      segments: [
        {
          verseNumber: verse.verse,
          text: `${verse.text}\n\n${secondaryVerse.text}`,
        },
      ],
    }
  }

  return {
    reference: `${verse.book_name} ${verse.chapter}:${verse.verse}`,
    segments: [{ verseNumber: verse.verse, text: verse.text }],
  }
}

export function deriveLiveVerse({
  isLive,
  selectedVerse,
  translation,
  secondaryVerse,
  secondaryTranslation,
}: {
  isLive: boolean
  selectedVerse: Verse | null
  translation: string
  secondaryVerse?: Verse | null
  secondaryTranslation?: string
}): VerseRenderData | null {
  if (!isLive || !selectedVerse) return null
  return toVerseRenderData(selectedVerse, translation, secondaryVerse, secondaryTranslation)
}

export const broadcastActions = {
  setLiveVerse: (verse: VerseRenderData | null) =>
    useBroadcastStore.getState().setLiveVerse(verse),
  setLive: (live: boolean) =>
    useBroadcastStore.getState().setLive(live),
  getActiveTheme: () => {
    const s = useBroadcastStore.getState()
    return s.themes.find((t) => t.id === s.activeThemeId) ?? s.themes[0]
  },
}

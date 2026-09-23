import { useEffect } from "react"
import { PanelHeader } from "@/components/ui/panel-header"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import { useBibleStore, useBroadcastStore } from "@/stores"
import { bibleActions } from "@/hooks/use-bible"
import { toVerseRenderData } from "@/hooks/use-broadcast"
import type { Verse } from "@/types"

export function PreviewPanel() {
  const selectedVerse = useBibleStore((s) => s.selectedVerse)
  const translations = useBibleStore((s) => s.translations)
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)

  useEffect(() => {
    const verse = useBibleStore.getState().selectedVerse
    if (verse && verse.book_number > 0 && verse.chapter > 0 && verse.verse > 0) {
      bibleActions
        .fetchVerse(verse.book_number, verse.chapter, verse.verse)
        .then((v) => {
          if (v) bibleActions.selectVerse(v)
        })
        .catch(() => {})
    }
  }, [activeTranslationId])
  const secondaryTranslationId = useBibleStore((s) => s.secondaryTranslationId)
  const isDualMode = useBibleStore((s) => s.isDualMode)
  const secondaryChapter = useBibleStore((s) => s.secondaryChapter)

  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)
  const previewVerse = useBroadcastStore((s) => s.previewVerse)
  const liveVerse = useBroadcastStore((s) => s.liveVerse)

  const activeTheme = themes.find((t) => t.id === activeThemeId) ?? themes[0]
  const translation = translations.find((t) => t.id === activeTranslationId)?.abbreviation ?? "NIV"
  const secondaryTranslation = translations.find((t) => t.id === secondaryTranslationId)?.abbreviation ?? "TEL"

  const secondaryVerseFromChapter =
    isDualMode &&
    selectedVerse &&
    secondaryChapter.length > 0 &&
    Number(secondaryChapter[0]?.book_number) === Number(selectedVerse.book_number) &&
    Number(secondaryChapter[0]?.chapter) === Number(selectedVerse.chapter)
      ? secondaryChapter.find((v) => Number(v.verse) === Number(selectedVerse.verse)) ?? null
      : null

  const secondaryVerse =
    secondaryVerseFromChapter ?? ((selectedVerse as any)?.secondaryVerse as Verse | null) ?? null

  const verseData = selectedVerse
    ? toVerseRenderData(
        selectedVerse,
        translation,
        isDualMode ? secondaryVerse : null,
        isDualMode ? secondaryTranslation : undefined,
      )
    : null

  // Resolution order for Program Preview:
  // 1. Explicitly previewed song / slide / verse in broadcastStore (previewVerse)
  // 2. Currently selected Bible verse (verseData)
  // 3. Currently live output (liveVerse)
  const displayData = previewVerse ?? verseData ?? liveVerse

  return (
    <div
      data-slot="preview-panel"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <PanelHeader title="Program preview" />
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <CanvasVerse theme={activeTheme} verse={displayData} />
      </div>
    </div>
  )
}

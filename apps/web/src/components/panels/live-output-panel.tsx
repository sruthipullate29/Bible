import { useEffect, useMemo } from "react"
import { PanelHeader } from "@/components/ui/panel-header"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import { cn } from "@/lib/utils"
import { useBroadcastStore, useBibleStore } from "@/stores"
import { deriveLiveVerse } from "@/hooks/use-broadcast"
import { TvIcon } from "lucide-react"

export function LiveOutputPanel() {
  const isLive = useBroadcastStore((s) => s.isLive)
  const isWiredActive = useBroadcastStore((s) => s.isWiredActive)
  const toggleWiredDisplay = useBroadcastStore((s) => s.toggleWiredDisplay)
  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)

  const selectedVerse = useBibleStore((s) => s.selectedVerse)
  const translations = useBibleStore((s) => s.translations)
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)

  const secondaryTranslationId = useBibleStore((s) => s.secondaryTranslationId)
  const isDualMode = useBibleStore((s) => s.isDualMode)
  const secondaryChapter = useBibleStore((s) => s.secondaryChapter)

  const activeTheme = themes.find((t) => t.id === activeThemeId) ?? themes[0]
  const translation =
    translations.find((t) => t.id === activeTranslationId)?.abbreviation ?? "NIV"
  const secondaryTranslation =
    translations.find((t) => t.id === secondaryTranslationId)?.abbreviation ?? "TEL"

  const secondaryVerse = isDualMode && selectedVerse && secondaryChapter.length > 0
    ? secondaryChapter.find((v) => v.verse === selectedVerse.verse) ?? null
    : null

  const verseData = useMemo(
    () =>
      deriveLiveVerse({
        isLive,
        selectedVerse,
        translation,
        secondaryVerse: isDualMode ? secondaryVerse : null,
        secondaryTranslation: isDualMode ? secondaryTranslation : undefined,
      }),
    [isLive, selectedVerse, translation, isDualMode, secondaryVerse, secondaryTranslation]
  )

  useEffect(() => {
    useBroadcastStore.getState().setLiveVerse(verseData)
  }, [verseData])

  return (
    <div
      data-slot="live-output-panel"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
        isLive && "shadow-[inset_0_2px_0_0_rgba(16,185,129,0.3)]"
      )}
    >
      <PanelHeader title="Live display">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => toggleWiredDisplay()}
            title={isWiredActive ? "Wired broadcast active (Click to disconnect)" : "Connect wired broadcast (Projector/HDMI)"}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.5625rem] font-medium uppercase tracking-wider transition-all border",
              isWiredActive
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-muted/60 border-border/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <TvIcon className="size-2.5" />
            <span>{isWiredActive ? "Wired: Live" : "Wired"}</span>
          </button>
          <button
            onClick={() => useBroadcastStore.getState().setLive(!isLive)}
            className={cn(
              "flex items-center gap-2 rounded-full px-2.5 py-1 text-[0.625rem] font-medium uppercase tracking-wider transition-all",
              isLive
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                isLive
                  ? "animate-pulse bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                  : "bg-muted-foreground/50"
              )}
            />
            {isLive ? "Live" : "Go live"}
          </button>
        </div>
      </PanelHeader>

      <div
        className={cn(
          "flex min-h-0 flex-1 items-center justify-center p-3 transition-opacity",
          !isLive && "opacity-40"
        )}
      >
        <CanvasVerse theme={activeTheme} verse={verseData} />
      </div>
    </div>
  )
}

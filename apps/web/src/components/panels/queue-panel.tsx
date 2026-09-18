import { PanelHeader } from "@/components/ui/panel-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  PlayIcon,
  XIcon,
  GripVerticalIcon,
} from "lucide-react"
import { useQueueStore, useBroadcastStore, useBibleStore } from "@/stores"
import { toVerseRenderData } from "@/hooks/use-broadcast"
import { bibleActions } from "@/hooks/use-bible"
import { api } from "@/services"
import { resolveBook, parseReference } from "@/lib/bible-books"
import type { QueueItem, Verse } from "@/types"

function QueueItemRow({
  item,
  index,
  isActive,
}: {
  item: QueueItem
  index: number
  isActive: boolean
}) {
  const handlePresent = async () => {
    useQueueStore.getState().setActive(index)

    const bibleState = useBibleStore.getState()
    const parsed = parseReference(item.reference)

    let bookNumber = Number(item.verse.book_number) || 0
    let chapter = Number(item.verse.chapter) || 0
    let verse = Number(item.verse.verse) || 0

    if (parsed) {
      if (!bookNumber) bookNumber = parsed.bookNumber
      if (!chapter) chapter = parsed.chapter
      if (!verse) verse = parsed.verse
    }

    if (!bookNumber && item.verse.book_name) {
      const resolved = resolveBook(item.verse.book_name)
      if (resolved) bookNumber = resolved.num
    }

    if (!bookNumber) {
      const matchBook = bibleState.books.find(
        (b) =>
          b.name.toLowerCase() === item.verse.book_name?.toLowerCase() ||
          b.abbreviation.toLowerCase() === item.verse.book_abbreviation?.toLowerCase()
      )
      bookNumber = matchBook?.book_number ?? 1
    }

    const resolved = resolveBook(bookNumber)
    const bookName = resolved?.name || item.verse.book_name || ""
    const teluguBookName = resolved?.teluguName || item.secondaryVerse?.book_name || ""

    const { isDualMode, secondaryTranslationId, activeTranslationId, translations } =
      useBibleStore.getState()
    const primaryAbbr =
      translations.find((t) => t.id === activeTranslationId)?.abbreviation ?? "NIV"
    const secondaryAbbr =
      translations.find((t) => t.id === secondaryTranslationId)?.abbreviation ?? "TEL"

    // Fetch primary verse to guarantee fresh verse text for the active translation
    let primaryVerse: Verse = {
      ...item.verse,
      book_number: bookNumber,
      book_name: bookName || item.verse.book_name,
      chapter,
      verse,
    }
    try {
      const fetched = await api.getVerse(activeTranslationId, bookNumber, chapter, verse)
      if (fetched?.text) {
        primaryVerse = {
          ...fetched,
          book_number: bookNumber,
          book_name: bookName || fetched.book_name,
          chapter,
          verse,
        }
      }
    } catch {
      // fallback to primaryVerse
    }

    // Fetch or retrieve secondary Telugu verse
    let secVerse: Verse | null = item.secondaryVerse ?? null
    if (!secVerse && isDualMode && secondaryTranslationId) {
      try {
        const fetchedSec = await api.getVerse(secondaryTranslationId, bookNumber, chapter, verse)
        if (fetchedSec?.text) {
          secVerse = {
            ...fetchedSec,
            book_number: bookNumber,
            book_name: teluguBookName || fetchedSec.book_name,
            chapter,
            verse,
          }
        }
      } catch (err) {
        console.warn("[queue-panel] Could not fetch secondary verse:", err)
      }
    } else if (secVerse && !secVerse.book_name && teluguBookName) {
      secVerse = { ...secVerse, book_name: teluguBookName, book_number: bookNumber }
    }

    // 1. Select the verse (augmented with secondaryVerse if present)
    const verseToSelect = secVerse ? { ...primaryVerse, secondaryVerse: secVerse } : primaryVerse
    bibleActions.selectVerse(verseToSelect)

    // 2. Set live on broadcast screen
    useBroadcastStore.getState().setLive(true)
    useBroadcastStore.getState().setLiveVerse(
      toVerseRenderData(
        primaryVerse,
        primaryAbbr,
        isDualMode ? secVerse : null,
        isDualMode ? secondaryAbbr : undefined
      )
    )

    // 3. Navigate Book Search to this chapter and highlight the verse
    bibleActions.navigateToVerse(bookNumber, chapter, verse)
  }

  const handleRemove = () => {
    useQueueStore.getState().removeItem(item.id)
  }

  const sourceBadge =
    item.source === "manual" ? (
      <Badge variant="outline" className="shrink-0 text-[0.5rem]">
        Manual
      </Badge>
    ) : (
      <Badge
        variant="default"
        className="shrink-0 bg-ai-direct/15 text-[0.5rem] text-ai-direct hover:bg-ai-direct/15"
      >
        AI
      </Badge>
    )

  return (
    <div
      onClick={handlePresent}
      className={cn(
        "group flex h-10 items-center gap-2 rounded-md px-2.5 transition-colors cursor-pointer select-none",
        isActive
          ? "border border-primary/30 bg-primary/10"
          : "hover:bg-muted/50"
      )}
    >
      <GripVerticalIcon
        className="size-3 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100"
      />

      <span className="flex-1 truncate text-sm font-medium text-foreground">
        {item.reference}
      </span>

      {sourceBadge}

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation()
            handlePresent()
          }}
          title="Present"
        >
          <PlayIcon className="size-2.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation()
            handleRemove()
          }}
          title="Remove from queue"
        >
          <XIcon className="size-2.5" />
        </Button>
      </div>
    </div>
  )
}

export function QueuePanel() {
  const items = useQueueStore((s) => s.items)
  const activeIndex = useQueueStore((s) => s.activeIndex)

  return (
    <div
      data-slot="queue-panel"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <PanelHeader title="Queue">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{items.length}</Badge>
          <button
            onClick={() => useQueueStore.getState().clearQueue()}
            className="text-[0.625rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5 p-1.5">
          {items.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">
              Verses will appear here when detected or queued
            </p>
          )}
          {items.map((item, idx) => (
            <QueueItemRow
              key={item.id}
              item={item}
              index={idx}
              isActive={idx === activeIndex}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

import { useState, useRef } from "react"
import { PanelHeader } from "@/components/ui/panel-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  PlayIcon,
  XIcon,
  GripVerticalIcon,
  DownloadIcon,
  UploadIcon,
  DatabaseIcon,
  FileTextIcon,
  MusicIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { exportQueueAsJson, exportQueueAsText, parseQueueFile } from "@/lib/queue-io"
import { useQueueStore, useBroadcastStore, useBibleStore } from "@/stores"
import { toVerseRenderData } from "@/hooks/use-broadcast"
import { bibleActions } from "@/hooks/use-bible"
import { api } from "@/services"
import { resolveBook, parseReference } from "@/lib/bible-books"
import { SongLyricsDialog } from "@/components/song/song-lyrics-dialog"
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

    // If this is a song lyric slide or non-Bible reference, display directly
    if (item.source === "song" || !parseReference(item.reference)) {
      useBroadcastStore.getState().setLive(true)
      useBroadcastStore.getState().setLiveVerse({
        reference: item.reference,
        segments: [
          {
            verseNumber: item.verse.verse || 1,
            text: item.secondaryVerse?.text
              ? `${item.verse.text}\n\n${item.secondaryVerse.text}`
              : item.verse.text,
          },
        ],
      })
      return
    }

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

  let sourceBadge = (
    <Badge
      variant="default"
      className="shrink-0 bg-ai-direct/15 text-[0.5rem] text-ai-direct hover:bg-ai-direct/15"
    >
      AI
    </Badge>
  )
  if (item.source === "song") {
    sourceBadge = (
      <Badge
        variant="default"
        className="shrink-0 bg-purple-500/15 text-[0.5rem] text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 gap-0.5"
      >
        <MusicIcon className="size-2.5" />
        Song
      </Badge>
    )
  } else if (item.source === "manual") {
    sourceBadge = (
      <Badge variant="outline" className="shrink-0 text-[0.5rem]">
        Manual
      </Badge>
    )
  }

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
  const [isSongDialogOpen, setIsSongDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportJson = async () => {
    if (items.length === 0) {
      toast.info("Queue is empty. Add verses to save.")
      return
    }
    try {
      const res = await exportQueueAsJson(items)
      if (res.success) {
        toast.success(`Saved ${items.length} verses to local database file (${res.filename})`)
      }
    } catch (err) {
      toast.error("Failed to save queue file", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const handleExportText = async () => {
    if (items.length === 0) {
      toast.info("Queue is empty. Add verses to export.")
      return
    }
    try {
      const res = await exportQueueAsText(items)
      if (res.success) {
        toast.success(`Exported ${items.length} verses as text set list`)
      }
    } catch (err) {
      toast.error("Failed to export set list", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const imported = parseQueueFile(text)
      useQueueStore.getState().appendItems(imported)
      toast.success(`Imported ${imported.length} verses into queue and local database`)
    } catch (err) {
      toast.error("Failed to import queue file", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <div
      data-slot="queue-panel"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      <SongLyricsDialog
        open={isSongDialogOpen}
        onOpenChange={setIsSongDialogOpen}
      />

      <PanelHeader title="Queue">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="h-5 px-1.5 text-xs font-semibold">
            {items.length}
          </Badge>

          {/* Add Song / Lyrics / PPT Button */}
          <Button
            variant="outline"
            size="xs"
            className="h-6 gap-1 px-2 text-[0.65rem] border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
            onClick={() => setIsSongDialogOpen(true)}
            title="Add song lyrics from clipboard, Word doc (.docx), or PowerPoint (.pptx)"
          >
            <MusicIcon className="size-2.5" />
            Add Song
          </Button>

          {/* Local Database Saved Indicator */}
          <div
            className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[0.625rem] font-medium text-emerald-600 dark:text-emerald-400"
            title="Continuous auto-save: all verses in queue are automatically saved to your system's local database"
          >
            <DatabaseIcon className="size-2.5" />
            <span className="hidden sm:inline">Local DB</span>
          </div>

          {/* Download / Save Queue to File */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Save / Download Queue File"
              >
                <DownloadIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleExportJson} className="gap-2">
                <DatabaseIcon className="size-3.5 text-emerald-500" />
                <div className="flex flex-col">
                  <span className="font-medium">Download Database File</span>
                  <span className="text-[0.625rem] text-muted-foreground">
                    Save as .json to backup or transfer
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportText} className="gap-2">
                <FileTextIcon className="size-3.5 text-blue-500" />
                <div className="flex flex-col">
                  <span className="font-medium">Export Set List (.txt)</span>
                  <span className="text-[0.625rem] text-muted-foreground">
                    Readable text with Telugu & English
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Import / Load Saved Queue File */}
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            title="Import / Open Saved Queue File (.json)"
          >
            <UploadIcon className="size-3.5" />
          </Button>

          {/* Clear All */}
          {items.length > 0 && (
            <button
              onClick={() => useQueueStore.getState().clearQueue()}
              className="ml-1 text-[0.625rem] text-muted-foreground transition-colors hover:text-foreground"
              title="Clear all verses from queue"
            >
              Clear all
            </button>
          )}
        </div>
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5 p-1.5">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <DatabaseIcon className="mb-2 size-6 text-muted-foreground/30" />
              <p className="text-xs font-medium text-muted-foreground">
                Queue is empty
              </p>
              <p className="mt-1 text-[0.7rem] text-muted-foreground/70">
                Verses and song slides added here are saved to your local database
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  className="gap-1.5 text-[0.7rem]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon className="size-3" />
                  Load Saved File
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  className="gap-1.5 text-[0.7rem] border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                  onClick={() => setIsSongDialogOpen(true)}
                >
                  <MusicIcon className="size-3" />
                  Add Song
                </Button>
              </div>
            </div>
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

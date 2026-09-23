import { useState, useEffect, useId } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  SplitIcon,
  MergeIcon,
  PlusIcon,
  Trash2Icon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlayIcon,
  CheckCircle2Icon,
  LayersIcon,
  FileSpreadsheetIcon,
  BookOpenIcon,
} from "lucide-react"
import { useSongStore } from "@/stores/song-store"
import { useQueueStore, useBroadcastStore } from "@/stores"
import type { Song, QueueItem } from "@/types"
import type { SongSlide } from "@/lib/song-parser"

interface SongEditDialogProps {
  song: Song | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (updated: Song) => void
}

export function SongEditDialog({ song, open, onOpenChange, onSaved }: SongEditDialogProps) {
  const updateSong = useSongStore((s) => s.updateSong)
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [category, setCategory] = useState("Worship")
  const [slides, setSlides] = useState<SongSlide[]>([])
  const [pageCountInput, setPageCountInput] = useState<number>(4)
  const [selectedSlideIdx, setSelectedSlideIdx] = useState<number>(0)
  const idPrefix = useId()

  useEffect(() => {
    if (song) {
      setTitle(song.title)
      setAuthor(song.author || "")
      setCategory(song.category || "Worship")
      setSlides(song.slides && song.slides.length > 0 ? [...song.slides] : [
        { id: `slide-1`, label: "Page 1", text: "" }
      ])
      setPageCountInput(song.slides.length || 1)
      setSelectedSlideIdx(0)
    }
  }, [song, open])

  // Extract all lines from current slides into a flat array of lines
  const getAllLines = (currentSlides: SongSlide[]): string[] => {
    const lines: string[] = []
    for (const slide of currentSlides) {
      const split = slide.text.split(/\r?\n/)
      for (const line of split) {
        const trimmed = line.trim()
        if (trimmed) lines.push(trimmed)
      }
    }
    return lines
  }

  // Divide the song into exactly N pages
  const handleDivideIntoPages = (targetPages: number) => {
    if (targetPages <= 0) return
    const allLines = getAllLines(slides)
    if (allLines.length === 0) {
      toast.warning("Song has no lyrics to divide.")
      return
    }

    const linesPerPage = Math.ceil(allLines.length / targetPages)
    const newSlides: SongSlide[] = []

    for (let p = 0; p < targetPages; p++) {
      const start = p * linesPerPage
      const end = start + linesPerPage
      const pageLines = allLines.slice(start, end)
      if (pageLines.length === 0) break

      newSlides.push({
        id: `slide-${idPrefix}-${p + 1}`,
        label: `Page ${p + 1}`,
        text: pageLines.join("\n"),
      })
    }

    setSlides(newSlides)
    setPageCountInput(newSlides.length)
    setSelectedSlideIdx(0)
    toast.success(`Divided "${title || "Song"}" into ${newSlides.length} pages (${linesPerPage} lines each)`)
  }

  // Divide the song by a fixed number of lines per page (e.g. 2, 4, 6 lines per page)
  const handleDivideByLinesPerPage = (linesPerPage: number) => {
    const allLines = getAllLines(slides)
    if (allLines.length === 0) {
      toast.warning("Song has no lyrics to divide.")
      return
    }

    const newSlides: SongSlide[] = []
    let pageNum = 1

    for (let i = 0; i < allLines.length; i += linesPerPage) {
      const pageLines = allLines.slice(i, i + linesPerPage)
      newSlides.push({
        id: `slide-${idPrefix}-${pageNum}`,
        label: `Page ${pageNum}`,
        text: pageLines.join("\n"),
      })
      pageNum++
    }

    setSlides(newSlides)
    setPageCountInput(newSlides.length)
    setSelectedSlideIdx(0)
    toast.success(`Divided into ${newSlides.length} pages (${linesPerPage} lines per page)`)
  }

  // Split a specific page in half
  const handleSplitPage = (idx: number) => {
    const target = slides[idx]
    if (!target) return
    const lines = target.text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) {
      toast.info("This page has only 1 line and cannot be split further.")
      return
    }

    const mid = Math.ceil(lines.length / 2)
    const part1Lines = lines.slice(0, mid)
    const part2Lines = lines.slice(mid)

    const updated = [...slides]
    const p1: SongSlide = {
      id: `slide-${idPrefix}-${Date.now()}-1`,
      label: `${target.label} (Part 1)`,
      text: part1Lines.join("\n"),
    }
    const p2: SongSlide = {
      id: `slide-${idPrefix}-${Date.now()}-2`,
      label: `${target.label} (Part 2)`,
      text: part2Lines.join("\n"),
    }

    updated.splice(idx, 1, p1, p2)
    setSlides(updated)
    setPageCountInput(updated.length)
    toast.success(`Split page into 2 separate pages`)
  }

  // Merge this page with the next page
  const handleMergeWithNext = (idx: number) => {
    if (idx >= slides.length - 1) return
    const current = slides[idx]
    const next = slides[idx + 1]

    const merged: SongSlide = {
      id: current.id,
      label: current.label,
      text: `${current.text.trim()}\n\n${next.text.trim()}`.trim(),
    }

    const updated = [...slides]
    updated.splice(idx, 2, merged)
    setSlides(updated)
    setPageCountInput(updated.length)
    toast.success(`Merged pages into one`)
  }

  const handleUpdateSlide = (id: string, text: string) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)))
  }

  const handleUpdateLabel = (id: string, label: string) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)))
  }

  const handleDeletePage = (id: string) => {
    if (slides.length <= 1) {
      toast.warning("A song must have at least 1 page.")
      return
    }
    const updated = slides.filter((s) => s.id !== id)
    setSlides(updated)
    setPageCountInput(updated.length)
    if (selectedSlideIdx >= updated.length) {
      setSelectedSlideIdx(updated.length - 1)
    }
  }

  const handleAddBlankPage = () => {
    const newPage: SongSlide = {
      id: `slide-${idPrefix}-${Date.now()}`,
      label: `Page ${slides.length + 1}`,
      text: "",
    }
    const updated = [...slides, newPage]
    setSlides(updated)
    setPageCountInput(updated.length)
    setSelectedSlideIdx(updated.length - 1)
  }

  const handleMovePage = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= slides.length) return
    const updated = [...slides]
    const temp = updated[idx]
    updated[idx] = updated[targetIdx]
    updated[targetIdx] = temp
    setSlides(updated)
    setSelectedSlideIdx(targetIdx)
  }

  const handleProjectLive = (slide: SongSlide) => {
    useBroadcastStore.getState().setLive(true)
    useBroadcastStore.getState().setLiveVerse({
      reference: `${title || "Song"} - ${slide.label}`,
      segments: [
        {
          verseNumber: 1,
          text: slide.text,
        },
      ],
    })
    toast.success(`Projected "${title} - ${slide.label}" live!`)
  }

  const handleSaveOnly = () => {
    if (!song) return
    const cleanSlides = slides.filter((s) => s.text.trim().length > 0)
    if (cleanSlides.length === 0) {
      toast.warning("Song must have at least one non-empty page.")
      return
    }

    const updatedData: Partial<Song> = {
      title: title.trim() || song.title,
      author: author.trim() || undefined,
      category: category.trim() || undefined,
      slides: cleanSlides,
    }

    updateSong(song.id, updatedData)
    toast.success(`Saved "${title}" (${cleanSlides.length} pages) to Song Library!`)
    if (onSaved) onSaved({ ...song, ...updatedData, updatedAt: Date.now() })
    onOpenChange(false)
  }

  const handleSaveAndQueue = () => {
    if (!song) return
    const cleanSlides = slides.filter((s) => s.text.trim().length > 0)
    if (cleanSlides.length === 0) {
      toast.warning("Song must have at least one non-empty page.")
      return
    }

    const updatedData: Partial<Song> = {
      title: title.trim() || song.title,
      author: author.trim() || undefined,
      category: category.trim() || undefined,
      slides: cleanSlides,
    }

    updateSong(song.id, updatedData)

    const queueItems: QueueItem[] = cleanSlides.map((slide, idx) => ({
      id: crypto.randomUUID(),
      verse: {
        id: (Date.now() + idx) % 2147483647,
        translation_id: 0,
        book_number: 0,
        book_name: title.trim() || song.title,
        book_abbreviation: author?.trim()?.slice(0, 10).toUpperCase() || "SONG",
        chapter: 1,
        verse: idx + 1,
        text: slide.text,
      },
      reference: `${title.trim() || song.title} - ${slide.label}`,
      confidence: 1,
      source: "song",
      added_at: Date.now() + idx,
    }))

    useQueueStore.getState().appendItems(queueItems)
    toast.success(`Saved and queued ${cleanSlides.length} pages for live projection!`)
    if (onSaved) onSaved({ ...song, ...updatedData, updatedAt: Date.now() })
    onOpenChange(false)
  }

  const activeSlide = slides[selectedSlideIdx] || slides[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6 gap-3">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <BookOpenIcon className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Edit Song & Page Divisions
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Divide this song into custom presentation pages or slides for live projection.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold">
              Currently {slides.length} Page{slides.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </DialogHeader>

        {/* SONG DETAILS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-[0.65rem] font-bold uppercase text-muted-foreground">
              Song Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Song Title"
              className="h-7 text-xs font-medium"
            />
          </div>
          <div>
            <label className="text-[0.65rem] font-bold uppercase text-muted-foreground">
              Artist / Author
            </label>
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. Chris Tomlin"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-[0.65rem] font-bold uppercase text-muted-foreground">
              Category
            </label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Worship, Praise, Telugu, Hymn"
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* AUTOMATIC PAGE DIVISION TOOLBAR */}
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <SplitIcon className="size-3.5 text-purple-500" />
              <span className="text-xs font-bold text-foreground">
                How many pages should this song be divided into?
              </span>
            </div>
            <span className="text-[0.65rem] text-muted-foreground">
              Quickly re-divide all lyrics evenly across pages
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Direct Number Input Stepper */}
            <div className="flex items-center gap-1 bg-card rounded-md border border-border px-1.5 py-0.5">
              <span className="text-xs font-medium text-muted-foreground mr-1">Pages:</span>
              <button
                type="button"
                onClick={() => setPageCountInput((p) => Math.max(1, p - 1))}
                className="size-5 flex items-center justify-center rounded hover:bg-muted text-xs font-bold"
              >
                -
              </button>
              <Input
                type="number"
                min={1}
                max={30}
                value={pageCountInput}
                onChange={(e) => setPageCountInput(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-6 w-12 text-center text-xs p-0 border-0"
              />
              <button
                type="button"
                onClick={() => setPageCountInput((p) => p + 1)}
                className="size-5 flex items-center justify-center rounded hover:bg-muted text-xs font-bold"
              >
                +
              </button>
            </div>

            <Button
              size="xs"
              onClick={() => handleDivideIntoPages(pageCountInput)}
              className="h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-700 text-white font-medium"
            >
              <FileSpreadsheetIcon className="size-3" />
              Divide into {pageCountInput} Pages
            </Button>

            <div className="h-4 w-px bg-border/80 mx-1" />

            {/* Quick Page Presets */}
            <span className="text-[0.65rem] text-muted-foreground">Presets:</span>
            {[2, 3, 4, 6, 8].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  setPageCountInput(num)
                  handleDivideIntoPages(num)
                }}
                className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors border ${
                  slides.length === num
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {num} Pages
              </button>
            ))}

            <div className="h-4 w-px bg-border/80 mx-1" />

            {/* Quick Lines per Page Presets */}
            <span className="text-[0.65rem] text-muted-foreground">By Lines:</span>
            {[2, 4, 6].map((lines) => (
              <button
                key={lines}
                type="button"
                onClick={() => handleDivideByLinesPerPage(lines)}
                className="rounded px-2 py-0.5 text-xs font-medium border border-border bg-card hover:bg-muted"
              >
                {lines} Lines/Pg
              </button>
            ))}
          </div>
        </div>

        {/* TWO-COLUMN VIEW: PAGES LIST ON LEFT, LIVE PREVIEW ON RIGHT */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 min-h-0 flex-1 overflow-hidden">
          {/* Left Column: Pages List (8 cols) */}
          <div className="md:col-span-8 flex flex-col min-h-0 border border-border rounded-lg bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-muted/30">
              <span className="text-xs font-bold text-foreground">
                Song Pages ({slides.length})
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={handleAddBlankPage}
                className="h-6 gap-1 text-[0.65rem]"
              >
                <PlusIcon className="size-2.5" />
                Add Blank Page
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-2 max-h-[320px]">
              {slides.map((slide, idx) => {
                const isSelected = selectedSlideIdx === idx
                return (
                  <div
                    key={slide.id}
                    onClick={() => setSelectedSlideIdx(idx)}
                    className={`rounded-md border p-2.5 space-y-2 transition-all cursor-pointer ${
                      isSelected
                        ? "border-purple-500 bg-purple-500/5 shadow-xs"
                        : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                          #{idx + 1}
                        </span>
                        <Input
                          value={slide.label}
                          onChange={(e) => handleUpdateLabel(slide.id, e.target.value)}
                          className="h-6 w-36 text-xs font-medium px-1.5"
                          placeholder="Page Label"
                        />
                        <span className="text-[0.65rem] text-muted-foreground ml-1">
                          ({slide.text.split(/\r?\n/).filter((l) => l.trim()).length} lines)
                        </span>
                      </div>

                      {/* Page specific action buttons */}
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title="Split this page into 2 pages"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSplitPage(idx)
                          }}
                        >
                          <SplitIcon className="size-3 text-purple-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          disabled={idx === slides.length - 1}
                          title="Merge with next page"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMergeWithNext(idx)
                          }}
                        >
                          <MergeIcon className="size-3 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          disabled={idx === 0}
                          title="Move Up"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMovePage(idx, "up")
                          }}
                        >
                          <ArrowUpIcon className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          disabled={idx === slides.length - 1}
                          title="Move Down"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMovePage(idx, "down")
                          }}
                        >
                          <ArrowDownIcon className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title="Delete Page"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePage(slide.id)
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    </div>

                    <Textarea
                      value={slide.text}
                      onChange={(e) => handleUpdateSlide(slide.id, e.target.value)}
                      rows={3}
                      placeholder="Enter lyrics for this page..."
                      className="text-xs font-sans resize-y leading-relaxed"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Live Projection Preview (4 cols) */}
          <div className="md:col-span-4 flex flex-col min-h-0 border border-border rounded-lg bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                Projection Preview
              </span>
              {activeSlide && (
                <Badge variant="outline" className="text-[0.6rem] h-4">
                  {activeSlide.label}
                </Badge>
              )}
            </div>

            {/* Display Simulator */}
            <div className="flex-1 min-h-[180px] rounded-lg border border-border/70 bg-black/90 p-4 flex flex-col justify-center items-center text-center shadow-inner relative overflow-hidden">
              <div className="absolute top-2 left-2 text-[0.6rem] text-muted-foreground/60 font-semibold tracking-wider uppercase">
                {title || "Song"} • {activeSlide?.label || "Page 1"}
              </div>

              <p className="whitespace-pre-line text-sm font-semibold text-white tracking-wide leading-relaxed max-w-full overflow-hidden">
                {activeSlide?.text || "(No lyrics on this page)"}
              </p>

              {author && (
                <div className="absolute bottom-2 right-2 text-[0.55rem] text-muted-foreground/50">
                  {author}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="xs"
              onClick={() => activeSlide && handleProjectLive(activeSlide)}
              className="w-full gap-1.5 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-medium"
            >
              <PlayIcon className="size-3" />
              Project Page #{selectedSlideIdx + 1} Live
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-2 flex items-center justify-between sm:justify-between w-full border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveOnly}
              className="gap-1.5 text-xs font-medium"
            >
              <CheckCircle2Icon className="size-3.5 text-emerald-500" />
              Save Changes to Library
            </Button>

            <Button
              size="sm"
              onClick={handleSaveAndQueue}
              className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white font-medium"
            >
              <LayersIcon className="size-3.5" />
              Save & Send {slides.length} Pages to Queue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

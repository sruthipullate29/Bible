import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  ClipboardIcon,
  FileTextIcon,
  PresentationIcon,
  PlusIcon,
  Trash2Icon,
  ArrowUpIcon,
  ArrowDownIcon,
  MusicIcon,
  CheckCircle2Icon,
  SparklesIcon,
} from "lucide-react"
import {
  parseTextToSlides,
  parseSongFile,
  type SongSlide,
  type ParsedSong,
} from "@/lib/song-parser"
import { useQueueStore, useSongStore } from "@/stores"
import type { QueueItem } from "@/types"

interface SongLyricsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SongLyricsDialog({ open, onOpenChange }: SongLyricsDialogProps) {
  const [activeTab, setActiveTab] = useState<"clipboard" | "word" | "powerpoint">("clipboard")
  const [clipboardText, setClipboardText] = useState("")
  const [songTitle, setSongTitle] = useState("")
  const [songAuthor, setSongAuthor] = useState("")
  const [slides, setSlides] = useState<SongSlide[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const wordFileInputRef = useRef<HTMLInputElement>(null)
  const pptFileInputRef = useRef<HTMLInputElement>(null)

  const applyParsedSong = (parsed: ParsedSong) => {
    setSongTitle(parsed.title || "Untitled Song")
    setSongAuthor(parsed.author || "")
    setSlides(parsed.slides)
    if (parsed.slides.length > 0) {
      toast.success(`Loaded "${parsed.title}" with ${parsed.slides.length} slide(s)`)
    } else {
      toast.warning("No slides were detected. You can add slides manually.")
    }
  }

  const handlePasteClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        toast.error("Clipboard access not supported in this browser.")
        return
      }
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        toast.warning("Clipboard is empty.")
        return
      }
      setClipboardText(text)
      const parsed = parseTextToSlides(text)
      applyParsedSong(parsed)
    } catch (err) {
      toast.error("Could not read clipboard. Please paste manually into the text box.", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const handleParseClipboardText = () => {
    if (!clipboardText.trim()) {
      toast.warning("Please paste or type lyrics first.")
      return
    }
    const parsed = parseTextToSlides(clipboardText, songTitle || undefined)
    applyParsedSong(parsed)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    try {
      const parsed = await parseSongFile(file)
      applyParsedSong(parsed)
    } catch (err) {
      console.error("[SongLyricsDialog] Parse file error:", err)
      toast.error("Failed to parse file", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsProcessing(false)
      e.target.value = ""
    }
  }

  const handleUpdateSlideText = (id: string, text: string) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)))
  }

  const handleUpdateSlideLabel = (id: string, label: string) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)))
  }

  const handleRemoveSlide = (id: string) => {
    setSlides((prev) => prev.filter((s) => s.id !== id))
  }

  const handleMoveSlide = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= slides.length) return
    const updated = [...slides]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setSlides(updated)
  }

  const handleAddNewSlide = () => {
    const newSlide: SongSlide = {
      id: `slide-${Date.now()}-${slides.length + 1}`,
      label: `Slide ${slides.length + 1}`,
      text: "",
    }
    setSlides((prev) => [...prev, newSlide])
  }

  const handleDivideIntoPages = (targetPages: number) => {
    if (targetPages <= 0) return
    const allLines: string[] = []
    for (const slide of slides) {
      for (const line of slide.text.split(/\r?\n/)) {
        if (line.trim()) allLines.push(line.trim())
      }
    }
    if (allLines.length === 0) {
      toast.warning("No lyrics to divide yet.")
      return
    }

    const linesPerPage = Math.ceil(allLines.length / targetPages)
    const newSlides: SongSlide[] = []
    for (let p = 0; p < targetPages; p++) {
      const pageLines = allLines.slice(p * linesPerPage, (p + 1) * linesPerPage)
      if (pageLines.length === 0) break
      newSlides.push({
        id: `slide-${Date.now()}-${p + 1}`,
        label: `Page ${p + 1}`,
        text: pageLines.join("\n"),
      })
    }
    setSlides(newSlides)
    toast.success(`Divided into ${newSlides.length} pages (${linesPerPage} lines each)`)
  }

  const handleAddToQueue = () => {
    const validSlides = slides.filter((s) => s.text.trim().length > 0)
    if (validSlides.length === 0) {
      toast.warning("No slides to add. Please enter some lyrics first.")
      return
    }

    const title = songTitle.trim() || "Song"
    const queueItems: QueueItem[] = validSlides.map((slide, idx) => ({
      id: crypto.randomUUID(),
      verse: {
        id: (Date.now() + idx) % 2147483647,
        translation_id: 0,
        book_number: 0,
        book_name: title,
        book_abbreviation: songAuthor.trim() ? songAuthor.trim().slice(0, 10).toUpperCase() : "SONG",
        chapter: 1,
        verse: idx + 1,
        text: slide.text.trim(),
      },
      reference: `${title} - ${slide.label}`,
      confidence: 1,
      source: "song",
      added_at: Date.now() + idx,
    }))

    // 1. Permanently save to Default Song Library
    const savedSong = useSongStore.getState().addSong({
      title,
      author: songAuthor.trim() || undefined,
      category: "Worship",
      slides: validSlides,
    })

    // 2. If an active daily playlist is selected, add song to it
    const activePlaylistId = useSongStore.getState().activePlaylistId
    if (activePlaylistId) {
      useSongStore.getState().addSongToPlaylist(activePlaylistId, savedSong.id)
    }

    // 3. Add slides to live presentation queue
    useQueueStore.getState().appendItems(queueItems)
    toast.success(`Saved "${title}" to Default Song Library & added ${queueItems.length} slide(s) to Queue!`)
    onOpenChange(false)

    // Reset state for next use
    setClipboardText("")
    setSongTitle("")
    setSongAuthor("")
    setSlides([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 gap-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <MusicIcon className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Add Song Lyrics & Presentation Slides
              </DialogTitle>
              <DialogDescription className="text-xs">
                Import lyrics from clipboard, Microsoft Word (.docx), or PowerPoint (.pptx) to queue for live display.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Input Methods Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "clipboard" | "word" | "powerpoint")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="clipboard" className="gap-1.5 text-xs">
              <ClipboardIcon className="size-3.5" />
              Clipboard / Text
            </TabsTrigger>
            <TabsTrigger value="word" className="gap-1.5 text-xs">
              <FileTextIcon className="size-3.5" />
              Word Doc (.docx)
            </TabsTrigger>
            <TabsTrigger value="powerpoint" className="gap-1.5 text-xs">
              <PresentationIcon className="size-3.5" />
              PowerPoint (.pptx)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CLIPBOARD */}
          <TabsContent value="clipboard" className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Paste raw lyrics or song chords/stanzas directly:
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={handlePasteClipboard}
                className="gap-1.5 text-xs"
              >
                <ClipboardIcon className="size-3" />
                Paste from Clipboard
              </Button>
            </div>
            <Textarea
              placeholder={`Amazing Grace, how sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.\n\n[Chorus]\nMy chains are gone, I've been set free\nMy God, my Savior has ransomed me...`}
              rows={6}
              value={clipboardText}
              onChange={(e) => setClipboardText(e.target.value)}
              className="font-mono text-xs leading-relaxed"
            />
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="xs"
                onClick={handleParseClipboardText}
                className="gap-1.5 text-xs"
              >
                <SparklesIcon className="size-3 text-purple-500" />
                Parse into Slides
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: WORD DOCUMENT */}
          <TabsContent value="word" className="mt-3">
            <input
              ref={wordFileInputRef}
              type="file"
              accept=".docx,.doc,.txt,.rtf,.md"
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              onClick={() => wordFileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-purple-500/50 hover:bg-muted/50 transition-colors rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer text-center"
            >
              <FileTextIcon className="size-8 text-blue-500 mb-2" />
              <p className="text-sm font-medium">Click to select Word document</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .docx, .doc, and .txt files. Stanzas and section headings will be converted to slides.
              </p>
              <Button
                variant="outline"
                size="xs"
                className="mt-3 gap-1.5"
                disabled={isProcessing}
              >
                {isProcessing ? "Reading Word File..." : "Browse Word File"}
              </Button>
            </div>
          </TabsContent>

          {/* TAB 3: POWERPOINT */}
          <TabsContent value="powerpoint" className="mt-3">
            <input
              ref={pptFileInputRef}
              type="file"
              accept=".pptx,.ppt"
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              onClick={() => pptFileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-purple-500/50 hover:bg-muted/50 transition-colors rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer text-center"
            >
              <PresentationIcon className="size-8 text-amber-500 mb-2" />
              <p className="text-sm font-medium">Click to select PowerPoint presentation</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .pptx and .ppt presentations. Each slide is preserved as a live presentation slide.
              </p>
              <Button
                variant="outline"
                size="xs"
                className="mt-3 gap-1.5"
                disabled={isProcessing}
              >
                {isProcessing ? "Reading PowerPoint Slides..." : "Browse Presentation"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* METADATA & SLIDES PREVIEW */}
        <div className="flex-1 min-h-0 flex flex-col border-t border-border pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[0.7rem] font-medium text-muted-foreground uppercase">
                Song / Presentation Title
              </label>
              <Input
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="e.g. 10,000 Reasons (Bless The Lord)"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[0.7rem] font-medium text-muted-foreground uppercase">
                Artist / Author / Tag (Optional)
              </label>
              <Input
                value={songAuthor}
                onChange={(e) => setSongAuthor(e.target.value)}
                placeholder="e.g. Matt Redman"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">Presentation Pages / Slides</span>
              <Badge variant="secondary" className="text-[0.65rem] px-1.5 h-4">
                {slides.length} page{slides.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              {slides.length > 0 && (
                <div className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5 border border-border/60">
                  <span className="text-[0.6rem] text-muted-foreground font-medium">Divide into:</span>
                  {[2, 3, 4, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleDivideIntoPages(num)}
                      className={`text-[0.6rem] px-1.5 py-0.5 rounded transition-colors font-semibold ${
                        slides.length === num
                          ? "bg-purple-600 text-white"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {num} pgs
                    </button>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="xs"
                onClick={handleAddNewSlide}
                className="gap-1 text-xs h-7"
              >
                <PlusIcon className="size-3" />
                Add Blank Page
              </Button>
            </div>
          </div>

          {/* Scrollable Slide List */}
          <div className="min-h-0 flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[300px]">
            {slides.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
                <MusicIcon className="size-6 text-muted-foreground/40 mb-1.5" />
                <p className="text-xs font-medium text-muted-foreground">
                  No slides parsed yet
                </p>
                <p className="text-[0.7rem] text-muted-foreground/70">
                  Paste lyrics above or upload a Word/PPT file to preview slides here
                </p>
              </div>
            ) : (
              slides.map((slide, idx) => (
                <div
                  key={slide.id}
                  className="rounded-lg border border-border bg-card p-2.5 space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-[0.65rem] font-bold text-muted-foreground/80 w-4">
                        #{idx + 1}
                      </span>
                      <Input
                        value={slide.label}
                        onChange={(e) => handleUpdateSlideLabel(slide.id, e.target.value)}
                        placeholder="Slide Label (e.g. Verse 1, Chorus)"
                        className="h-6 w-36 text-xs font-medium px-1.5 py-0.5"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={idx === 0}
                        onClick={() => handleMoveSlide(idx, "up")}
                        title="Move Up"
                      >
                        <ArrowUpIcon className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={idx === slides.length - 1}
                        onClick={() => handleMoveSlide(idx, "down")}
                        title="Move Down"
                      >
                        <ArrowDownIcon className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveSlide(slide.id)}
                        className="text-destructive hover:text-destructive"
                        title="Delete Slide"
                      >
                        <Trash2Icon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={slide.text}
                    onChange={(e) => handleUpdateSlideText(slide.id, e.target.value)}
                    rows={2}
                    placeholder="Enter slide lyrics..."
                    className="text-xs font-sans resize-y"
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="mt-2 flex items-center justify-between sm:justify-between w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={slides.length === 0}
            onClick={handleAddToQueue}
            className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white"
          >
            <CheckCircle2Icon className="size-3.5" />
            Add {slides.length} Slide{slides.length === 1 ? "" : "s"} to Presentation Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react"
import { Subject, BehaviorSubject } from "rxjs"
import { createSearchStream, type SemanticSearchResult } from "@openbeam/streams"
import { Button } from "@/components/ui/button"
import { getAutocompleteSuggestion, getTabNavigationResult } from "@/lib/quick-search"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  BookOpenIcon,
  SparklesIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  Languages,
  TvIcon,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { bibleActions } from "@/hooks/use-bible"
import { useBibleStore, useQueueStore } from "@/stores"
import { useBackendStore } from "@/stores/backend-store"
import type { Book, Verse } from "@/types"
import { Input } from "@/components/ui/input"
import { searchContextWithFuse, prefetchFuseIndex } from "@/lib/context-search"
import { api } from "@/services"
import { resolveBook } from "@/lib/bible-books"

type SearchTab = "book" | "context"

/** Highlights words from the query that appear in the text (like Logos AI). */
const HighlightedText = memo(function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>

  const queryWords = new Set(
    query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2)
  )
  if (queryWords.size === 0) return <>{text}</>

  const parts = text.split(/(\s+)/)
  return (
    <>
      {parts.map((part, i) => {
        const cleaned = part.toLowerCase().replace(/[^a-z']/g, "")
        if (cleaned.length >= 2 && queryWords.has(cleaned)) {
          return (
            <mark key={i} className="rounded-[2px] bg-primary/80 px-0.5 text-foreground">
              {part}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
})

const VerseRow = memo(function VerseRow({
  verse,
  secondaryVerse,
  primaryAbbr,
  secondaryAbbr,
  isDual,
  isSelected,
  onClick,
}: {
  verse: Verse
  secondaryVerse?: Verse | null
  primaryAbbr?: string
  secondaryAbbr?: string
  isDual: boolean
  isSelected: boolean
  onClick: (verse: Verse) => void
}) {
  return (
    <div
      id={`verse-${verse.id}`}
      onClick={() => onClick(verse)}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-all",
        isSelected
          ? "border-2 border-primary bg-primary/15 shadow-sm ring-1 ring-primary/40"
          : "hover:bg-muted/50 border border-transparent"
      )}
    >
      <span className={cn(
        "w-7 shrink-0 text-right text-sm font-bold pt-0.5",
        isSelected ? "text-primary font-black scale-110" : "text-muted-foreground font-semibold"
      )}>
        {verse.verse}
      </span>
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-start gap-2">
          {isDual && primaryAbbr && (
            <span className={cn(
              "shrink-0 rounded px-1 py-0.5 text-[0.625rem] font-bold tracking-wide",
              isSelected ? "bg-primary text-primary-foreground font-extrabold" : "bg-primary/15 text-primary"
            )}>
              {primaryAbbr}
            </span>
          )}
          <p className={cn(
            "flex-1 text-sm leading-relaxed",
            isSelected ? "text-foreground font-bold" : "text-foreground/90 font-medium"
          )}>
            {verse.text}
          </p>
        </div>
        {isDual && secondaryVerse?.text && (
          <div className="flex items-start gap-2 pt-1 border-t border-border/40">
            {secondaryAbbr && (
              <span className={cn(
                "shrink-0 rounded px-1 py-0.5 text-[0.625rem] font-bold tracking-wide",
                isSelected ? "bg-amber-500 text-white font-extrabold" : "bg-amber-500/15 text-amber-500 dark:text-amber-400"
              )}>
                {secondaryAbbr}
              </span>
            )}
            <p className={cn(
              "flex-1 text-sm leading-relaxed",
              isSelected ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-muted-foreground font-normal"
            )}>
              {secondaryVerse.text}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
        {isSelected && (
          <span className="inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-primary-foreground shadow-xs">
            <CheckIcon className="size-3 stroke-[3]" />
            <span>Live</span>
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn(
                "shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                isSelected
                  ? "hover:bg-primary/20 hover:text-primary"
                  : "bg-primary/40! text-primary-foreground hover:bg-primary!"
              )}
              onClick={(e) => {
                e.stopPropagation()
                useQueueStore.getState().addItem({
                  id: crypto.randomUUID(),
                  verse,
                  secondaryVerse: secondaryVerse ?? undefined,
                  reference: `${verse.book_name} ${verse.chapter}:${verse.verse}`,
                  confidence: 1,
                  source: "manual",
                  added_at: Date.now(),
                })
              }}
            >
              <PlusIcon className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Add to queue</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
})

export function SearchPanel() {
  const [activeTab, setActiveTab] = useState<SearchTab>("book")
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [chapter, setChapter] = useState(1)
  const [selectedVerseId, setSelectedVerseId] = useState<number | null>(null)
  const [_chapterInput, setChapterInput] = useState("")
  const [contextQuery, setContextQuery] = useState("")

  // EasyWorship-style autocomplete
  const [quickInput, setQuickInput] = useState("")
  const [showQuickVerses, setShowQuickVerses] = useState(false)
  const [quickVersesList, setQuickVersesList] = useState<Verse[]>([])
  const [quickSecondaryVersesList, setQuickSecondaryVersesList] = useState<Verse[]>([])

  const quickInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const chapterLoadRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const focusAfterNavRef = useRef<boolean | undefined>(undefined)

  // Subscribe to individual slices to avoid re-rendering the entire panel on unrelated changes
  const translations = useBibleStore((s) => s.translations)
  const books = useBibleStore((s) => s.books)
  const currentChapter = useBibleStore((s) => s.currentChapter)
  const secondaryChapter = useBibleStore((s) => s.secondaryChapter)
  const semanticResults = useBibleStore((s) => s.semanticResults)
  const semanticAvailable = useBackendStore((s) => s.capabilities?.detection.semantic ?? true)
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)
  const secondaryTranslationId = useBibleStore((s) => s.secondaryTranslationId)
  const isDualMode = useBibleStore((s) => s.isDualMode)
  const selectedVerse = useBibleStore((s) => s.selectedVerse)

  const primaryAbbr = translations.find((t) => t.id === activeTranslationId)?.abbreviation ?? "NIV"
  const secondaryAbbr = translations.find((t) => t.id === secondaryTranslationId)?.abbreviation ?? "TEL"

  const quickSuggestion = useMemo(
    () => getAutocompleteSuggestion(quickInput, books).suggestion,
    [quickInput, books]
  )

  const quickInputStyle = useMemo(
    () => quickSuggestion && quickSuggestion !== quickInput ? { caretColor: 'var(--foreground)' } : undefined,
    [quickSuggestion, quickInput]
  )

  const selectedBookNumber = selectedBook?.book_number

  // Load initial data
  useEffect(() => {
    bibleActions.loadTranslations().catch(console.error)
    bibleActions.loadBooks().catch(console.error)
  }, [])

  // Auto-select Genesis (or first book) on load if no book is selected
  useEffect(() => {
    if (books.length > 0 && !selectedBook) {
      const firstBook = books[0]
      setSelectedBook(firstBook)
      setChapter(1)
    }
  }, [books, selectedBook])

  // Sync selectedBook when active translation changes
  useEffect(() => {
    if (selectedBook && books.length > 0) {
      const match = books.find((b) => b.book_number === selectedBook.book_number)
      if (match && match.id !== selectedBook.id) {
        setSelectedBook(match)
      }
    }
  }, [books, selectedBook])

  // When selectedVerse changes from any source (queue click, remote, detection),
  // automatically synchronize Book Search to that book, chapter, and active verse
  useEffect(() => {
    if (!selectedVerse) return
    const bNum = Number(selectedVerse.book_number)
    const chNum = Number(selectedVerse.chapter)
    const vNum = Number(selectedVerse.verse)
    if (!bNum || !chNum || books.length === 0) return

    const targetBook = books.find((b) => Number(b.book_number) === bNum)
    if (targetBook) {
      if (!selectedBook || selectedBook.book_number !== bNum || chapter !== chNum) {
        setSelectedBook(targetBook)
        setChapter(chNum)
        setActiveTab("book")
      }
      setQuickInput(`${targetBook.name} ${chNum}:${vNum}`)
    }
  }, [selectedVerse, books, selectedBook, chapter])

  // Load chapter when book + chapter are set
  useEffect(() => {
    if (selectedBookNumber && chapter >= 1) {
      bibleActions.loadChapter(selectedBookNumber, chapter).catch(console.error)
    }
  }, [selectedBookNumber, chapter, activeTranslationId, secondaryTranslationId, isDualMode])

  // Selected verse ID: prioritizes selectedVerse from the store so external verse changes (queue, shortcuts) immediately update the highlighted verse
  const effectiveSelectedVerseId = useMemo(() => {
    if (selectedVerse && currentChapter.length > 0) {
      const match = currentChapter.find(
        (v) =>
          Number(v.verse) === Number(selectedVerse.verse) &&
          Number(v.chapter) === Number(selectedVerse.chapter) &&
          (Number(v.book_number) === Number(selectedVerse.book_number) || !selectedVerse.book_number)
      )
      if (match) return match.id
    }
    if (selectedVerseId && currentChapter.some((v) => v.id === selectedVerseId)) {
      return selectedVerseId
    }
    return null
  }, [currentChapter, selectedVerseId, selectedVerse])

  // Currently active verse number for header and display
  const activeVerseNumber = useMemo(() => {
    if (
      selectedVerse &&
      Number(selectedVerse.book_number) === Number(selectedBookNumber) &&
      Number(selectedVerse.chapter) === Number(chapter)
    ) {
      return Number(selectedVerse.verse)
    }
    if (effectiveSelectedVerseId && currentChapter.length > 0) {
      const match = currentChapter.find((v) => v.id === effectiveSelectedVerseId)
      return match ? Number(match.verse) : null
    }
    return null
  }, [selectedVerse, selectedBookNumber, chapter, effectiveSelectedVerseId, currentChapter])

  const teluguBookName = useMemo(() => {
    if (!selectedBookNumber) return ""
    const b = resolveBook(selectedBookNumber)
    return b ? b.teluguName : ""
  }, [selectedBookNumber])

  // Sync selectedVerseId when selectedVerse changes
  useEffect(() => {
    if (selectedVerse && currentChapter.length > 0) {
      const match = currentChapter.find(
        (v) =>
          Number(v.verse) === Number(selectedVerse.verse) &&
          Number(v.chapter) === Number(selectedVerse.chapter) &&
          (Number(v.book_number) === Number(selectedVerse.book_number) || !selectedVerse.book_number)
      )
      if (match && match.id !== selectedVerseId) {
        setSelectedVerseId(match.id)
      }
    }
  }, [selectedVerse, currentChapter, selectedVerseId])

  // Scroll active verse into view
  useEffect(() => {
    if (effectiveSelectedVerseId) {
      const scrollNow = () => {
        const el = document.getElementById(`verse-${effectiveSelectedVerseId}`)
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" })
          return true
        }
        return false
      }

      if (!scrollNow()) {
        const t1 = setTimeout(scrollNow, 60)
        const t2 = setTimeout(scrollNow, 200)
        return () => {
          clearTimeout(t1)
          clearTimeout(t2)
        }
      }
    }
  }, [effectiveSelectedVerseId, currentChapter])

  const applyNavigationSelection = useCallback(
    (book: Book, navChapter: number) => {
      setActiveTab("book")
      setSelectedBook(book)
      setChapter(navChapter)
      setChapterInput("")
    },
    []
  )

  useEffect(() => {
    let lastHandledKey: string | null = null

    const unsubscribe = useBibleStore.subscribe((state) => {
      const pendingNavigation = state.pendingNavigation
      if (!pendingNavigation) {
        lastHandledKey = null
        return
      }

      const { bookNumber, chapter: navChapter, verse: navVerse } = pendingNavigation
      const bNum = Number(bookNumber)
      const chNum = Number(navChapter)
      const vNum = Number(navVerse)
      const pendingKey = `${bNum}:${chNum}:${vNum}`
      if (pendingKey === lastHandledKey) return

      let book = state.books.find((b) => Number(b.book_number) === bNum)
      if (!book) {
        const std = resolveBook(bNum)
        if (std) {
          book = {
            id: std.num,
            translation_id: state.activeTranslationId,
            book_number: std.num,
            name: std.name,
            abbreviation: std.abbr,
            testament: std.testament,
          }
        }
      }
      if (!book) return

      lastHandledKey = pendingKey
      applyNavigationSelection(book, chNum)
      setQuickInput(`${book.name} ${chNum}:${vNum}`)

      bibleActions.loadChapter(bNum, chNum).then((verses) => {
        const target = verses.find((v) => Number(v.verse) === vNum)
        if (target) {
          setSelectedVerseId(target.id)
          const sec = useBibleStore.getState().secondaryChapter.find((v) => Number(v.verse) === vNum)
          const enhanced = sec ? { ...target, secondaryVerse: sec } : target
          bibleActions.selectVerse(enhanced)
          setTimeout(() => {
            document
              .getElementById(`verse-${target.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          }, 60)
        }
        if (focusAfterNavRef.current === true) {
          panelRef.current?.focus()
        }
        focusAfterNavRef.current = undefined
      }).catch(console.error).finally(() => {
        useBibleStore.getState().setPendingNavigation(null)
      })
    })

    return unsubscribe
  }, [applyNavigationSelection])

  const handleVerseClick = useCallback((verse: Verse) => {
    setSelectedVerseId(verse.id)
    bibleActions.selectVerse(verse)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        if (chapter > 1) {
          setChapter((c) => c - 1)
          setChapterInput("")
          setSelectedVerseId(null)
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setChapter((c) => c + 1)
        setChapterInput("")
        setSelectedVerseId(null)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        if (currentChapter.length === 0) return
        const currentIdx = effectiveSelectedVerseId
          ? currentChapter.findIndex((v) => v.id === effectiveSelectedVerseId)
          : -1
        const nextIdx = Math.min(currentIdx + 1, currentChapter.length - 1)
        const next = currentChapter[nextIdx]
        if (next) {
          setSelectedVerseId(next.id)
          bibleActions.selectVerse(next)
          document
            .getElementById(`verse-${next.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        if (currentChapter.length === 0) return
        const currentIdx = effectiveSelectedVerseId
          ? currentChapter.findIndex((v) => v.id === effectiveSelectedVerseId)
          : currentChapter.length
        const prevIdx = Math.max(currentIdx - 1, 0)
        const prev = currentChapter[prevIdx]
        if (prev) {
          setSelectedVerseId(prev.id)
          bibleActions.selectVerse(prev)
          document
            .getElementById(`verse-${prev.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        }
      }
    },
    [chapter, currentChapter, effectiveSelectedVerseId]
  )

  // RxJS search stream — replaces manual debounce + requestId + fallback chain
  const [contextQuery$] = useState(() => new Subject<string>())
  const [translationId$] = useState(() => new BehaviorSubject(activeTranslationId))

  useEffect(() => {
    translationId$.next(activeTranslationId)
    prefetchFuseIndex(activeTranslationId)
  }, [activeTranslationId, translationId$])

  useEffect(() => {
    const stream = createSearchStream({
      query$: contextQuery$,
      translationId$,
      fuseSearch: searchContextWithFuse,
      ftsSearch: (q, tid, limit) =>
        api.searchVerses(q, tid, limit).then((verses) =>
          verses.slice(0, 15).map((v, idx): SemanticSearchResult => ({
            verse_ref: `${v.book_name} ${v.chapter}:${v.verse}`,
            verse_text: v.text,
            book_name: v.book_name,
            book_number: v.book_number,
            chapter: v.chapter,
            verse: v.verse,
            similarity: Math.max(0.5, 0.72 - idx * 0.015),
          })),
        ),
    })

    const sub = stream.results$.subscribe(async (results) => {
      const { isDualMode: dual, secondaryTranslationId: secId } = useBibleStore.getState()
      if (dual && secId && results.length > 0) {
        const enhanced = await Promise.all(
          results.map(async (r) => {
            try {
              const sec = await api.getVerse(secId, r.book_number, r.chapter, r.verse)
              if (sec?.text) {
                return {
                  ...r,
                  secondary_text: sec.text,
                  secondary_book_name: sec.book_name,
                }
              }
            } catch {
              // ignore
            }
            return r
          })
        )
        useBibleStore.getState().setSemanticResults(enhanced)
      } else {
        useBibleStore.getState().setSemanticResults(results)
      }
    })

    return () => sub.unsubscribe()
  }, [contextQuery$, translationId$])

  const handleContextSearch = useCallback((query: string) => {
    setContextQuery(query)
    contextQuery$.next(query)
  }, [contextQuery$])

  // EasyWorship-style autocomplete logic
  useEffect(() => {
    const result = getAutocompleteSuggestion(quickInput, books)

    if (result.matchedBook && result.chapter && result.verse) {
      // This is a mid-typing preview — don't focus after navigation
      focusAfterNavRef.current = false
      useBibleStore.getState().setPendingNavigation({
        bookNumber: result.matchedBook.book_number,
        chapter: result.chapter,
        verse: result.verse
      })
    }

    // Debounce chapter loading to avoid firing on every keystroke
    if (chapterLoadRef.current) clearTimeout(chapterLoadRef.current)

    if ((result.stage === "chapter" || result.stage === "verse") && result.matchedBook && result.chapter) {
      const bookNumber = result.matchedBook.book_number
      const ch = result.chapter
      chapterLoadRef.current = setTimeout(() => {
        const secId = useBibleStore.getState().secondaryTranslationId
        const isDual = useBibleStore.getState().isDualMode

        Promise.all([
          bibleActions.loadChapter(bookNumber, ch),
          isDual && secId ? api.getChapter(secId, bookNumber, ch).catch(() => [] as Verse[]) : Promise.resolve([] as Verse[])
        ]).then(([verses, secVerses]) => {
          setQuickVersesList(verses)
          setQuickSecondaryVersesList(secVerses)
          setShowQuickVerses(true)
        }).catch(console.error)
      }, 300)
    } else {
      queueMicrotask(() => setShowQuickVerses(false))
    }
  }, [quickInput, books, activeTranslationId, secondaryTranslationId, isDualMode])

  const handleQuickKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Tab" || e.key === "ArrowRight") && quickSuggestion && quickSuggestion !== quickInput) {
      e.preventDefault()
      const nextInput = getTabNavigationResult(quickInput, quickSuggestion)
      setQuickInput(nextInput)
      return
    }

    if (e.key === "Enter") {
      e.preventDefault()
      focusAfterNavRef.current = true
      const result = getAutocompleteSuggestion(quickInput, books)
      if (result.matchedBook) {
        const ch = result.chapter || 1
        const v = result.verse || 1
        useBibleStore.getState().setPendingNavigation({
          bookNumber: result.matchedBook.book_number,
          chapter: ch,
          verse: v,
        })
        setQuickInput(`${result.matchedBook.name} ${ch}:${v}`)
      } else {
        setQuickInput("")
      }
      setShowQuickVerses(false)
      return
    }

    if (e.key === "Escape") {
      e.preventDefault()
      setQuickInput("")
      setShowQuickVerses(false)
      return
    }
  }, [quickInput, quickSuggestion, books])

  const handleQuickVerseClick = useCallback((verse: Verse) => {
    focusAfterNavRef.current = true
    useBibleStore.getState().setPendingNavigation({
      bookNumber: verse.book_number,
      chapter: verse.chapter,
      verse: verse.verse
    })
    setQuickInput(`${verse.book_name} ${verse.chapter}:${verse.verse}`)
    setShowQuickVerses(false)
  }, [])

  const handleTranslationChange = useCallback(async (v: string) => {
    const id = Number(v)
    useBibleStore.getState().setActiveTranslation(id)
  }, [])

  return (
    <div
      ref={panelRef}
      data-slot="search-panel"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card"
      onKeyDown={activeTab === "book" ? handleKeyDown : undefined}
      tabIndex={-1}
    >
      {/* STICKY: Tab row + search input + translation selectors */}
      <div className="flex shrink-0 items-center justify-between border-b border-border min-h-11 px-2 gap-2">
        <div className="flex items-center gap-1 py-1.5 shrink-0">
          <button
            data-tour="book-search"
            onClick={() => setActiveTab("book")}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              activeTab === "book"
                ? "border-primary/50 bg-primary/15"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpenIcon className={cn("size-3.5", activeTab === "book" ? "text-primary" : "text-muted-foreground")} />
            Book search
          </button>
          <button
            data-tour="context-search"
            onClick={() => {
              setActiveTab("context")
              setContextQuery("")
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              activeTab === "context"
                ? "border-primary/50 bg-primary/15"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <SparklesIcon className={cn("size-3.5", activeTab === "context" ? "text-primary" : "text-muted-foreground")} />
            Context search
          </button>
        </div>

        {activeTab === "book" ? (
          <div className="flex flex-1 items-center gap-2 min-w-0">
            {/* Direct Book Selector Dropdown */}
            {books.length > 0 && (
              <Select
                value={selectedBook ? String(selectedBook.book_number) : ""}
                onValueChange={(val) => {
                  const b = books.find((x) => String(x.book_number) === val)
                  if (b) {
                    applyNavigationSelection(b, 1)
                    setSelectedVerseId(null)
                    bibleActions.loadChapter(b.book_number, 1).catch(console.error)
                  }
                }}
              >
                <SelectTrigger size="sm" className="h-7 w-[120px] shrink-0 text-xs font-semibold bg-background">
                  <SelectValue placeholder="Select Book" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Old Testament
                  </div>
                  {books.filter((b) => b.book_number <= 39).map((b) => (
                    <SelectItem key={b.id} value={String(b.book_number)} className="text-xs">
                      {b.name}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t border-border/50 mt-1 pt-1.5">
                    New Testament
                  </div>
                  {books.filter((b) => b.book_number >= 40).map((b) => (
                    <SelectItem key={b.id} value={String(b.book_number)} className="text-xs">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative flex-1 min-w-[120px]">
              {quickSuggestion && quickSuggestion !== quickInput && (
                <div className="absolute inset-0 flex items-center px-3 pointer-events-none z-10">
                  <span className="text-xs font-normal">
                    <span className="text-foreground">{quickInput}</span>
                    <span className="text-muted-foreground">{quickSuggestion.slice(quickInput.length)}</span>
                  </span>
                </div>
              )}

              <Input
                ref={quickInputRef}
                data-tour="quick-nav"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={handleQuickKeyDown}
                placeholder="Type: 1 John 3:16, 1 Pet, or J 3:16"
                className={cn(
                  "h-7 text-xs relative bg-background",
                  quickSuggestion && quickSuggestion !== quickInput ? "text-transparent" : ""
                )}
                style={quickInputStyle}
              />

              {showQuickVerses && quickVersesList.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                  <div className="p-1">
                    {quickVersesList.map((verse) => {
                      const sec = isDualMode ? quickSecondaryVersesList.find(v => v.verse === verse.verse) : null
                      return (
                        <button
                          key={verse.id}
                          onClick={() => handleQuickVerseClick(verse)}
                          className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                        >
                          <span className="shrink-0 font-semibold text-primary w-6 text-right pt-0.5">
                            {verse.verse}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="line-clamp-1 text-foreground font-medium">
                              {isDualMode && <span className="text-[10px] font-bold text-primary mr-1">[{primaryAbbr}]</span>}
                              {verse.text}
                            </p>
                            {sec?.text && (
                              <p className="line-clamp-1 text-muted-foreground text-[11px] mt-0.5">
                                <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 mr-1">[{secondaryAbbr}]</span>
                                {sec.text}
                              </p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bilingual Mode Toggle */}
            <button
              onClick={() => useBibleStore.getState().setIsDualMode(!isDualMode)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold shrink-0 transition-all",
                isDualMode
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-sm"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
              title="Toggle Bilingual Dual-Language View (e.g. NIV + Telugu)"
            >
              <Languages className="size-3.5" />
              <span className="hidden sm:inline">Bilingual</span>
            </button>

            {/* Primary Translation */}
            <Select
              value={String(activeTranslationId)}
              onValueChange={handleTranslationChange}
            >
              <SelectTrigger size="sm" className="h-7 w-[74px] shrink-0 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {translations.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.abbreviation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Secondary Translation (when Dual Mode is active) */}
            {isDualMode && (
              <Select
                value={String(secondaryTranslationId || "")}
                onValueChange={(v) => useBibleStore.getState().setSecondaryTranslationId(Number(v))}
              >
                <SelectTrigger size="sm" className="h-7 w-[74px] shrink-0 text-xs font-medium border-amber-500/40 text-amber-600 dark:text-amber-400">
                  <SelectValue placeholder="2nd" />
                </SelectTrigger>
                <SelectContent>
                  {translations.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.abbreviation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <Input
              placeholder="Search in English (e.g. love, light, everlasting life)..."
              value={contextQuery}
              onChange={(e) => handleContextSearch(e.target.value)}
              className="h-7 flex-1 text-xs"
            />

            {/* Bilingual Mode Toggle */}
            <button
              onClick={() => useBibleStore.getState().setIsDualMode(!isDualMode)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold shrink-0 transition-all",
                isDualMode
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-sm"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
              title="Toggle Bilingual Dual-Language Results"
            >
              <Languages className="size-3.5" />
              <span className="hidden sm:inline">Bilingual</span>
            </button>

            {/* Primary Translation */}
            <Select
              value={String(activeTranslationId)}
              onValueChange={handleTranslationChange}
            >
              <SelectTrigger size="sm" className="h-7 w-[74px] shrink-0 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {translations.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.abbreviation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Secondary Translation */}
            {isDualMode && (
              <Select
                value={String(secondaryTranslationId || "")}
                onValueChange={(v) => useBibleStore.getState().setSecondaryTranslationId(Number(v))}
              >
                <SelectTrigger size="sm" className="h-7 w-[74px] shrink-0 text-xs font-medium border-amber-500/40 text-amber-600 dark:text-amber-400">
                  <SelectValue placeholder="2nd" />
                </SelectTrigger>
                <SelectContent>
                  {translations.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.abbreviation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {activeTab === "book" && (
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2 min-h-9">
            {selectedBook ? (
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                  <span className="text-primary font-extrabold">
                    {selectedBook.name} {chapter}{activeVerseNumber ? `:${activeVerseNumber}` : ""}
                  </span>
                  {isDualMode && teluguBookName && (
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      • {teluguBookName} {chapter}{activeVerseNumber ? `:${activeVerseNumber}` : ""}
                    </span>
                  )}
                </h3>
                {isDualMode && (
                  <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5">
                    {primaryAbbr} + {secondaryAbbr}
                  </span>
                )}
                {selectedVerse &&
                  selectedVerse.book_number > 0 &&
                  (selectedVerse.book_number !== selectedBookNumber || selectedVerse.chapter !== chapter) && (
                    <button
                      onClick={() =>
                        bibleActions.navigateToVerse(
                          selectedVerse.book_number,
                          selectedVerse.chapter,
                          selectedVerse.verse
                        )
                      }
                      className="flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
                      title="Show the chapter currently on screen"
                    >
                      <TvIcon className="size-2.5" />
                      <span>
                        On screen: {selectedVerse.book_name} {selectedVerse.chapter}:{selectedVerse.verse}
                      </span>
                    </button>
                  )}
              </div>
            ) : null}
            {selectedBook ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    if (chapter > 1) {
                      setChapter((c) => c - 1)
                      setChapterInput("")
                      setSelectedVerseId(null)
                    }
                  }}
                  disabled={chapter <= 1}
                >
                  <ArrowLeftIcon className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setChapter((c) => c + 1)
                    setChapterInput("")
                    setSelectedVerseId(null)
                  }}
                >
                  <ArrowRightIcon className="size-3" />
                </Button>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-0 p-2">
              <TooltipProvider>
                {currentChapter.map((verse) => {
                  const secVerse = isDualMode
                    ? secondaryChapter.find((v) => v.verse === verse.verse)
                    : null
                  return (
                    <VerseRow
                      key={verse.id}
                      verse={verse}
                      secondaryVerse={secVerse}
                      primaryAbbr={primaryAbbr}
                      secondaryAbbr={secondaryAbbr}
                      isDual={isDualMode}
                      isSelected={verse.id === effectiveSelectedVerseId}
                      onClick={handleVerseClick}
                    />
                  )
                })}
              </TooltipProvider>
            </div>
          </div>
        </>
      )}

      {activeTab === "context" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1 p-2">
            {!semanticAvailable && (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Context search is available via full-text keyword search. Type any English words (e.g. "love", "light", "shepherd").
              </p>
            )}
            {contextQuery.length < 2 && (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Search verse text in English — type keywords to view matches in both English and Telugu...
              </p>
            )}
            {contextQuery.length >= 2 && semanticResults.length === 0 && (
              <p className="p-4 text-center text-xs text-muted-foreground">
                No results found for "{contextQuery}"
              </p>
            )}
            <TooltipProvider>
              {semanticResults.map((result) => (
                <div
                  key={`${result.book_number}-${result.chapter}-${result.verse}`}
                  onClick={() => {
                    const sec = result.secondary_text
                      ? {
                          id: 0,
                          translation_id: secondaryTranslationId ?? 6,
                          book_number: result.book_number,
                          book_name: result.secondary_book_name || result.book_name,
                          book_abbreviation: "",
                          chapter: result.chapter,
                          verse: result.verse,
                          text: result.secondary_text,
                        }
                      : null

                    bibleActions.selectVerse({
                      id: 0,
                      translation_id: activeTranslationId,
                      book_number: result.book_number,
                      book_name: result.book_name,
                      book_abbreviation: "",
                      chapter: result.chapter,
                      verse: result.verse,
                      text: result.verse_text,
                      ...(sec ? { secondaryVerse: sec } : {}),
                    } as any)

                    // Also display this chapter in the Book Search panel
                    bibleActions.navigateToVerse(
                      result.book_number,
                      result.chapter,
                      result.verse
                    )
                  }}
                  className="group flex flex-col cursor-pointer gap-1.5 rounded-lg p-3 transition-colors hover:bg-muted/50 border border-transparent hover:border-border/50 relative"
                >
                  <div className="flex shrink-0 flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {result.book_name} {result.chapter}:{result.verse}
                      </span>
                      {isDualMode && (
                        <span className="rounded bg-primary/15 px-1 py-0.2 text-[0.625rem] font-bold text-primary">
                          {primaryAbbr}
                        </span>
                      )}
                    </div>
                    <span className="text-[0.625rem] font-medium text-muted-foreground">
                      {Math.round(result.similarity * 100)}% match
                    </span>
                  </div>
                  
                  {/* English (NIV) Text with Highlight */}
                  <p className="flex-1 text-xs leading-relaxed text-foreground/90 font-medium">
                    <HighlightedText text={result.verse_text} query={contextQuery} />
                  </p>

                  {/* Telugu Translation Text */}
                  {isDualMode && result.secondary_text && (
                    <div className="pt-1 mt-0.5 border-t border-border/40 flex items-start gap-1.5">
                      <span className="shrink-0 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 py-0.2 text-[0.625rem] font-bold">
                        {secondaryAbbr}
                      </span>
                      <p className="flex-1 text-xs leading-relaxed text-muted-foreground font-normal">
                        {result.secondary_text}
                      </p>
                    </div>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="absolute right-2 top-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground hover:bg-primary/80"
                        onClick={(e) => {
                          e.stopPropagation()
                          const sec = result.secondary_text
                            ? {
                                id: 0,
                                translation_id: secondaryTranslationId ?? 6,
                                book_number: result.book_number,
                                book_name: result.secondary_book_name || result.book_name,
                                book_abbreviation: "",
                                chapter: result.chapter,
                                verse: result.verse,
                                text: result.secondary_text,
                              }
                            : undefined

                          useQueueStore.getState().addItem({
                            id: crypto.randomUUID(),
                            verse: {
                              id: 0,
                              translation_id: activeTranslationId,
                              book_number: result.book_number,
                              book_name: result.book_name,
                              book_abbreviation: "",
                              chapter: result.chapter,
                              verse: result.verse,
                              text: result.verse_text,
                            },
                            secondaryVerse: sec,
                            reference: `${result.book_name} ${result.chapter}:${result.verse}`,
                            confidence: result.similarity,
                            source: "manual",
                            added_at: Date.now(),
                          })
                        }}
                      >
                        <PlusIcon className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Add to queue</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </TooltipProvider>
          </div>
        </div>
      )}
    </div>
  )
}

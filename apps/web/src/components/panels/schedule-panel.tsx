import { useState, useEffect, useCallback, useRef } from "react"
import {
  CalendarClockIcon,
  PlayIcon,
  PauseIcon,
  SquareIcon,
  PlusIcon,
  Trash2Icon,
  GripVerticalIcon,
  ClockIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
  DownloadIcon,
  UploadIcon,
  ChevronRightIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  useScheduleStore,
  formatElapsed,
  getSermonElapsedMs,
  parseTimeInput,
} from "@/stores/schedule-store"
import { useBibleStore } from "@/stores/bible-store"
import { presentCue } from "@/hooks/use-schedule"
import type { ScheduledCue } from "@openbeam/streams"
import { api } from "@/services"

// ─── Cue status helpers ────────────────────────────────────────────────────────

type CueStatus = "past" | "active" | "next" | "upcoming" | "manual"

function getCueStatus(
  cue: ScheduledCue,
  activeCueId: string | null,
  firedCueIds: Set<string>
): CueStatus {
  if (cue.id === activeCueId) return "active"
  if (cue.offsetSeconds === 0) return "manual"
  if (firedCueIds.has(cue.id)) return "past"
  // Is this the next cue?
  const state = useScheduleStore.getState()
  const upcoming = state.cues
    .filter((c) => c.offsetSeconds > 0 && !firedCueIds.has(c.id) && c.id !== activeCueId)
    .sort((a, b) => a.offsetSeconds - b.offsetSeconds)
  if (upcoming[0]?.id === cue.id) return "next"
  return "upcoming"
}

function statusIcon(status: CueStatus) {
  switch (status) {
    case "past":    return <CheckCircle2Icon className="size-3.5 text-muted-foreground/40" />
    case "active":  return <CircleDotIcon    className="size-3.5 text-emerald-400 animate-pulse" />
    case "next":    return <ChevronRightIcon className="size-3.5 text-primary" />
    case "manual":  return <ClockIcon        className="size-3.5 text-amber-400" />
    default:        return <CircleIcon       className="size-3.5 text-muted-foreground/30" />
  }
}

// ─── Format offset ─────────────────────────────────────────────────────────────

function fmtOffset(secs: number): string {
  if (secs === 0) return "Manual"
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// ─── Countdown to next cue ─────────────────────────────────────────────────────

function countdownTo(offsetSecs: number, elapsedSecs: number): string {
  const remaining = offsetSecs - elapsedSecs
  if (remaining <= 0) return "Now"
  return `-${formatElapsed(remaining * 1000)}`
}

// ─── Individual cue row ────────────────────────────────────────────────────────

function CueRow({
  cue,
  index,
  status,
  elapsedSecs,
  onRemove,
  onUpdate: _onUpdate,
}: {
  cue: ScheduledCue
  index: number
  status: CueStatus
  elapsedSecs: number
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<ScheduledCue>) => void
}) {
  const handlePresent = useCallback(() => {
    presentCue(cue)
  }, [cue])

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-all",
        status === "active" &&
          "border-emerald-500/40 bg-emerald-500/10 shadow-[inset_0_1px_0_0_rgba(52,211,153,0.1)]",
        status === "next" &&
          "border-primary/40 bg-primary/5",
        status === "past" &&
          "border-border/50 opacity-50",
        status === "manual" &&
          "border-amber-500/30 bg-amber-500/5",
        status === "upcoming" &&
          "border-border bg-card hover:border-border/80 hover:bg-muted/30"
      )}
    >
      {/* Drag handle */}
      <GripVerticalIcon className="size-3.5 shrink-0 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />

      {/* Status icon */}
      <div className="shrink-0">{statusIcon(status)}</div>

      {/* Index */}
      <span className="w-4 shrink-0 text-[10px] font-bold text-muted-foreground/50 text-center">
        {index + 1}
      </span>

      {/* Reference + Label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground truncate">{cue.reference}</span>
          {cue.label && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
              — {cue.label}
            </span>
          )}
        </div>
        {cue.verseText && (
          <p className="text-[11px] text-muted-foreground/70 line-clamp-1 mt-0.5">
            {cue.verseText}
          </p>
        )}
      </div>

      {/* Time / countdown */}
      <div className="shrink-0 text-right">
        <div className="text-xs font-mono font-medium text-muted-foreground">
          {fmtOffset(cue.offsetSeconds)}
        </div>
        {status === "next" && elapsedSecs > 0 && cue.offsetSeconds > 0 && (
          <div className="text-[10px] font-mono text-primary animate-pulse">
            {countdownTo(cue.offsetSeconds, elapsedSecs)}
          </div>
        )}
        {cue.displayDuration > 0 && (
          <div className="text-[9px] text-muted-foreground/40 font-mono">
            {cue.displayDuration}s
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon-xs"
          title="Present now"
          onClick={handlePresent}
          className="text-primary hover:bg-primary/10"
        >
          <PlayIcon className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          title="Remove cue"
          onClick={() => onRemove(cue.id)}
          className="text-destructive hover:bg-destructive/10"
        >
          <Trash2Icon className="size-3" />
        </Button>
      </div>
    </div>
  )
}

// ─── Add Cue Form ──────────────────────────────────────────────────────────────

function AddCueForm({ onAdd }: { onAdd: (cue: ScheduledCue) => void }) {
  const [ref, setRef] = useState("")
  const [timeInput, setTimeInput] = useState("")
  const [label, setLabel] = useState("")
  const [duration, setDuration] = useState("10")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)
  const books = useBibleStore((s) => s.books)

  const handleAdd = useCallback(async () => {
    setError(null)
    const trimRef = ref.trim()
    if (!trimRef) { setError("Enter a verse reference"); return }

    // Parse reference — accept "Book Ch:V" or "Book Ch V"
    const match = trimRef.match(/^([\w\s]+?)\s+(\d+)[:\s](\d+)$/i)
    if (!match) {
      setError('Use format "John 3:16" or "Genesis 1 1"')
      return
    }
    const [, bookName, chStr, vStr] = match
    const ch = Number(chStr)
    const v = Number(vStr)

    // Find book in loaded books
    const book = books.find(
      (b) =>
        b.name.toLowerCase() === bookName.trim().toLowerCase() ||
        b.abbreviation.toLowerCase() === bookName.trim().toLowerCase()
    )
    if (!book) {
      setError(`Book "${bookName.trim()}" not found. Check spelling.`)
      return
    }

    // Parse time
    const rawTime = timeInput.trim()
    let offsetSeconds = 0
    if (rawTime) {
      const parsed = parseTimeInput(rawTime)
      if (parsed === null) {
        setError("Invalid time. Use MM:SS or HH:MM:SS")
        return
      }
      offsetSeconds = parsed
    }

    // Fetch verse text
    setLoading(true)
    let verseText: string | undefined
    try {
      const verse = await api.getVerse(activeTranslationId, book.book_number, ch, v)
      if (!verse) { setError("Verse not found in database"); setLoading(false); return }
      verseText = verse.text
    } catch {
      setError("Failed to fetch verse. Check the reference.")
      setLoading(false)
      return
    }
    setLoading(false)

    const displayDuration = Math.max(0, Number(duration) || 0)

    const cue: ScheduledCue = {
      id: crypto.randomUUID(),
      label: label.trim(),
      reference: `${book.name} ${ch}:${v}`,
      bookNumber: book.book_number,
      chapter: ch,
      verse: v,
      offsetSeconds,
      displayDuration,
      translationId: activeTranslationId,
      verseText,
    }

    onAdd(cue)
    setRef("")
    setTimeInput("")
    setLabel("")
    setDuration("10")
  }, [ref, timeInput, label, duration, books, activeTranslationId, onAdd])

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 flex flex-col gap-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Add cue
      </p>

      {/* Row 1: Reference */}
      <Input
        id="schedule-ref"
        placeholder="Verse reference (e.g. John 3:16)"
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        className="h-7 text-xs"
      />

      {/* Row 2: Time + Duration */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            id="schedule-time"
            placeholder="Cue time MM:SS (blank = manual)"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="h-7 text-xs font-mono"
          />
        </div>
        <div className="w-20">
          <Input
            id="schedule-duration"
            placeholder="Dur (s)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="h-7 text-xs font-mono"
            title="Display duration in seconds (0 = hold until manual clear)"
          />
        </div>
      </div>

      {/* Row 3: Label */}
      <Input
        id="schedule-label"
        placeholder='Label (optional) — e.g. "Opening text"'
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-7 text-xs"
      />

      {error && (
        <p className="text-[10px] text-destructive">{error}</p>
      )}

      <Button
        id="schedule-add-btn"
        size="sm"
        className="h-7 text-xs w-full"
        onClick={handleAdd}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
            Fetching…
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <PlusIcon className="size-3" /> Add cue
          </span>
        )}
      </Button>
    </div>
  )
}

// ─── Sermon timer bar ──────────────────────────────────────────────────────────

function SermonTimer() {
  const isRunning = useScheduleStore((s) => s.isRunning)
  const [display, setDisplay] = useState("00:00")

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplay(formatElapsed(getSermonElapsedMs()))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "size-2 rounded-full",
            isRunning
              ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)]"
              : "bg-muted-foreground/30"
          )}
        />
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
            Sermon elapsed
          </p>
          <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {display}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {!isRunning ? (
          <Button
            id="schedule-start-btn"
            size="sm"
            className="h-8 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
            onClick={() => useScheduleStore.getState().startSermon()}
          >
            <PlayIcon className="size-3" />
            {getSermonElapsedMs() > 0 ? "Resume" : "Start"}
          </Button>
        ) : (
          <Button
            id="schedule-pause-btn"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => useScheduleStore.getState().pauseSermon()}
          >
            <PauseIcon className="size-3" />
            Pause
          </Button>
        )}
        <Button
          id="schedule-reset-btn"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={() => useScheduleStore.getState().resetSermon()}
          title="Reset timer and clear all fired cues"
        >
          <SquareIcon className="size-3" />
          Reset
        </Button>
      </div>
    </div>
  )
}

// ─── Main Schedule Sheet ───────────────────────────────────────────────────────

export function ScheduleSheet() {
  const open = useScheduleStore((s) => s.scheduleOpen)
  const cues = useScheduleStore((s) => s.cues)
  const activeCueId = useScheduleStore((s) => s.activeCueId)
  const firedCueIds = useScheduleStore((s) => s.firedCueIds)
  const isRunning = useScheduleStore((s) => s.isRunning)

  const [elapsedSecs, setElapsedSecs] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Keep elapsed for cue status display
  useEffect(() => {
    const t = setInterval(() => {
      setElapsedSecs(getSermonElapsedMs() / 1000)
    }, 500)
    return () => clearInterval(t)
  }, [isRunning])

  const handleAdd = useCallback((cue: ScheduledCue) => {
    useScheduleStore.getState().addCue(cue)
  }, [])

  const handleExport = useCallback(() => {
    const data = JSON.stringify({ cues }, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "sermon-schedule.json"
    a.click()
    URL.revokeObjectURL(url)
  }, [cues])

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        const imported: ScheduledCue[] = json.cues ?? []
        // Replace current schedule
        useScheduleStore.setState({ cues: imported })
      } catch {
        // ignore parse errors
      }
    }
    reader.readAsText(file)
    // Reset input so same file can be re-imported
    e.target.value = ""
  }, [])

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => useScheduleStore.getState().setScheduleOpen(v)}
    >
      <SheetContent
        side="right"
        className="flex w-[420px] max-w-full flex-col gap-0 p-0 sm:w-[460px]"
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClockIcon className="size-4 text-primary" />
            Verse Scheduler
          </SheetTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              title="Import schedule from JSON"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="size-3.5" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              variant="ghost"
              size="icon-xs"
              title="Export schedule as JSON"
              onClick={handleExport}
              disabled={cues.length === 0}
            >
              <DownloadIcon className="size-3.5" />
            </Button>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {/* Sermon timer */}
          <SermonTimer />

          {/* Cue list */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Schedule · {cues.length} cues
              </p>
              {cues.length > 0 && (
                <button
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => useScheduleStore.getState().clearCues()}
                >
                  Clear all
                </button>
              )}
            </div>

            {cues.length === 0 && (
              <div className="py-8 text-center">
                <CalendarClockIcon className="size-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No cues yet.</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  Add a verse below to build your sermon plan.
                </p>
              </div>
            )}

            {cues.map((cue, index) => {
              const status = getCueStatus(cue, activeCueId, firedCueIds)
              return (
                <CueRow
                  key={cue.id}
                  cue={cue}
                  index={index}
                  status={status}
                  elapsedSecs={elapsedSecs}
                  onRemove={(id) => useScheduleStore.getState().removeCue(id)}
                  onUpdate={(id, patch) => useScheduleStore.getState().updateCue(id, patch)}
                />
              )
            })}
          </div>

          {/* Add cue form */}
          <AddCueForm onAdd={handleAdd} />

          {/* Legend */}
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 flex flex-col gap-1.5">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Legend</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                { icon: <CircleDotIcon className="size-3 text-emerald-400" />, label: "Active" },
                { icon: <ChevronRightIcon className="size-3 text-primary" />, label: "Next up" },
                { icon: <ClockIcon className="size-3 text-amber-400" />, label: "Manual" },
                { icon: <CheckCircle2Icon className="size-3 text-muted-foreground/40" />, label: "Past" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  {icon}
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground/60 mt-1">
              Cue time is offset from sermon start. Leave blank for manual-only cues.
              Display duration (s) auto-clears the verse; set 0 to hold until manually cleared.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Transport bar trigger button ──────────────────────────────────────────────

export function ScheduleButton() {
  const cues = useScheduleStore((s) => s.cues)
  const isRunning = useScheduleStore((s) => s.isRunning)

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      id="schedule-open-btn"
      title="Verse Scheduler"
      onClick={() => useScheduleStore.getState().setScheduleOpen(true)}
      className={cn(
        "relative",
        isRunning && "text-emerald-400"
      )}
    >
      <CalendarClockIcon className="size-3.5" />
      {cues.length > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
          {cues.length > 9 ? "9+" : cues.length}
        </span>
      )}
    </Button>
  )
}

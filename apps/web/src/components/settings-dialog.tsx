import { useState, useEffect, useCallback, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  TvIcon,
  KeyIcon,
  SettingsIcon,
  BookOpenIcon,
  RadioIcon,
  HelpCircleIcon,
  GraduationCapIcon,
  MusicIcon,
  CalendarIcon,
} from "lucide-react"
import { useSettingsStore, useSongStore } from "@/stores"
import { useTutorialStore } from "@/stores/tutorial-store"
import { api } from "@/services"
import { useSettingsDialogStore } from "@/lib/settings-dialog"

type NavSection = "songs" | "bible" | "display" | "api-keys" | "remote" | "help"

const navItems: { name: string; id: NavSection; icon: React.ReactNode }[] = [
  { name: "Songs & Sets", id: "songs", icon: <MusicIcon strokeWidth={2} /> },
  { name: "Bible", id: "bible", icon: <BookOpenIcon strokeWidth={2} /> },
  { name: "Display Mode", id: "display", icon: <TvIcon strokeWidth={2} /> },
  { name: "Remote Control", id: "remote", icon: <RadioIcon strokeWidth={2} /> },
  { name: "API Keys", id: "api-keys", icon: <KeyIcon strokeWidth={2} /> },
  { name: "Help", id: "help", icon: <HelpCircleIcon strokeWidth={2} /> },
]

function SongLibrarySection() {
  const songs = useSongStore((s) => s.songs)
  const playlists = useSongStore((s) => s.playlists)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-bold text-foreground">Song Library & Daily Sets</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your permanent songs repository, slide divisions, and daily service playlists.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <MusicIcon className="size-4 text-purple-500" />
            <span className="text-xs font-semibold">Default Library</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{songs.length}</p>
          <p className="text-[0.65rem] text-muted-foreground mt-0.5">
            Total permanent songs saved
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-amber-500" />
            <span className="text-xs font-semibold">Daily Playlists</span>
          </div>
          <p className="mt-2 text-2xl font-bold">{playlists.length}</p>
          <p className="text-[0.65rem] text-muted-foreground mt-0.5">
            Scheduled worship service sets
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">Multi-Page Song Division</p>
            <p className="text-[0.65rem] text-muted-foreground">
              Songs can be divided into custom number of presentation pages (2, 3, 4, 6, 8, etc.) or by lines per page.
            </p>
          </div>
          <Badge variant="outline" className="text-[0.65rem] text-purple-600 dark:text-purple-400 border-purple-500/30">
            Active
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">Clipboard, Word & PowerPoint Import</p>
            <p className="text-[0.65rem] text-muted-foreground">
              Direct import from raw lyrics, Microsoft Word (.docx), or PowerPoint (.pptx) presentations.
            </p>
          </div>
          <Badge variant="outline" className="text-[0.65rem] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            Ready
          </Badge>
        </div>
      </div>
    </div>
  )
}

function DisplayModeSection() {
  const { autoMode, setAutoMode, confidenceThreshold, setConfidenceThreshold } = useSettingsStore()
  const thresholdPercent = Math.round(confidenceThreshold * 100)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Broadcast Mode</label>
        <RadioGroup value={autoMode ? "auto" : "manual"} onValueChange={(v) => setAutoMode(v === "auto")} className="gap-3">
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${!autoMode ? "hover:border-muted-foreground/25" : ""}`}>
            <RadioGroupItem value="auto" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Auto</span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Automatically displays the highest-confidence detected verse on broadcast output.
              </p>
            </div>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${autoMode ? "hover:border-muted-foreground/25" : ""}`}>
            <RadioGroupItem value="manual" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Manual</span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Nothing goes to broadcast until you explicitly send it.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {autoMode && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Confidence Threshold</label>
            <span className="text-xs tabular-nums text-muted-foreground">{thresholdPercent}%</span>
          </div>
          <Slider min={35} max={100} step={1} value={[thresholdPercent]} onValueChange={([v]) => setConfidenceThreshold(v / 100)} />
          <p className="text-[0.625rem] text-muted-foreground">
            Only verses with confidence above this threshold will be sent to broadcast automatically.
          </p>
        </div>
      )}
    </div>
  )
}

function ApiKeysSection() {
  const { deepgramApiKey } = useSettingsStore()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Deepgram API Key</label>
          {deepgramApiKey ? (
            <Badge variant="outline" className="text-[0.5rem]">Key configured</Badge>
          ) : (
            <Badge variant="outline" className="text-[0.5rem] text-muted-foreground">Not set</Badge>
          )}
        </div>
        <p className="text-[0.625rem] text-muted-foreground">
          Required for cloud transcription. Configure in the Speech Recognition section.
        </p>
      </div>
    </div>
  )
}

interface TranslationInfo {
  id: number
  abbreviation: string
  title: string
  language: string
}

function BibleSection() {
  const [translations, setTranslations] = useState<TranslationInfo[]>([])
  const [activeId, setActiveId] = useState<number>(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listTranslations()
      .then((list) => setTranslations(list))
      .catch((e) => console.error("[settings] Failed to load translations:", e))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = async (value: string) => {
    const id = parseInt(value)
    setActiveId(id)
    const { useBibleStore } = await import("@/stores")
    useBibleStore.getState().setActiveTranslation(id)
  }

  const englishTranslations = translations.filter((t) => t.language === "en")
  const otherTranslations = translations.filter((t) => t.language !== "en")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Primary Translation</label>
        <Select value={String(activeId)} onValueChange={handleChange} disabled={loading}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={loading ? "Loading..." : "Select translation"} />
          </SelectTrigger>
          <SelectContent>
            {englishTranslations.length > 0 && (
              <>
                <div className="px-2 py-1 text-[0.5625rem] font-medium uppercase tracking-wider text-muted-foreground">English</div>
                {englishTranslations.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.abbreviation} — {t.title}</SelectItem>
                ))}
              </>
            )}
            {otherTranslations.length > 0 && (
              <>
                <div className="mt-1 px-2 py-1 text-[0.5625rem] font-medium uppercase tracking-wider text-muted-foreground">Other Languages</div>
                {otherTranslations.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.abbreviation} — {t.title}</SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        <p className="text-[0.625rem] text-muted-foreground">
          Detected verses will display in this translation.
          {translations.length > 0 && ` ${translations.length} translations available.`}
        </p>
      </div>
    </div>
  )
}

function RemoteControlSection() {
  const [oscActive, setOscActive] = useState(false)
  const [oscPort, setOscPort] = useState(8000)
  const [oscBoundPort, setOscBoundPort] = useState<number | null>(null)
  const [oscLoading, setOscLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pollOscStatus = useCallback(async () => {
    try {
      const status = await api.getOscStatus()
      setOscActive(status.active)
      if (status.port) setOscBoundPort(status.port)
      if (!status.active) setOscBoundPort(null)
    } catch {
      // Server not reachable
    }
  }, [])

  useEffect(() => {
    pollOscStatus()
    pollRef.current = setInterval(pollOscStatus, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [pollOscStatus])

  const handleStartOsc = async () => {
    setOscLoading(true)
    try {
      const boundPort = await api.startOsc(oscPort)
      setOscActive(true)
      setOscBoundPort(boundPort)
    } catch (e) {
      console.error("[settings] Failed to start OSC:", e)
    } finally {
      setOscLoading(false)
    }
  }

  const handleStopOsc = async () => {
    setOscLoading(true)
    try {
      await api.stopOsc()
      setOscActive(false)
      setOscBoundPort(null)
    } catch (e) {
      console.error("[settings] Failed to stop OSC:", e)
    } finally {
      setOscLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          OSC Listener
        </label>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex items-center gap-2 flex-1">
            <span
              className={`inline-block size-2 rounded-full ${oscActive ? "bg-green-500" : "bg-muted-foreground/30"}`}
            />
            <span className="text-xs">
              {oscActive
                ? `Listening on UDP port ${oscBoundPort ?? oscPort}`
                : "Stopped"}
            </span>
          </div>
          {!oscActive ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1024}
                max={65535}
                value={oscPort}
                onChange={(e) => setOscPort(Number(e.target.value))}
                className="h-7 w-20 text-xs"
              />
              <Button size="sm" onClick={handleStartOsc} disabled={oscLoading}>
                Start
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={handleStopOsc} disabled={oscLoading}>
              Stop
            </Button>
          )}
        </div>
        <p className="text-[0.625rem] text-muted-foreground">
          Receives OSC messages from Stream Deck, Companion, TouchOSC, or any OSC controller.
          Addresses use the <code className="text-[0.5625rem]">/openbeam/*</code> prefix.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          HTTP Control API
        </label>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="inline-block size-2 rounded-full bg-green-500" />
            <span className="text-xs">
              Available at <code className="text-[0.5625rem]">POST /api/v1/control</code>
            </span>
          </div>
        </div>
        <p className="text-[0.625rem] text-muted-foreground">
          Send JSON commands like <code className="text-[0.5625rem]">{`{"command":"next"}`}</code> to control the presentation remotely.
        </p>
      </div>
    </div>
  )
}

function HelpSection() {
  const closeSettings = useSettingsDialogStore((s) => s.closeSettings)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Resources to help you get the most out of OpenBeam.
        </p>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <GraduationCapIcon className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Interactive Tutorial</p>
              <p className="text-xs text-muted-foreground">Step-by-step walkthrough of every feature</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              closeSettings()
              setTimeout(() => {
                useTutorialStore.getState().startTutorial()
              }, 300)
            }}
          >
            <GraduationCapIcon className="mr-1.5 size-3.5" />
            Restart
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <KeyIcon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Keyboard Shortcuts</p>
              <p className="text-xs text-muted-foreground">Arrow keys navigate the tutorial, Esc to dismiss</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const sectionTitles: Record<NavSection, string> = {
  songs: "Songs & Sets",
  bible: "Bible Translation",
  display: "Display Mode",
  remote: "Remote Control",
  "api-keys": "API Keys",
  help: "Help",
}

const sectionComponents: Record<NavSection, React.FC> = {
  songs: SongLibrarySection,
  bible: BibleSection,
  display: DisplayModeSection,
  remote: RemoteControlSection,
  "api-keys": ApiKeysSection,
  help: HelpSection,
}

export function SettingsDialog() {
  const open = useSettingsDialogStore((s) => s.isOpen)
  const activeSection = useSettingsDialogStore((s) => s.activeSection)
  const setActiveSection = useSettingsDialogStore((s) => s.setActiveSection)
  const openSettingsFn = useSettingsDialogStore((s) => s.openSettings)
  const closeSettings = useSettingsDialogStore((s) => s.closeSettings)

  const ActiveContent = sectionComponents[activeSection]

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          openSettingsFn()
        } else {
          closeSettings()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" data-tour="settings">
          <SettingsIcon className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 md:max-h-[600px] md:max-w-[800px] lg:max-w-[900px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Configure audio, display mode, and API keys.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <div className="h-14 border-b border-border border-r px-4 flex items-center">
              Settings
            </div>
            <SidebarContent className="border-r border-border">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navItems.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={item.id === activeSection}
                          onClick={() => setActiveSection(item.id)}
                        >
                          {item.icon}
                          <span>{item.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-[580px] flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
              <div className="flex items-center gap-2 px-4">
                {sectionTitles[activeSection]}
              </div>
            </header>
            <div className="flex flex-1 flex-col overflow-y-auto p-4">
              <ActiveContent />
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

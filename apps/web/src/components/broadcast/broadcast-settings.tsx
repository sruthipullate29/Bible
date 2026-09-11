import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useBroadcastStore } from "@/stores"
import { getSessionId } from "@/streams/setup"
import type { DisplayInfo, NetworkInfo } from "@/types/electron"
import {
  MonitorIcon,
  CastIcon,
  CopyIcon,
  CheckIcon,
  LinkIcon,
  WifiIcon,
  TvIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  PlayIcon,
  SquareIcon,
  PaletteIcon,
} from "lucide-react"

export function BroadcastSettings({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)
  const altActiveThemeId = useBroadcastStore((s) => s.altActiveThemeId)
  const mainEnabled = useBroadcastStore((s) => s.mainEnabled)
  const altEnabled = useBroadcastStore((s) => s.altEnabled)

  const [mainThemeId, setMainThemeId] = useState(activeThemeId)
  const [mainCopied, setMainCopied] = useState(false)

  const [altThemeId, setAltThemeId] = useState(altActiveThemeId)
  const [altCopied, setAltCopied] = useState(false)

  // Wired display state
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [selectedDisplayId, setSelectedDisplayId] = useState<string>("")
  const [wiredOutputMode, setWiredOutputMode] = useState<"main" | "alt">("main")
  const [wiredFullscreen, setWiredFullscreen] = useState(true)
  const [wiredAlwaysOnTop, setWiredAlwaysOnTop] = useState(true)
  const [isWiredActive, setIsWiredActive] = useState(false)
  const [activeWiredDisplayId, setActiveWiredDisplayId] = useState<number | null>(null)
  const [loadingDisplays, setLoadingDisplays] = useState(false)

  // Wireless network state
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null)
  const [selectedIp, setSelectedIp] = useState<string>("")
  const [lanCopied, setLanCopied] = useState(false)

  const sessionId = getSessionId()

  const refreshDisplays = useCallback(async () => {
    if (typeof window === "undefined" || !window.electronAPI?.getDisplays) return
    setLoadingDisplays(true)
    try {
      const list = await window.electronAPI.getDisplays()
      setDisplays(list)
      if (list.length > 0 && !selectedDisplayId) {
        // Default to non-primary display (e.g. HDMI projector) if available
        const nonPrimary = list.find((d) => !d.isPrimary)
        setSelectedDisplayId(String(nonPrimary ? nonPrimary.id : list[0].id))
      }
    } catch (e) {
      console.error("[broadcast] Failed to fetch displays:", e)
    } finally {
      setLoadingDisplays(false)
    }
  }, [selectedDisplayId])

  const checkWiredStatus = useCallback(async () => {
    if (typeof window === "undefined" || !window.electronAPI?.getWiredDisplayStatus) return
    try {
      const status = await window.electronAPI.getWiredDisplayStatus()
      setIsWiredActive(status.active)
      setActiveWiredDisplayId(status.displayId)
    } catch {
      // ignore
    }
  }, [])

  const fetchNetworkInfo = useCallback(async () => {
    if (typeof window !== "undefined" && window.electronAPI?.getNetworkInfo) {
      try {
        const info = await window.electronAPI.getNetworkInfo()
        setNetworkInfo(info)
        if (info.ips.length > 0 && !selectedIp) {
          setSelectedIp(info.ips[0].address)
        }
        return
      } catch {
        // fallback to server fetch
      }
    }
    // Fallback: fetch from /api/network/info
    try {
      const res = await fetch("/api/network/info")
      if (res.ok) {
        const data = await res.json()
        setNetworkInfo(data)
        if (data.ips?.length > 0 && !selectedIp) {
          setSelectedIp(data.ips[0].address)
        }
      }
    } catch {
      // ignore network fetch errors
    }
  }, [selectedIp])

  useEffect(() => {
    setMainThemeId(activeThemeId)
  }, [activeThemeId])

  useEffect(() => {
    setAltThemeId(altActiveThemeId)
  }, [altActiveThemeId])

  useEffect(() => {
    if (open) {
      refreshDisplays()
      checkWiredStatus()
      fetchNetworkInfo()
    }
  }, [open, refreshDisplays, checkWiredStatus, fetchNetworkInfo])

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI?.onWiredDisplayStatusChange) {
      const unsubscribe = window.electronAPI.onWiredDisplayStatusChange((status) => {
        setIsWiredActive(status.active)
        setActiveWiredDisplayId(status.displayId)
      })
      return unsubscribe
    }
  }, [])

  const handleStartWired = async () => {
    if (typeof window === "undefined" || !window.electronAPI?.openWiredDisplay) {
      // Web fallback: open in a popup window
      const url = `${window.location.origin}/overlay.html?role=overlay&output=${wiredOutputMode}&session=${sessionId}`
      window.open(url, "SharonAG_Wired_Overlay", "width=1280,height=720,menubar=no,toolbar=no")
      setIsWiredActive(true)
      return
    }

    try {
      const res = await window.electronAPI.openWiredDisplay({
        displayId: selectedDisplayId ? Number(selectedDisplayId) : undefined,
        options: {
          fullscreen: wiredFullscreen,
          alwaysOnTop: wiredAlwaysOnTop,
          output: wiredOutputMode,
          session: sessionId,
        },
      })
      if (res.success) {
        setIsWiredActive(true)
        if (res.displayId) setActiveWiredDisplayId(res.displayId)
      }
    } catch (e) {
      console.error("[broadcast] Failed to start wired display:", e)
    }
  }

  const handleStopWired = async () => {
    if (typeof window === "undefined" || !window.electronAPI?.closeWiredDisplay) {
      setIsWiredActive(false)
      return
    }
    try {
      await window.electronAPI.closeWiredDisplay()
      setIsWiredActive(false)
      setActiveWiredDisplayId(null)
    } catch (e) {
      console.error("[broadcast] Failed to stop wired display:", e)
    }
  }

  const handleMainThemeChange = (id: string) => {
    setMainThemeId(id)
    useBroadcastStore.getState().setActiveTheme(id)
  }

  const handleAltThemeChange = (id: string) => {
    setAltThemeId(id)
    useBroadcastStore.getState().setAltActiveTheme(id)
  }

  // URLs
  const port = networkInfo?.port || 4001
  const activeLanHost = selectedIp ? `${selectedIp}:${port}` : window.location.host
  const lanOverlayUrl = `http://${activeLanHost}/overlay.html?role=overlay&output=main&session=${sessionId}`
  const localhostOverlayUrl = `${window.location.origin}/overlay.html?role=overlay&output=main&session=${sessionId}`
  const altOverlayUrl = `${window.location.origin}/overlay.html?role=overlay&output=alt&session=${sessionId}`

  const copyUrl = async (url: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] gap-4" showCloseButton={true}>
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CastIcon className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Broadcast Center</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Stream verses via direct wired HDMI projector or wireless Wi-Fi network.
                </DialogDescription>
              </div>
            </div>
            {isWiredActive && (
              <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                Wired Output Active
              </Badge>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="wired" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="wired" className="gap-2 text-xs">
              <TvIcon className="size-3.5" />
              <span>Wired (HDMI / Projector)</span>
            </TabsTrigger>
            <TabsTrigger value="wireless" className="gap-2 text-xs">
              <WifiIcon className="size-3.5" />
              <span>Wireless (Wi-Fi / OBS)</span>
            </TabsTrigger>
            <TabsTrigger value="themes" className="gap-2 text-xs">
              <PaletteIcon className="size-3.5" />
              <span>Themes & Outputs</span>
            </TabsTrigger>
          </TabsList>

          {/* ─────────────────────────────────────────────────────────────
              TAB 1: WIRED BROADCAST
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="wired" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <MonitorIcon className="size-4 text-primary" />
                    Direct Wired Screen Output
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Launch a borderless fullscreen presentation window directly onto your church projector, TV, or secondary display via HDMI/cable.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshDisplays}
                  disabled={loadingDisplays}
                  className="gap-1.5 text-xs h-8"
                >
                  <RefreshCwIcon className={cn("size-3", loadingDisplays && "animate-spin")} />
                  Refresh Displays
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Display Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Target Display / Projector
                  </label>
                  <Select
                    value={selectedDisplayId}
                    onValueChange={setSelectedDisplayId}
                    disabled={displays.length === 0}
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder={displays.length === 0 ? "Detecting monitors..." : "Select display"} />
                    </SelectTrigger>
                    <SelectContent>
                      {displays.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)} className="text-xs">
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[0.6875rem] text-muted-foreground">
                    {displays.length > 1
                      ? "Select the secondary display (HDMI/Projector) to present."
                      : "Only 1 display detected. You can open a window and drag it to any screen."}
                  </p>
                </div>

                {/* Output Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Broadcast Feed
                  </label>
                  <Select
                    value={wiredOutputMode}
                    onValueChange={(v) => setWiredOutputMode(v as "main" | "alt")}
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main" className="text-xs">Main Output Feed</SelectItem>
                      <SelectItem value="alt" className="text-xs">Alternate Output Feed</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[0.6875rem] text-muted-foreground">
                    Feed source configured in the Themes & Outputs tab.
                  </p>
                </div>
              </div>

              {/* Window Options */}
              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border/50 text-xs">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={wiredFullscreen}
                    onCheckedChange={setWiredFullscreen}
                    id="fullscreen-toggle"
                  />
                  <label htmlFor="fullscreen-toggle" className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Fullscreen (Borderless)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={wiredAlwaysOnTop}
                    onCheckedChange={setWiredAlwaysOnTop}
                    id="always-on-top-toggle"
                  />
                  <label htmlFor="always-on-top-toggle" className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Always On Top
                  </label>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Status:{" "}
                  {isWiredActive ? (
                    <span className="font-semibold text-emerald-400">
                      Active {activeWiredDisplayId ? `on Display ${activeWiredDisplayId}` : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Inactive (Ready to launch)</span>
                  )}
                </div>

                {isWiredActive ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={handleStopWired}
                  >
                    <SquareIcon className="size-3.5 fill-current" />
                    Stop Wired Output
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={handleStartWired}
                  >
                    <PlayIcon className="size-3.5 fill-current" />
                    Launch on Projector (Wired)
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: WIRELESS BROADCAST
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="wireless" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <WifiIcon className="size-4 text-primary" />
                  Wireless Network Streaming (Wi-Fi & LAN)
                </h4>
                <p className="text-xs text-muted-foreground">
                  Transmit verses wirelessly to smart TVs, iPads, tablets, mobile devices, wireless beamers, or OBS Studio over local Wi-Fi.
                </p>
              </div>

              {/* Wi-Fi URL Card */}
              <div className="rounded-md border border-border/70 bg-background/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[0.6875rem]">
                      Wi-Fi / LAN Network Link
                    </Badge>
                    <span className="text-xs text-muted-foreground">For tablets, smart TVs, and wireless devices</span>
                  </div>
                  {networkInfo?.ips && networkInfo.ips.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.6875rem] text-muted-foreground">Network Interface:</span>
                      <select
                        value={selectedIp}
                        onChange={(e) => setSelectedIp(e.target.value)}
                        className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                      >
                        {networkInfo.ips.map((ip) => (
                          <option key={ip.address} value={ip.address}>
                            {ip.name} ({ip.address})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <code className="flex-1 rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-muted-foreground select-all truncate">
                    {lanOverlayUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs shrink-0"
                    onClick={() => copyUrl(lanOverlayUrl, setLanCopied)}
                  >
                    {lanCopied ? (
                      <>
                        <CheckIcon className="size-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3" />
                        Copy Link
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs shrink-0"
                    onClick={() => window.open(lanOverlayUrl, "_blank")}
                  >
                    <ExternalLinkIcon className="size-3" />
                    Open
                  </Button>
                </div>
                <p className="text-[0.6875rem] text-muted-foreground/80">
                  Open this link in any browser on devices connected to the same Wi-Fi network.
                </p>
              </div>

              {/* Localhost OBS URL Card */}
              <div className="rounded-md border border-border/70 bg-background/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-muted text-foreground/80 text-[0.6875rem]">
                      Localhost / OBS Studio Source
                    </Badge>
                    <span className="text-xs text-muted-foreground">For OBS / vMix on this computer</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <code className="flex-1 rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-muted-foreground select-all truncate">
                    {localhostOverlayUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs shrink-0"
                    onClick={() => copyUrl(localhostOverlayUrl, setMainCopied)}
                  >
                    {mainCopied ? (
                      <>
                        <CheckIcon className="size-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3" />
                        Copy Link
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[0.6875rem] text-muted-foreground/80">
                  Add this as a Browser Source in OBS Studio with width 1920 and height 1080.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: THEMES & OUTPUTS
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="themes" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Main Output Card */}
              <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MonitorIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Main Output</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs", mainEnabled ? "text-foreground" : "text-muted-foreground")}>
                      {mainEnabled ? "Enabled" : "Disabled"}
                    </span>
                    <Switch
                      checked={mainEnabled}
                      onCheckedChange={(v) => useBroadcastStore.getState().setMainEnabled(v)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Theme</label>
                  <Select value={mainThemeId} onValueChange={handleMainThemeChange}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {themes.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <LinkIcon className="size-3 text-muted-foreground" />
                    <label className="text-xs text-muted-foreground">Overlay URL</label>
                  </div>
                  <div className="flex gap-1.5">
                    <code className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[0.6875rem] text-muted-foreground truncate select-all">
                      {localhostOverlayUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1 px-2 text-xs"
                      onClick={() => copyUrl(localhostOverlayUrl, setMainCopied)}
                    >
                      {mainCopied ? <CheckIcon className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Alternate Output Card */}
              <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CastIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Alternate Output</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs", altEnabled ? "text-foreground" : "text-muted-foreground")}>
                      {altEnabled ? "Enabled" : "Disabled"}
                    </span>
                    <Switch
                      checked={altEnabled}
                      onCheckedChange={(v) => useBroadcastStore.getState().setAltEnabled(v)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Theme</label>
                  <Select value={altThemeId} onValueChange={handleAltThemeChange}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {themes.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <LinkIcon className="size-3 text-muted-foreground" />
                    <label className="text-xs text-muted-foreground">Alternate Overlay URL</label>
                  </div>
                  <div className="flex gap-1.5">
                    <code className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[0.6875rem] text-muted-foreground truncate select-all">
                      {altOverlayUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1 px-2 text-xs"
                      onClick={() => copyUrl(altOverlayUrl, setAltCopied)}
                    >
                      {altCopied ? <CheckIcon className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

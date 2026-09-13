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
  const wiredAutoConnect = useBroadcastStore((s) => s.wiredAutoConnect)
  const setWiredAutoConnect = useBroadcastStore((s) => s.setWiredAutoConnect)
  const mainWiredDisplayId = useBroadcastStore((s) => s.mainWiredDisplayId)
  const altWiredDisplayId = useBroadcastStore((s) => s.altWiredDisplayId)
  const setMainWiredDisplayId = useBroadcastStore((s) => s.setMainWiredDisplayId)
  const setAltWiredDisplayId = useBroadcastStore((s) => s.setAltWiredDisplayId)
  const openBothWiredDisplays = useBroadcastStore((s) => s.openBothWiredDisplays)

  const [mainThemeId, setMainThemeId] = useState(activeThemeId)
  const [mainCopied, setMainCopied] = useState(false)

  const [altThemeId, setAltThemeId] = useState(altActiveThemeId)
  const [altCopied, setAltCopied] = useState(false)

  // Wired display state - Main Screen (HDMI 1)
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [mainDisplayId, setMainDisplayIdState] = useState<string>(mainWiredDisplayId ? String(mainWiredDisplayId) : "")
  const [mainFullscreen, setMainFullscreen] = useState(true)
  const [mainAlwaysOnTop, setMainAlwaysOnTop] = useState(true)
  const [isMainWiredActive, setIsMainWiredActive] = useState(false)
  const [activeMainDisplayId, setActiveMainDisplayId] = useState<number | null>(null)

  // Wired display state - Alternative Screen (HDMI 2)
  const [altDisplayId, setAltDisplayIdState] = useState<string>(altWiredDisplayId ? String(altWiredDisplayId) : "")
  const [altFullscreen, setAltFullscreen] = useState(true)
  const [altAlwaysOnTop, setAltAlwaysOnTop] = useState(true)
  const [isAltWiredActive, setIsAltWiredActive] = useState(false)
  const [activeAltDisplayId, setActiveAltDisplayId] = useState<number | null>(null)

  const [loadingDisplays, setLoadingDisplays] = useState(false)

  const handleSelectMainDisplay = (id: string) => {
    setMainDisplayIdState(id)
    setMainWiredDisplayId(id)
  }

  const handleSelectAltDisplay = (id: string) => {
    setAltDisplayIdState(id)
    setAltWiredDisplayId(id)
  }

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
      if (list.length > 0) {
        const nonPrimaryDisplays = list.filter((d) => !d.isPrimary)

        let mId = mainDisplayId
        if (!mId || !list.some((d) => String(d.id) === mId)) {
          // Default HDMI 1 / Main Screen to first external display (or primary if only 1)
          const mainTarget = nonPrimaryDisplays[0] || list[0]
          mId = String(mainTarget.id)
          setMainDisplayIdState(mId)
          setMainWiredDisplayId(mId)
        }

        let aId = altDisplayId
        if (!aId || !list.some((d) => String(d.id) === aId)) {
          // Default HDMI 2 / Alt Screen to second external display (or nonPrimary, or primary)
          const altTarget = nonPrimaryDisplays[1] || nonPrimaryDisplays[0] || list[0]
          aId = String(altTarget.id)
          setAltDisplayIdState(aId)
          setAltWiredDisplayId(aId)
        }
      }
    } catch (e) {
      console.error("[broadcast] Failed to fetch displays:", e)
    } finally {
      setLoadingDisplays(false)
    }
  }, [mainDisplayId, altDisplayId, setMainWiredDisplayId, setAltWiredDisplayId])

  const checkWiredStatus = useCallback(async () => {
    if (typeof window === "undefined" || !window.electronAPI?.getWiredDisplayStatus) return
    try {
      const status = await window.electronAPI.getWiredDisplayStatus()
      if (status.status) {
        setIsMainWiredActive(status.status.main.active)
        setActiveMainDisplayId(status.status.main.displayId)
        setIsAltWiredActive(status.status.alt.active)
        setActiveAltDisplayId(status.status.alt.displayId)
      } else if (status.main || status.alt) {
        setIsMainWiredActive(status.main?.active ?? false)
        setActiveMainDisplayId(status.main?.displayId ?? null)
        setIsAltWiredActive(status.alt?.active ?? false)
        setActiveAltDisplayId(status.alt?.displayId ?? null)
      } else {
        setIsMainWiredActive(status.active)
        setActiveMainDisplayId(status.displayId)
      }
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
        if (status.status) {
          setIsMainWiredActive(status.status.main.active)
          setActiveMainDisplayId(status.status.main.displayId)
          setIsAltWiredActive(status.status.alt.active)
          setActiveAltDisplayId(status.status.alt.displayId)
        } else if (status.output === "alt") {
          setIsAltWiredActive(status.active)
          setActiveAltDisplayId(status.displayId)
        } else if (status.output === "main") {
          setIsMainWiredActive(status.active)
          setActiveMainDisplayId(status.displayId)
        } else {
          setIsMainWiredActive(status.active)
          setActiveMainDisplayId(status.displayId)
        }
      })
      return unsubscribe
    }
  }, [])

  const handleStartMainWired = async () => {
    await useBroadcastStore.getState().openWiredDisplay(
      mainDisplayId ? Number(mainDisplayId) : undefined,
      "main",
      { fullscreen: mainFullscreen, alwaysOnTop: mainAlwaysOnTop }
    )
    setIsMainWiredActive(true)
    if (mainDisplayId) setActiveMainDisplayId(Number(mainDisplayId))
  }

  const handleStopMainWired = async () => {
    await useBroadcastStore.getState().closeWiredDisplay("main")
    setIsMainWiredActive(false)
    setActiveMainDisplayId(null)
  }

  const handleStartAltWired = async () => {
    await useBroadcastStore.getState().openWiredDisplay(
      altDisplayId ? Number(altDisplayId) : undefined,
      "alt",
      { fullscreen: altFullscreen, alwaysOnTop: altAlwaysOnTop }
    )
    setIsAltWiredActive(true)
    if (altDisplayId) setActiveAltDisplayId(Number(altDisplayId))
  }

  const handleStopAltWired = async () => {
    await useBroadcastStore.getState().closeWiredDisplay("alt")
    setIsAltWiredActive(false)
    setActiveAltDisplayId(null)
  }

  const handleStartBothWired = async () => {
    await openBothWiredDisplays({
      fullscreen: mainFullscreen,
      alwaysOnTop: mainAlwaysOnTop,
    })
    setIsMainWiredActive(true)
    setIsAltWiredActive(true)
    if (mainDisplayId) setActiveMainDisplayId(Number(mainDisplayId))
    if (altDisplayId) setActiveAltDisplayId(Number(altDisplayId))
  }

  const handleStopBothWired = async () => {
    await useBroadcastStore.getState().closeWiredDisplay()
    setIsMainWiredActive(false)
    setIsAltWiredActive(false)
    setActiveMainDisplayId(null)
    setActiveAltDisplayId(null)
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
            {(isMainWiredActive || isAltWiredActive) && (
              <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                {isMainWiredActive && isAltWiredActive
                  ? "Main & Alt Outputs Active"
                  : isMainWiredActive
                  ? "Main Output Active"
                  : "Alt Output Active"}
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
              TAB 1: WIRED BROADCAST (MAIN & ALTERNATIVE SCREENS)
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="wired" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <MonitorIcon className="size-4 text-primary" />
                    Direct Wired Screen Outputs (Main & Alternative)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Launch independent borderless presentation windows to both your Main Projector and Alternative/Stage screen via HDMI/cable.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(!isMainWiredActive || !isAltWiredActive) && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleStartBothWired}
                      className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                    >
                      <PlayIcon className="size-3 fill-current" />
                      Launch Both HDMI Screens
                    </Button>
                  )}
                  {(isMainWiredActive || isAltWiredActive) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleStopBothWired}
                      className="gap-1.5 text-xs h-8"
                    >
                      <SquareIcon className="size-3 fill-current" />
                      Stop All Screens
                    </Button>
                  )}
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
              </div>

              {/* Grid with 2 distinct cards: Main Screen (HDMI 1) and Alternative Screen (HDMI 2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* 1. Main Output Screen Card */}
                <div className="rounded-md border border-border/80 bg-background/50 p-3.5 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MonitorIcon className="size-4 text-primary" />
                        <span className="text-xs font-bold text-foreground">Main Screen (Projector)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] font-bold border-primary/30 bg-primary/10 text-primary px-1.5 py-0.5">
                          HDMI 1
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5",
                            isMainWiredActive
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-500"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {isMainWiredActive ? `Active on Display ${activeMainDisplayId ?? ""}` : "Inactive"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Target Monitor / Projector (HDMI 1)
                      </label>
                      <Select
                        value={mainDisplayId}
                        onValueChange={handleSelectMainDisplay}
                        disabled={displays.length === 0}
                      >
                        <SelectTrigger className="w-full text-xs h-8">
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
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={mainFullscreen}
                          onCheckedChange={setMainFullscreen}
                          id="main-fullscreen-toggle"
                        />
                        <label htmlFor="main-fullscreen-toggle" className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Fullscreen
                        </label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={mainAlwaysOnTop}
                          onCheckedChange={setMainAlwaysOnTop}
                          id="main-aot-toggle"
                        />
                        <label htmlFor="main-aot-toggle" className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Always On Top
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40">
                    {isMainWiredActive ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full gap-2 text-xs h-8"
                        onClick={handleStopMainWired}
                      >
                        <SquareIcon className="size-3.5 fill-current" />
                        Stop Main Screen (HDMI 1)
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full gap-2 text-xs h-8"
                        onClick={handleStartMainWired}
                      >
                        <PlayIcon className="size-3.5 fill-current" />
                        Launch Main Screen (HDMI 1)
                      </Button>
                    )}
                  </div>
                </div>

                {/* 2. Alternative Output Screen Card */}
                <div className="rounded-md border border-border/80 bg-background/50 p-3.5 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TvIcon className="size-4 text-amber-500" />
                        <span className="text-xs font-bold text-foreground">Alternative Screen (Stage / Lower Third)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] font-bold border-amber-500/30 bg-amber-500/10 text-amber-500 px-1.5 py-0.5">
                          HDMI 2
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5",
                            isAltWiredActive
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-500"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {isAltWiredActive ? `Active on Display ${activeAltDisplayId ?? ""}` : "Inactive"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Target Monitor / Screen (HDMI 2)
                      </label>
                      <Select
                        value={altDisplayId}
                        onValueChange={handleSelectAltDisplay}
                        disabled={displays.length === 0}
                      >
                        <SelectTrigger className="w-full text-xs h-8">
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
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={altFullscreen}
                          onCheckedChange={setAltFullscreen}
                          id="alt-fullscreen-toggle"
                        />
                        <label htmlFor="alt-fullscreen-toggle" className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Fullscreen
                        </label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={altAlwaysOnTop}
                          onCheckedChange={setAltAlwaysOnTop}
                          id="alt-aot-toggle"
                        />
                        <label htmlFor="alt-aot-toggle" className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Always On Top
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40">
                    {isAltWiredActive ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full gap-2 text-xs h-8"
                        onClick={handleStopAltWired}
                      >
                        <SquareIcon className="size-3.5 fill-current" />
                        Stop Alternative Screen (HDMI 2)
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full gap-2 text-xs h-8 border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
                        onClick={handleStartAltWired}
                      >
                        <PlayIcon className="size-3.5 fill-current" />
                        Launch Alternative Screen (HDMI 2)
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Global Auto-connect Option */}
              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={wiredAutoConnect}
                    onCheckedChange={setWiredAutoConnect}
                    id="auto-connect-toggle"
                  />
                  <label htmlFor="auto-connect-toggle" className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                    Auto-launch both HDMI screens (Main & Alternative) when pressing "Go Live"
                  </label>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Outputs mirror what is configured in Themes & Outputs
                </div>
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

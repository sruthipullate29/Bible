import { useState } from "react"
import { PaletteIcon, CastIcon, SunIcon, MoonIcon, TvIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsDialog } from "@/components/settings-dialog"
import { ThemeDesigner } from "@/components/broadcast/theme-designer"
import { BroadcastSettings } from "@/components/broadcast/broadcast-settings"
import { useBroadcastStore } from "@/stores"
import { useTheme } from "@/components/theme-provider"
import { ScheduleButton } from "@/components/panels/schedule-panel"
import { cn } from "@/lib/utils"

export function TransportBar() {
  const { theme, setTheme } = useTheme()
  const isWiredActive = useBroadcastStore((s) => s.isWiredActive)
  const isMainWiredActive = useBroadcastStore((s) => s.isMainWiredActive)
  const isAltWiredActive = useBroadcastStore((s) => s.isAltWiredActive)
  const toggleWiredDisplay = useBroadcastStore((s) => s.toggleWiredDisplay)
  const [broadcastOpen, setBroadcastOpen] = useState(false)

  return (
    <div
      data-slot="transport-bar"
      className="col-span-4 flex h-14 items-center justify-between border-b border-border  bg-card px-3"
    >
      {/* Left: Logo + Plan Badge */}
      <div className="flex items-center gap-2.5">
        <img
          src="/sharon-ag-logo.png"
          alt="Sharon AG"
          className="size-7 rounded-full object-cover shadow-sm ring-1 ring-amber-500/40"
        />
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-base font-bold tracking-tight text-foreground">
            Sharon AG
          </span>
          <span className="text-[10px] font-medium tracking-wider text-amber-500 uppercase">
            Media
          </span>
        </div>
      </div>

      {/* Right: Controls + Status + Settings */}
      <div className="flex items-center gap-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <SunIcon className="size-3.5" />
          ) : (
            <MoonIcon className="size-3.5" />
          )}
        </Button>
        <ScheduleButton />
        <Button
          variant={isWiredActive ? "default" : "ghost"}
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2.5 text-xs font-medium transition-all rounded-md",
            isWiredActive
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30"
              : "text-muted-foreground hover:text-foreground border border-border/50"
          )}
          title={
            isMainWiredActive && isAltWiredActive
              ? "2 HDMI Screens Active (HDMI 1 Main + HDMI 2 Alt). Click to disconnect."
              : isWiredActive
                ? "HDMI Screen Active. Click to disconnect."
                : "Connect HDMI Screen (Projector / TV)"
          }
          onClick={() => toggleWiredDisplay()}
        >
          <TvIcon className={cn("size-3.5", isWiredActive && "text-emerald-400 animate-pulse")} />
          <span>
            {isMainWiredActive && isAltWiredActive
              ? "2 Screens Live"
              : isWiredActive
                ? "HDMI Live"
                : "HDMI Screen"}
          </span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Broadcast Settings"
          data-tour="broadcast"
          onClick={() => setBroadcastOpen(true)}
        >
          <CastIcon className="size-3.5" />
        </Button>
        <BroadcastSettings open={broadcastOpen} onOpenChange={setBroadcastOpen} />
        <Button
          variant="ghost"
          size="icon-sm"
          title="Theme Designer"
          data-tour="theme"
          onClick={() => useBroadcastStore.getState().setDesignerOpen(true)}
        >
          <PaletteIcon className="size-3.5" />
        </Button>
        <ThemeDesigner />
        <SettingsDialog />
      </div>
    </div>
  )
}

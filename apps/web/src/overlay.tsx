/* eslint-disable react-refresh/only-export-components */
import { createRoot } from "react-dom/client"
import { useRef, useEffect, useCallback, useState } from "react"
import "./index.css"
import { renderVerse } from "@/lib/verse-renderer"
import { OpenBeamSocket } from "@/services/ws"
import type { BroadcastTheme, VerseRenderData } from "@/types/broadcast"
import {
  Maximize2Icon,
  Minimize2Icon,
  SunIcon,
  SunMoonIcon,
  RadioIcon,
} from "lucide-react"

interface BroadcastPayload {
  theme: BroadcastTheme | null
  verse: VerseRenderData | null
  label?: string
  enabled?: boolean
}

const params = new URLSearchParams(window.location.search)
const themeFilter = params.get("theme")
const resolutionParam = params.get("resolution")
const outputId = params.get("output") || "main"
const isTransparent =
  params.get("transparent") === "1" ||
  params.get("transparent") === "true" ||
  params.get("bg") === "transparent"

const expectLabel = outputId === "alt" ? "broadcast-alt" : "broadcast"

let initWidth = 1920
let initHeight = 1080
if (resolutionParam) {
  const [w, h] = resolutionParam.split("x").map(Number)
  if (w > 0 && h > 0) {
    initWidth = w
    initHeight = h
  }
}

// Build WS URL with role=overlay and session scoping
const role = params.get("role") || "overlay"
const sessionId = params.get("session") || "default"
const overlaySocket = new OpenBeamSocket(
  `/ws/overlay?role=${role}&session=${sessionId}`
)

function BroadcastCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const latestData = useRef<BroadcastPayload | null>(null)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())

  const [connected, setConnected] = useState(false)
  const [hasVerse, setHasVerse] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef = useRef<any>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const data = latestData.current
    if (!data || data.enabled === false || !data.theme) {
      if (isTransparent) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      } else {
        ctx.fillStyle = "#000000"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      setHasVerse(false)
      return
    }

    const { theme, verse } = data
    canvas.width = theme.resolution.width
    canvas.height = theme.resolution.height

    if (isTransparent && !verse) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setHasVerse(false)
      return
    }

    const result = renderVerse(ctx, theme, verse, {
      scale: 1,
      imageCache: imageCacheRef.current,
    })

    if (!result) {
      if (isTransparent) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      } else {
        ctx.fillStyle = "#000000"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      setHasVerse(false)
    } else {
      setHasVerse(Boolean(verse))
    }
  }, [])

  const preloadBackgroundImage = useCallback(
    (theme: BroadcastTheme) => {
      const bg = theme.background
      if (bg.type !== "image" || !bg.image?.url) return

      const url = bg.image.url
      const cache = imageCacheRef.current
      if (cache.has(url)) return

      const img = new Image()
      img.onload = () => {
        cache.set(url, img)
        draw()
      }
      img.onerror = () => {
        console.warn("[broadcast-output] failed to load background image", { url })
      }
      img.src = url
    },
    [draw]
  )

  // Wake Lock for mobile/tablet screens to keep screen awake during church service
  const toggleWakeLock = async () => {
    if ("wakeLock" in navigator) {
      try {
        if (!wakeLockActive) {
          const lock = await (navigator as any).wakeLock.request("screen")
          wakeLockRef.current = lock
          setWakeLockActive(true)
          lock.addEventListener("release", () => {
            setWakeLockActive(false)
            wakeLockRef.current = null
          })
        } else if (wakeLockRef.current) {
          await wakeLockRef.current.release()
          wakeLockRef.current = null
          setWakeLockActive(false)
        }
      } catch (err) {
        console.warn("[overlay] Wake Lock error:", err)
      }
    }
  }

  // Auto-acquire wakeLock if available
  useEffect(() => {
    if ("wakeLock" in navigator) {
      (navigator as any).wakeLock
        .request("screen")
        .then((lock: any) => {
          wakeLockRef.current = lock
          setWakeLockActive(true)
          lock.addEventListener("release", () => setWakeLockActive(false))
        })
        .catch(() => {})
    }
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
      }
    }
  }, [])

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Keyboard shortcut: 'F' for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen()
      }
    }
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    window.addEventListener("keydown", handleKeyDown)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Activity timer to fade out controls
  const bumpControls = useCallback(() => {
    setShowControls(true)
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current)
    }
    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false)
    }, 3000)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = initWidth
      canvas.height = initHeight
      const ctx = canvas.getContext("2d")
      if (ctx) {
        if (isTransparent) {
          ctx.clearRect(0, 0, initWidth, initHeight)
        } else {
          ctx.fillStyle = "#000000"
          ctx.fillRect(0, 0, initWidth, initHeight)
        }
      }
    }

    overlaySocket.connect()

    const offConnected = overlaySocket.on("_connected", () => {
      setConnected(true)
      overlaySocket.send("overlay:ready", { output: outputId })
    })

    const offDisconnected = overlaySocket.on("_disconnected", () => {
      setConnected(false)
    })

    const offUpdate = overlaySocket.on("verse:update", (_, data) => {
      const payload = data as BroadcastPayload
      if (payload.label && payload.label !== expectLabel) return
      if (themeFilter && payload.theme?.id !== themeFilter) return
      latestData.current = payload
      if (payload.theme) preloadBackgroundImage(payload.theme)
      draw()
    })

    return () => {
      offConnected()
      offDisconnected()
      offUpdate()
      overlaySocket.disconnect()
    }
  }, [draw, preloadBackgroundImage])

  return (
    <div
      ref={containerRef}
      onMouseMove={bumpControls}
      onTouchStart={bumpControls}
      onDoubleClick={toggleFullscreen}
      className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black select-none"
      style={{
        backgroundColor: isTransparent ? "transparent" : "#000000",
      }}
    >
      {/* 16:9 Centered Responsive Canvas */}
      <canvas
        ref={canvasRef}
        className="max-h-full max-w-full aspect-video object-contain block shadow-2xl transition-all"
        style={{
          width: "100%",
          height: "100%",
        }}
      />

      {/* Standby screen when waiting for connection or initial verse */}
      {!isTransparent && !hasVerse && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-700 bg-gradient-to-b from-black/80 via-black to-black">
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <div className="relative flex size-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.05)] backdrop-blur-md">
              <RadioIcon
                className={`size-8 transition-colors ${
                  connected
                    ? "text-emerald-400 animate-pulse"
                    : "text-amber-400/80 animate-bounce"
                }`}
              />
              <span
                className={`absolute -top-1 -right-1 size-3 rounded-full border-2 border-black ${
                  connected ? "bg-emerald-500 animate-ping" : "bg-amber-500"
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-bold tracking-tight text-white/90 font-sans">
                Sharon AG Bible Presentation
              </h1>
              <p className="text-xs font-medium text-white/40 tracking-wider uppercase">
                {outputId === "alt" ? "Alternative / Stage Display" : "Main Live Display"}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">
              <span
                className={`size-2 rounded-full ${
                  connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                }`}
              />
              <span>
                {connected
                  ? "Live Wireless Stream Ready • Waiting for verse"
                  : "Connecting to Sharon AG host..."}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Hiding Floating Controls Bar (Fades out when inactive) */}
      <div
        className={`fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 p-1 text-white shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
          className="flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white transition-colors"
        >
          {isFullscreen ? (
            <Minimize2Icon className="size-4" />
          ) : (
            <Maximize2Icon className="size-4" />
          )}
        </button>

        {/* Wake Lock Screen Button */}
        {"wakeLock" in navigator && (
          <button
            onClick={toggleWakeLock}
            title={wakeLockActive ? "Screen Keep-Awake Active" : "Enable Keep-Awake"}
            className={`flex size-8 items-center justify-center rounded-full transition-colors ${
              wakeLockActive
                ? "bg-amber-500/20 text-amber-300"
                : "text-white/60 hover:bg-white/15 hover:text-white"
            }`}
          >
            {wakeLockActive ? (
              <SunIcon className="size-4" />
            ) : (
              <SunMoonIcon className="size-4" />
            )}
          </button>
        )}

        {/* Connection Status Indicator */}
        <div
          title={connected ? "Connected to Wi-Fi Host" : "Disconnected from Host"}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-medium text-white/70"
        >
          <span
            className={`size-2 rounded-full ${
              connected
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="hidden sm:inline">
            {connected ? "Wi-Fi Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Tiny Status Dot (visible when controls are hidden) */}
      {!showControls && (
        <div
          title={connected ? "Connected" : "Disconnected"}
          className="fixed bottom-2.5 right-2.5 z-40 size-2 rounded-full transition-opacity duration-500 pointer-events-none"
          style={{
            backgroundColor: connected ? "#10b981" : "#f59e0b",
            opacity: connected ? 0.35 : 0.8,
            boxShadow: connected ? "0 0 6px rgba(16,185,129,0.5)" : "none",
          }}
        />
      )}
    </div>
  )
}

const root = document.getElementById("overlay-root")!
createRoot(root).render(<BroadcastCanvas />)

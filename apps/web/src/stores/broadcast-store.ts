import { create } from "zustand"
import type { BroadcastTheme, VerseRenderData } from "@/types"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import { getManager, getSessionId } from "@/streams/setup"

const THEMES_KEY = "openbeam:themes"
const BROADCAST_SETTINGS_KEY = "openbeam:broadcast-settings"

interface PersistedBroadcastSettings {
  activeThemeId?: string
  altActiveThemeId?: string
  mainEnabled?: boolean
  altEnabled?: boolean
  mainWiredDisplayId?: string | number | null
  altWiredDisplayId?: string | number | null
  wiredAutoConnect?: boolean
}

function loadBroadcastSettings(): PersistedBroadcastSettings {
  try {
    const raw = localStorage.getItem(BROADCAST_SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt storage
  }
  return {}
}

function persistBroadcastSettings(settings: Partial<PersistedBroadcastSettings>) {
  try {
    const current = loadBroadcastSettings()
    localStorage.setItem(BROADCAST_SETTINGS_KEY, JSON.stringify({ ...current, ...settings }))
  } catch {
    // ignore storage errors
  }
}

function emitTo(label: string, payload: unknown) {
  const mgr = getManager()
  if (!mgr) return
  mgr.overlay.send("verse:update", { label, ...(payload as Record<string, unknown>) })
}

function loadThemesFromStorage(): BroadcastTheme[] {
  try {
    const raw = localStorage.getItem(THEMES_KEY)
    if (raw) {
      const custom = JSON.parse(raw) as BroadcastTheme[]
      // Merge: always use fresh builtins + persisted custom themes
      return [
        ...BUILTIN_THEMES,
        ...custom.filter((t) => !t.builtin && !BUILTIN_THEMES.some((b) => b.id === t.id)),
      ]
    }
  } catch {
    // ignore corrupt storage
  }
  return [...BUILTIN_THEMES]
}

function persistThemes(themes: BroadcastTheme[]) {
  try {
    // Only persist custom (non-builtin) themes — builtins are always loaded fresh
    const custom = themes.filter((t) => !t.builtin)
    localStorage.setItem(THEMES_KEY, JSON.stringify(custom))
  } catch {
    // ignore storage errors
  }
}

type SelectedElement = "verse" | "reference" | null

interface BroadcastState {
  themes: BroadcastTheme[]
  activeThemeId: string
  altActiveThemeId: string
  mainEnabled: boolean
  altEnabled: boolean
  isLive: boolean
  liveVerse: VerseRenderData | null
  previewVerse: VerseRenderData | null

  // Wired display state
  isWiredActive: boolean
  wiredDisplayId: number | string | null
  isMainWiredActive: boolean
  mainWiredDisplayId: number | string | null
  isAltWiredActive: boolean
  altWiredDisplayId: number | string | null
  wiredAutoConnect: boolean
  setWiredAutoConnect: (auto: boolean) => void
  setMainWiredDisplayId: (id: number | string | null) => void
  setAltWiredDisplayId: (id: number | string | null) => void
  setWiredActive: (active: boolean, displayId?: number | string | null, output?: "main" | "alt") => void
  openWiredDisplay: (
    displayId?: number | string,
    output?: "main" | "alt",
    options?: { fullscreen?: boolean; alwaysOnTop?: boolean }
  ) => Promise<void>
  openBothWiredDisplays: (
    options?: { fullscreen?: boolean; alwaysOnTop?: boolean }
  ) => Promise<void>
  closeWiredDisplay: (output?: "main" | "alt") => Promise<void>
  toggleWiredDisplay: (output?: "main" | "alt") => Promise<void>

  // Designer state
  isDesignerOpen: boolean
  editingThemeId: string | null
  draftTheme: BroadcastTheme | null
  selectedElement: SelectedElement

  // Theme management
  loadThemes: () => void
  saveTheme: (theme: BroadcastTheme) => void
  deleteTheme: (id: string) => void
  duplicateTheme: (id: string) => void
  renameTheme: (id: string, name: string) => void
  importTheme: (theme: BroadcastTheme) => BroadcastTheme
  setActiveTheme: (id: string) => void
  setAltActiveTheme: (id: string) => void
  setMainEnabled: (enabled: boolean) => void
  setAltEnabled: (enabled: boolean) => void
  setLive: (live: boolean) => void
  setLiveVerse: (verse: VerseRenderData | null) => void
  setPreviewVerse: (verse: VerseRenderData | null) => void
  projectVerse: (verse: VerseRenderData) => void
  syncBroadcastOutput: () => void
  syncBroadcastOutputFor: (outputId: string) => void

  // Designer actions
  setDesignerOpen: (open: boolean) => void
  startEditing: (themeId: string) => void
  updateDraft: (updates: Partial<BroadcastTheme>) => void
  updateDraftNested: (path: string, value: unknown) => void
  saveDraft: () => void
  discardDraft: () => void
  setSelectedElement: (el: SelectedElement) => void
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".")
  const isIndex = (key: string) => /^\d+$/.test(key)
  const result: Record<string, unknown> = Array.isArray(obj) ? [...obj] as unknown as Record<string, unknown> : { ...obj }

  let current: Record<string, unknown> | unknown[] = result
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    const nextKey = keys[i + 1]
    const currentIndex = isIndex(key) ? Number(key) : key
    const existing = (current as Record<string, unknown> | unknown[])[currentIndex as keyof typeof current]
    const nextContainer = Array.isArray(existing)
      ? [...existing]
      : existing && typeof existing === "object"
        ? { ...(existing as Record<string, unknown>) }
        : isIndex(nextKey)
          ? []
          : {}

    ;(current as Record<string, unknown> | unknown[])[currentIndex as keyof typeof current] = nextContainer as never
    current = nextContainer as Record<string, unknown> | unknown[]
  }

  const lastKey = keys[keys.length - 1]
  const lastIndex = isIndex(lastKey) ? Number(lastKey) : lastKey
  ;(current as Record<string, unknown> | unknown[])[lastIndex as keyof typeof current] = value as never

  return result
}

const initialThemes = loadThemesFromStorage()
const savedBroadcast = loadBroadcastSettings()
let browserMainWiredPopup: Window | null = null
let browserAltWiredPopup: Window | null = null

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  themes: initialThemes,
  activeThemeId: savedBroadcast.activeThemeId ?? BUILTIN_THEMES[0].id,
  altActiveThemeId: savedBroadcast.altActiveThemeId ?? BUILTIN_THEMES[0].id,
  mainEnabled: savedBroadcast.mainEnabled ?? true,
  altEnabled: savedBroadcast.altEnabled ?? true,
  isLive: false,
  liveVerse: null,
  previewVerse: null,
  isDesignerOpen: false,
  editingThemeId: null,
  draftTheme: null,
  selectedElement: null,

  loadThemes: () => {
    const themes = loadThemesFromStorage()
    set({ themes })
  },
  saveTheme: (theme) => {
    set((s) => {
      const themes = s.themes.some((t) => t.id === theme.id)
        ? s.themes.map((t) => (t.id === theme.id ? theme : t))
        : [...s.themes, theme]
      persistThemes(themes)
      return { themes }
    })
  },
  deleteTheme: (id) => {
    const before = get()
    const target = before.themes.find((t) => t.id === id)
    if (!target || target.builtin) return

    const themes = before.themes.filter((t) => t.id !== id)
    persistThemes(themes)
    set({ themes })

    // Anything still pointing at the deleted theme falls back to the default.
    const fallback = BUILTIN_THEMES[0].id
    if (before.activeThemeId === id) get().setActiveTheme(fallback)
    if (before.altActiveThemeId === id) get().setAltActiveTheme(fallback)
    if (before.editingThemeId === id) {
      set({ editingThemeId: null, draftTheme: null, selectedElement: null })
    }
  },
  renameTheme: (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    set((s) => {
      const target = s.themes.find((t) => t.id === id)
      if (!target || target.builtin) return {}
      const themes = s.themes.map((t) =>
        t.id === id ? { ...t, name: trimmed, updatedAt: Date.now() } : t
      )
      persistThemes(themes)
      const draftTheme =
        s.editingThemeId === id && s.draftTheme ? { ...s.draftTheme, name: trimmed } : s.draftTheme
      return { themes, draftTheme }
    })
  },
  importTheme: (theme) => {
    const imported: BroadcastTheme = {
      ...theme,
      id: crypto.randomUUID(),
      builtin: false,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((s) => {
      const themes = [...s.themes, imported]
      persistThemes(themes)
      return { themes }
    })
    return imported
  },
  duplicateTheme: (id) => {
    const s = get()
    const source = s.themes.find((t) => t.id === id)
    if (!source) return
    const newTheme: BroadcastTheme = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} Copy`,
      builtin: false,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((s) => {
      const themes = [...s.themes, newTheme]
      persistThemes(themes)
      return { themes }
    })
  },
  syncBroadcastOutputFor: (outputId: string) => {
    const s = get()
    const enabled = outputId === "alt" ? s.altEnabled : s.mainEnabled
    if (!enabled) return
    const themeId = outputId === "alt" ? s.altActiveThemeId : s.activeThemeId
    const label = outputId === "alt" ? "broadcast-alt" : "broadcast"
    const theme = s.themes.find((t) => t.id === themeId) ?? s.themes[0]
    if (!theme) return

    emitTo(label, {
      theme,
      verse: s.liveVerse,
      enabled: true,
    })
  },
  syncBroadcastOutput: () => {
    get().syncBroadcastOutputFor("main")
    get().syncBroadcastOutputFor("alt")
  },
  setActiveTheme: (activeThemeId) => {
    set({ activeThemeId })
    const s = get()
    persistBroadcastSettings({
      activeThemeId,
      altActiveThemeId: s.altActiveThemeId,
      mainEnabled: s.mainEnabled,
      altEnabled: s.altEnabled,
    })
    get().syncBroadcastOutputFor("main")
  },
  setAltActiveTheme: (altActiveThemeId) => {
    set({ altActiveThemeId })
    const s = get()
    persistBroadcastSettings({
      activeThemeId: s.activeThemeId,
      altActiveThemeId,
      mainEnabled: s.mainEnabled,
      altEnabled: s.altEnabled,
    })
    get().syncBroadcastOutputFor("alt")
  },
  setMainEnabled: (mainEnabled) => {
    set({ mainEnabled })
    const s = get()
    persistBroadcastSettings({
      activeThemeId: s.activeThemeId,
      altActiveThemeId: s.altActiveThemeId,
      mainEnabled,
      altEnabled: s.altEnabled,
    })
    if (mainEnabled) {
      get().syncBroadcastOutputFor("main")
    } else {
      emitTo("broadcast", { theme: null, verse: null, enabled: false })
    }
  },
  setAltEnabled: (altEnabled) => {
    set({ altEnabled })
    const s = get()
    persistBroadcastSettings({
      activeThemeId: s.activeThemeId,
      altActiveThemeId: s.altActiveThemeId,
      mainEnabled: s.mainEnabled,
      altEnabled,
    })
    if (altEnabled) {
      get().syncBroadcastOutputFor("alt")
    } else {
      emitTo("broadcast-alt", { theme: null, verse: null, enabled: false })
    }
  },

  // Wired display
  isWiredActive: false,
  wiredDisplayId: null,
  isMainWiredActive: false,
  mainWiredDisplayId: savedBroadcast.mainWiredDisplayId ?? null,
  isAltWiredActive: false,
  altWiredDisplayId: savedBroadcast.altWiredDisplayId ?? null,
  wiredAutoConnect: savedBroadcast.wiredAutoConnect ?? true,
  setWiredAutoConnect: (wiredAutoConnect) => {
    set({ wiredAutoConnect })
    persistBroadcastSettings({ wiredAutoConnect })
  },
  setMainWiredDisplayId: (mainWiredDisplayId) => {
    set({ mainWiredDisplayId })
    persistBroadcastSettings({ mainWiredDisplayId })
  },
  setAltWiredDisplayId: (altWiredDisplayId) => {
    set({ altWiredDisplayId })
    persistBroadcastSettings({ altWiredDisplayId })
  },
  setWiredActive: (isWiredActive, wiredDisplayId = null, output = "main") => {
    if (output === "alt") {
      set((s) => ({
        isAltWiredActive: isWiredActive,
        altWiredDisplayId: wiredDisplayId,
        isWiredActive: s.isMainWiredActive || isWiredActive,
        wiredDisplayId: s.mainWiredDisplayId || wiredDisplayId,
      }))
    } else {
      set((s) => ({
        isMainWiredActive: isWiredActive,
        mainWiredDisplayId: wiredDisplayId,
        isWiredActive: isWiredActive || s.isAltWiredActive,
        wiredDisplayId: wiredDisplayId || s.altWiredDisplayId,
      }))
    }
  },
  openWiredDisplay: async (displayId, output = "main", options = {}) => {
    const isAlt = output === "alt"
    if (typeof window !== "undefined" && window.electronAPI?.openWiredDisplay) {
      try {
        const res = await window.electronAPI.openWiredDisplay({
          displayId,
          options: {
            fullscreen: options.fullscreen !== false,
            alwaysOnTop: options.alwaysOnTop ?? true,
            output,
            session: getSessionId(),
          },
        })
        if (res.success) {
          if (isAlt) {
            set((s) => ({
              isAltWiredActive: true,
              altWiredDisplayId: res.displayId ?? s.altWiredDisplayId ?? null,
              isWiredActive: true,
              wiredDisplayId: s.mainWiredDisplayId ?? res.displayId ?? null,
            }))
          } else {
            set((s) => ({
              isMainWiredActive: true,
              mainWiredDisplayId: res.displayId ?? s.mainWiredDisplayId ?? null,
              isWiredActive: true,
              wiredDisplayId: res.displayId ?? null,
            }))
          }
          get().syncBroadcastOutput()
          setTimeout(() => get().syncBroadcastOutput(), 400)
          setTimeout(() => get().syncBroadcastOutput(), 1200)
        }
      } catch (err) {
        console.error(`[broadcast] Failed to open wired display for ${output}:`, err)
      }
    } else if (typeof window !== "undefined") {
      try {
        const url = `${window.location.origin}/overlay.html?role=overlay&output=${output}&session=${getSessionId()}`
        const popupName = isAlt ? "SharonAG_Wired_Alt_Overlay" : "SharonAG_Wired_Main_Overlay"
        let popup = isAlt ? browserAltWiredPopup : browserMainWiredPopup

        if (popup && !popup.closed) {
          popup.focus()
        } else {
          popup = window.open(
            url,
            popupName,
            "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no"
          )
          if (isAlt) {
            browserAltWiredPopup = popup
          } else {
            browserMainWiredPopup = popup
          }
        }
        if (isAlt) {
          set((s) => ({
            isAltWiredActive: true,
            altWiredDisplayId: 2,
            isWiredActive: true,
            wiredDisplayId: s.mainWiredDisplayId ?? 2,
          }))
        } else {
          set({
            isMainWiredActive: true,
            mainWiredDisplayId: 1,
            isWiredActive: true,
            wiredDisplayId: 1,
          })
        }
        get().syncBroadcastOutput()
        setTimeout(() => get().syncBroadcastOutput(), 800)
      } catch (err) {
        console.error(`[broadcast] Failed to open wired window popup for ${output}:`, err)
      }
    }
  },
  openBothWiredDisplays: async (options = {}) => {
    const s = get()
    // Open Main screen first
    await s.openWiredDisplay(s.mainWiredDisplayId ?? undefined, "main", options)

    // Check how many external displays are connected
    let externalCount = 0
    if (typeof window !== "undefined" && window.electronAPI?.getDisplays) {
      try {
        const list = await window.electronAPI.getDisplays()
        externalCount = list.filter((d) => !d.isPrimary).length
      } catch {}
    }

    // Only open Alt screen if we have at least 2 external displays or an explicit altDisplayId
    if (externalCount >= 2 || s.altWiredDisplayId) {
      await s.openWiredDisplay(s.altWiredDisplayId ?? undefined, "alt", options)
    }
  },
  closeWiredDisplay: async (output) => {
    if (typeof window !== "undefined" && window.electronAPI?.closeWiredDisplay) {
      try {
        await window.electronAPI.closeWiredDisplay(output ? { output } : undefined)
        if (!output) {
          set({
            isWiredActive: false,
            wiredDisplayId: null,
            isMainWiredActive: false,
            mainWiredDisplayId: null,
            isAltWiredActive: false,
            altWiredDisplayId: null,
          })
        } else if (output === "alt") {
          set((s) => ({
            isAltWiredActive: false,
            altWiredDisplayId: null,
            isWiredActive: s.isMainWiredActive,
            wiredDisplayId: s.mainWiredDisplayId,
          }))
        } else {
          set((s) => ({
            isMainWiredActive: false,
            mainWiredDisplayId: null,
            isWiredActive: s.isAltWiredActive,
            wiredDisplayId: s.altWiredDisplayId,
          }))
        }
      } catch (err) {
        console.error(`[broadcast] Failed to close wired display for ${output}:`, err)
      }
    } else {
      if (!output || output === "main") {
        if (browserMainWiredPopup && !browserMainWiredPopup.closed) {
          browserMainWiredPopup.close()
          browserMainWiredPopup = null
        }
        set((s) => ({
          isMainWiredActive: false,
          mainWiredDisplayId: null,
          isWiredActive: output ? s.isAltWiredActive : false,
          wiredDisplayId: output ? s.altWiredDisplayId : null,
        }))
      }
      if (!output || output === "alt") {
        if (browserAltWiredPopup && !browserAltWiredPopup.closed) {
          browserAltWiredPopup.close()
          browserAltWiredPopup = null
        }
        set((s) => ({
          isAltWiredActive: false,
          altWiredDisplayId: null,
          isWiredActive: output ? s.isMainWiredActive : false,
          wiredDisplayId: output ? s.mainWiredDisplayId : null,
        }))
      }
    }
  },
  toggleWiredDisplay: async (output) => {
    const s = get()
    if (output) {
      const active = output === "alt" ? s.isAltWiredActive : s.isMainWiredActive
      if (active) {
        await s.closeWiredDisplay(output)
      } else {
        const targetId = output === "alt" ? s.altWiredDisplayId : s.mainWiredDisplayId
        await s.openWiredDisplay(targetId ?? undefined, output)
      }
      return
    }

    // Default without argument: if ANY screen is active, disconnect
    if (s.isWiredActive || s.isMainWiredActive || s.isAltWiredActive) {
      await s.closeWiredDisplay()
      return
    }

    // Otherwise connect intelligently based on number of external monitors
    let externalCount = 0
    if (typeof window !== "undefined" && window.electronAPI?.getDisplays) {
      try {
        const list = await window.electronAPI.getDisplays()
        externalCount = list.filter((d) => !d.isPrimary).length
      } catch {}
    }

    if (externalCount >= 2) {
      await s.openBothWiredDisplays()
    } else {
      await s.openWiredDisplay(s.mainWiredDisplayId ?? undefined, "main")
    }
  },

  setLive: (isLive) => {
    set({ isLive })
    if (isLive && get().wiredAutoConnect) {
      get().openBothWiredDisplays()
    }
  },
  setLiveVerse: (liveVerse) => {
    set({ liveVerse })
    get().syncBroadcastOutput()
  },
  setPreviewVerse: (previewVerse) => {
    set({ previewVerse })
  },
  projectVerse: (verse) => {
    set({ liveVerse: verse, previewVerse: verse, isLive: true })
    if (get().wiredAutoConnect) {
      get().openBothWiredDisplays()
    }
    get().syncBroadcastOutput()
  },

  // Designer
  setDesignerOpen: (isDesignerOpen) => {
    if (!isDesignerOpen) {
      set({ isDesignerOpen, editingThemeId: null, draftTheme: null, selectedElement: null })
    } else {
      set({ isDesignerOpen })
    }
  },
  startEditing: (themeId) => {
    const theme = get().themes.find((t) => t.id === themeId)
    if (!theme) return
    set({
      editingThemeId: themeId,
      draftTheme: { ...theme, updatedAt: Date.now() },
      selectedElement: null,
    })
  },
  updateDraft: (updates) =>
    set((s) => ({
      draftTheme: s.draftTheme ? { ...s.draftTheme, ...updates, updatedAt: Date.now() } : null,
    })),
  updateDraftNested: (path, value) =>
    set((s) => ({
      draftTheme: s.draftTheme
        ? (setNestedValue(s.draftTheme as unknown as Record<string, unknown>, path, value) as unknown as BroadcastTheme)
        : null,
    })),
  saveDraft: () => {
    const { draftTheme } = get()
    if (!draftTheme) return
    if (draftTheme.builtin) {
      const customTheme = {
        ...draftTheme,
        id: crypto.randomUUID(),
        name: `${draftTheme.name} (Custom)`,
        builtin: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      set((s) => {
        const themes = [...s.themes, customTheme]
        persistThemes(themes)
        return {
          themes,
          activeThemeId: customTheme.id,
          editingThemeId: customTheme.id,
          draftTheme: customTheme,
        }
      })
    } else {
      get().saveTheme(draftTheme)
    }
  },
  discardDraft: () => {
    const { editingThemeId } = get()
    if (editingThemeId) {
      get().startEditing(editingThemeId)
    }
  },
  setSelectedElement: (selectedElement) => set({ selectedElement }),
}))

// Synchronize wired display status from Electron
if (typeof window !== "undefined" && window.electronAPI) {
  window.electronAPI.getWiredDisplayStatus?.().then((status) => {
    if (status) {
      useBroadcastStore.getState().setWiredActive(status.active, status.displayId)
    }
  }).catch(() => {})

  window.electronAPI.onWiredDisplayStatusChange?.((status) => {
    useBroadcastStore.getState().setWiredActive(status.active, status.displayId)
  })
}

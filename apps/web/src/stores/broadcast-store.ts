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

function persistBroadcastSettings(settings: Required<PersistedBroadcastSettings>) {
  try {
    localStorage.setItem(BROADCAST_SETTINGS_KEY, JSON.stringify(settings))
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

  // Wired display state
  isWiredActive: boolean
  wiredDisplayId: number | null
  wiredAutoConnect: boolean
  setWiredAutoConnect: (auto: boolean) => void
  setWiredActive: (active: boolean, displayId?: number | null) => void
  openWiredDisplay: (displayId?: number | string) => Promise<void>
  closeWiredDisplay: () => Promise<void>
  toggleWiredDisplay: () => Promise<void>

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
let browserWiredPopup: Window | null = null

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  themes: initialThemes,
  activeThemeId: savedBroadcast.activeThemeId ?? BUILTIN_THEMES[0].id,
  altActiveThemeId: savedBroadcast.altActiveThemeId ?? BUILTIN_THEMES[0].id,
  mainEnabled: savedBroadcast.mainEnabled ?? true,
  altEnabled: savedBroadcast.altEnabled ?? true,
  isLive: false,
  liveVerse: null,
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
  wiredAutoConnect: true,
  setWiredAutoConnect: (wiredAutoConnect) => set({ wiredAutoConnect }),
  setWiredActive: (isWiredActive, wiredDisplayId = null) => set({ isWiredActive, wiredDisplayId }),
  openWiredDisplay: async (displayId) => {
    if (typeof window !== "undefined" && window.electronAPI?.openWiredDisplay) {
      try {
        const res = await window.electronAPI.openWiredDisplay({
          displayId,
          options: {
            fullscreen: true,
            alwaysOnTop: true,
            output: "main",
            session: getSessionId(),
          },
        })
        if (res.success) {
          set({ isWiredActive: true, wiredDisplayId: res.displayId ?? null })
        }
      } catch (err) {
        console.error("[broadcast] Failed to open wired display:", err)
      }
    } else if (typeof window !== "undefined") {
      try {
        const url = `${window.location.origin}/overlay.html?role=overlay&output=main&session=${getSessionId()}`
        if (browserWiredPopup && !browserWiredPopup.closed) {
          browserWiredPopup.focus()
        } else {
          browserWiredPopup = window.open(
            url,
            "SharonAG_Wired_Overlay",
            "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no"
          )
        }
        set({ isWiredActive: true, wiredDisplayId: 1 })
      } catch (err) {
        console.error("[broadcast] Failed to open wired window popup:", err)
      }
    }
  },
  closeWiredDisplay: async () => {
    if (typeof window !== "undefined" && window.electronAPI?.closeWiredDisplay) {
      try {
        await window.electronAPI.closeWiredDisplay()
        set({ isWiredActive: false, wiredDisplayId: null })
      } catch (err) {
        console.error("[broadcast] Failed to close wired display:", err)
      }
    } else {
      if (browserWiredPopup && !browserWiredPopup.closed) {
        browserWiredPopup.close()
        browserWiredPopup = null
      }
      set({ isWiredActive: false, wiredDisplayId: null })
    }
  },
  toggleWiredDisplay: async () => {
    const s = get()
    if (s.isWiredActive) {
      await s.closeWiredDisplay()
    } else {
      await s.openWiredDisplay()
    }
  },

  setLive: (isLive) => {
    set({ isLive })
    if (isLive && get().wiredAutoConnect) {
      get().openWiredDisplay()
    }
  },
  setLiveVerse: (liveVerse) => {
    set({ liveVerse })
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

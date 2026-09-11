import { create } from "zustand"
import { createId } from "@paralleldrive/cuid2"

const STORAGE_KEY = "openbeam:settings"
const KEY_STORAGE_KEY = "openbeam:deepgram-key"
const DEFAULT_KEY = "e5e3d90f142670adaed0a57f48a2249148c4dc8f"

interface SettingsState {
  sessionId: string
  deepgramApiKey: string | null
  isKeyLoaded: boolean
  activeTranslationId: number
  audioDeviceId: string | null
  gain: number
  autoMode: boolean
  confidenceThreshold: number
  cooldownMs: number
  onboardingComplete: boolean

  setDeepgramApiKey: (key: string | null) => void
  setIsKeyLoaded: (loaded: boolean) => void
  setActiveTranslationId: (id: number) => void
  setAudioDeviceId: (id: string | null) => void
  setGain: (gain: number) => void
  setAutoMode: (auto: boolean) => void
  setConfidenceThreshold: (threshold: number) => void
  setCooldownMs: (ms: number) => void
  setOnboardingComplete: (complete: boolean) => void
}

type PersistedSettings = Omit<
  SettingsState,
  | "isKeyLoaded"
  | "setDeepgramApiKey"
  | "setIsKeyLoaded"
  | "setActiveTranslationId"
  | "setAudioDeviceId"
  | "setGain"
  | "setAutoMode"
  | "setConfidenceThreshold"
  | "setCooldownMs"
  | "setOnboardingComplete"
>

function loadSettingsFromStorage(): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt storage
  }
  return {}
}

function loadInitialDeepgramKey(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.deepgramApiKey && typeof parsed.deepgramApiKey === "string") {
        return parsed.deepgramApiKey
      }
    }
  } catch {
    // ignore
  }

  try {
    const sessionKey = sessionStorage.getItem(KEY_STORAGE_KEY)
    if (sessionKey) return sessionKey
  } catch {
    // ignore
  }

  try {
    const localKey = localStorage.getItem(KEY_STORAGE_KEY)
    if (localKey) return localKey
  } catch {
    // ignore
  }

  return DEFAULT_KEY
}

function persistSettings(state: SettingsState) {
  try {
    const payload: PersistedSettings = {
      sessionId: state.sessionId,
      deepgramApiKey: state.deepgramApiKey,
      activeTranslationId: state.activeTranslationId,
      audioDeviceId: state.audioDeviceId,
      gain: state.gain,
      autoMode: state.autoMode,
      confidenceThreshold: state.confidenceThreshold,
      cooldownMs: state.cooldownMs,
      onboardingComplete: state.onboardingComplete,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage errors
  }
}

function persistDeepgramKey(key: string | null) {
  try {
    if (key) {
      sessionStorage.setItem(KEY_STORAGE_KEY, key)
      localStorage.setItem(KEY_STORAGE_KEY, key)
    } else {
      sessionStorage.removeItem(KEY_STORAGE_KEY)
      localStorage.removeItem(KEY_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

const persisted = loadSettingsFromStorage()
const initialKey = loadInitialDeepgramKey()

export const useSettingsStore = create<SettingsState>((set, get) => ({
  sessionId: persisted.sessionId ?? createId(),
  deepgramApiKey: initialKey,
  isKeyLoaded: true,
  activeTranslationId: persisted.activeTranslationId ?? 1,
  audioDeviceId: persisted.audioDeviceId ?? null,
  gain: persisted.gain ?? 1.0,
  autoMode: persisted.autoMode ?? false,
  confidenceThreshold: persisted.confidenceThreshold ?? 0.8,
  cooldownMs: persisted.cooldownMs ?? 2500,
  onboardingComplete: persisted.onboardingComplete ?? false,

  setIsKeyLoaded: (isKeyLoaded) => set({ isKeyLoaded }),
  setDeepgramApiKey: (deepgramApiKey) => {
    set({ deepgramApiKey, isKeyLoaded: true })
    persistSettings(get())
    persistDeepgramKey(deepgramApiKey)
    if (typeof window !== "undefined" && window.electronAPI?.setDeepgramKey) {
      window.electronAPI.setDeepgramKey(deepgramApiKey).catch(console.error)
    }
  },
  setActiveTranslationId: (activeTranslationId) => {
    set({ activeTranslationId })
    persistSettings(get())
  },
  setAudioDeviceId: (audioDeviceId) => {
    set({ audioDeviceId })
    persistSettings(get())
  },
  setGain: (gain) => {
    set({ gain })
    persistSettings(get())
  },
  setAutoMode: (autoMode) => {
    set({ autoMode })
    persistSettings(get())
  },
  setConfidenceThreshold: (confidenceThreshold) => {
    set({ confidenceThreshold })
    persistSettings(get())
  },
  setCooldownMs: (cooldownMs) => {
    set({ cooldownMs })
    persistSettings(get())
  },
  setOnboardingComplete: (onboardingComplete) => {
    set({ onboardingComplete })
    persistSettings(get())
  },
}))

// Load key asynchronously from Electron secure storage on startup
if (typeof window !== "undefined" && window.electronAPI?.getDeepgramKey) {
  window.electronAPI
    .getDeepgramKey()
    .then((key) => {
      const activeKey = (key && typeof key === "string" && key.trim()) ? key.trim() : (initialKey || DEFAULT_KEY)
      useSettingsStore.setState({ deepgramApiKey: activeKey, isKeyLoaded: true })
      persistDeepgramKey(activeKey)
      persistSettings(useSettingsStore.getState())
      if ((!key || !key.trim()) && activeKey) {
        window.electronAPI?.setDeepgramKey(activeKey).catch(console.error)
      }
    })
    .catch((err) => {
      console.error("[settings] Failed to load key from Electron secure storage:", err)
      useSettingsStore.setState({ isKeyLoaded: true })
    })
}

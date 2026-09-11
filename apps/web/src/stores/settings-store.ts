import { create } from "zustand"
import { createId } from "@paralleldrive/cuid2"

const STORAGE_KEY = "openbeam:settings"
const KEY_STORAGE_KEY = "openbeam:deepgram-key"

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
  | "deepgramApiKey"
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

function loadSettingsFromStorage(): Partial<PersistedSettings> & {
  deepgramApiKey?: string
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt storage
  }
  return {}
}

/**
 * Read the Deepgram API key from `sessionStorage`.
 *
 * @security MITIGATION (not elimination) of CWE-312 (cleartext storage of
 *   sensitive information). `sessionStorage` is still plaintext at rest while
 *   the tab is open and remains reachable from any script running on this
 *   origin (XSS, malicious extensions). The trade-off vs. `localStorage` is
 *   lifetime: the key is wiped on tab close, bounding exposure to a working
 *   session and avoiding long-lived disk persistence.
 *
 *   For stronger guarantees the next step is IndexedDB + Web Crypto with a
 *   user passphrase — out of scope for this BYO-key UX.
 */
function loadDeepgramKey(): string | null {
  try {
    return sessionStorage.getItem(KEY_STORAGE_KEY)
  } catch {
    return null
  }
}

function persistSettings(state: SettingsState) {
  try {
    const payload: PersistedSettings = {
      sessionId: state.sessionId,
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

/**
 * Persist the Deepgram API key to `sessionStorage`.
 *
 * @security DO NOT change this to `localStorage`. CodeQL flags long-lived
 *   plaintext credential storage (CWE-312). `sessionStorage` is the
 *   intentional compromise: the key survives reloads within the tab so users
 *   aren't re-prompted each refresh, but it never reaches disk and is cleared
 *   on tab close.
 */
function persistDeepgramKey(key: string | null) {
  try {
    if (key) {
      sessionStorage.setItem(KEY_STORAGE_KEY, key)
    } else {
      sessionStorage.removeItem(KEY_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

const persisted = loadSettingsFromStorage()

// Migrate any previously persisted key out of localStorage into sessionStorage,
// then purge it from disk so cleartext copies aren't left behind.
const migratedKey = typeof persisted.deepgramApiKey === "string"
  ? persisted.deepgramApiKey
  : null
if (migratedKey) {
  persistDeepgramKey(migratedKey)
}
if ("deepgramApiKey" in persisted) {
  delete (persisted as { deepgramApiKey?: unknown }).deepgramApiKey
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  } catch {
    // ignore storage errors
  }
}

const DEFAULT_KEY = "e5e3d90f142670adaed0a57f48a2249148c4dc8f"
const hasElectron = typeof window !== "undefined" && Boolean(window.electronAPI?.getDeepgramKey)
const initialDeepgramKey = loadDeepgramKey() ?? migratedKey ?? (!hasElectron ? DEFAULT_KEY : null)

export const useSettingsStore = create<SettingsState>((set, get) => ({
  sessionId: persisted.sessionId ?? createId(),
  deepgramApiKey: initialDeepgramKey,
  isKeyLoaded: !hasElectron,
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
      const activeKey = key || DEFAULT_KEY
      useSettingsStore.setState({ deepgramApiKey: activeKey, isKeyLoaded: true })
      persistDeepgramKey(activeKey)
      if (!key && DEFAULT_KEY) {
        window.electronAPI?.setDeepgramKey(DEFAULT_KEY).catch(console.error)
      }
    })
    .catch((err) => {
      console.error("[settings] Failed to load key from Electron secure storage:", err)
      useSettingsStore.setState({ isKeyLoaded: true })
    })
}

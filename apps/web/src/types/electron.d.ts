export interface DisplayInfo {
  id: number
  index: number
  label: string
  connectorLabel?: string
  isPrimary: boolean
  bounds: { x: number; y: number; width: number; height: number }
  width: number
  height: number
}

export interface NetworkInfo {
  port: number
  ips: { name: string; address: string }[]
}

export interface SingleWiredStatus {
  active: boolean
  displayId: number | null
}

export interface WiredDisplayStatus extends SingleWiredStatus {
  output?: "main" | "alt"
  main?: SingleWiredStatus
  alt?: SingleWiredStatus
  status?: {
    main: SingleWiredStatus
    alt: SingleWiredStatus
  }
}

export interface ElectronAPI {
  platform: string
  versions: Record<string, string>

  getDeepgramKey: () => Promise<string | null>
  setDeepgramKey: (key: string | null) => Promise<boolean>

  getDisplays: () => Promise<DisplayInfo[]>
  openWiredDisplay: (args?: {
    displayId?: number | string
    options?: {
      fullscreen?: boolean
      output?: "main" | "alt"
      session?: string
      alwaysOnTop?: boolean
    }
  }) => Promise<{ success: boolean; displayId?: number; output?: string; error?: string }>
  closeWiredDisplay: (args?: { output?: "main" | "alt" }) => Promise<{ success: boolean }>
  getWiredDisplayStatus: (args?: { output?: "main" | "alt" }) => Promise<WiredDisplayStatus>
  getNetworkInfo: () => Promise<NetworkInfo>
  onWiredDisplayStatusChange: (
    callback: (status: WiredDisplayStatus) => void
  ) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
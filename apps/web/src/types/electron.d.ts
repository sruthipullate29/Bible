export interface DisplayInfo {
  id: number
  index: number
  label: string
  isPrimary: boolean
  bounds: { x: number; y: number; width: number; height: number }
  width: number
  height: number
}

export interface NetworkInfo {
  port: number
  ips: { name: string; address: string }[]
}

export interface WiredDisplayStatus {
  active: boolean
  displayId: number | null
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
  }) => Promise<{ success: boolean; displayId?: number; error?: string }>
  closeWiredDisplay: () => Promise<{ success: boolean }>
  getWiredDisplayStatus: () => Promise<WiredDisplayStatus>
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
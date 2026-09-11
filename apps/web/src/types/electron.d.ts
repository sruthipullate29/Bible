interface Window {
  electronAPI?: {
    platform: string
    versions: Record<string, string>

    getDeepgramKey: () => Promise<string | null>
    setDeepgramKey: (key: string | null) => Promise<boolean>
  }
}
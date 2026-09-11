const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,

  getDeepgramKey: () =>
    ipcRenderer.invoke('deepgram:get-key'),

  setDeepgramKey: (key) =>
    ipcRenderer.invoke('deepgram:set-key', key),

  getDisplays: () =>
    ipcRenderer.invoke('displays:get'),

  openWiredDisplay: (args) =>
    ipcRenderer.invoke('wired-display:open', args),

  closeWiredDisplay: () =>
    ipcRenderer.invoke('wired-display:close'),

  getWiredDisplayStatus: () =>
    ipcRenderer.invoke('wired-display:status'),

  getNetworkInfo: () =>
    ipcRenderer.invoke('network:get-ips'),

  onWiredDisplayStatusChange: (callback) => {
    const subscription = (_event, value) => callback(value)
    ipcRenderer.on('wired-display:status-change', subscription)
    return () => ipcRenderer.removeListener('wired-display:status-change', subscription)
  },
})
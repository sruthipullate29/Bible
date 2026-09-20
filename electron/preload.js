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

  closeWiredDisplay: (args) =>
    ipcRenderer.invoke('wired-display:close', args),

  getWiredDisplayStatus: (args) =>
    ipcRenderer.invoke('wired-display:status', args),

  getNetworkInfo: () =>
    ipcRenderer.invoke('network:get-ips'),

  onWiredDisplayStatusChange: (callback) => {
    const subscription = (_event, value) => callback(value)
    ipcRenderer.on('wired-display:status-change', subscription)
    return () => ipcRenderer.removeListener('wired-display:status-change', subscription)
  },

  // Local Database and File Queue I/O
  saveQueueToDb: (items) =>
    ipcRenderer.invoke('queue:save-local-db', items),

  loadQueueFromDb: () =>
    ipcRenderer.invoke('queue:load-local-db'),

  exportQueueFile: (args) =>
    ipcRenderer.invoke('queue:export-file', args),

  importQueueFile: () =>
    ipcRenderer.invoke('queue:import-file'),
})
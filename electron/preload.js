const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,

  getDeepgramKey: () =>
    ipcRenderer.invoke('deepgram:get-key'),

  setDeepgramKey: (key) =>
    ipcRenderer.invoke('deepgram:set-key', key),
})
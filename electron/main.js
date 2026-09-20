const { app, BrowserWindow, Menu, shell, ipcMain, Tray, nativeImage, safeStorage, screen, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { startServer, stopServer } = require('./server')

try {
  app.setPath('userData', path.join(app.getPath('appData'), 'sharon-ag-desktop'))
} catch {}

const wiredWindows = {
  main: { window: null, displayId: null },
  alt: { window: null, displayId: null },
}

function getDisplayList() {
  try {
    const displays = screen.getAllDisplays()
    const primary = screen.getPrimaryDisplay()
    const primaryId = primary.id
    const nonPrimary = displays.filter((d) => d.id !== primaryId)

    return displays.map((d, index) => {
      const isPrimary = d.id === primaryId
      let connectorLabel = ''
      if (isPrimary) {
        connectorLabel = 'Primary / Control Monitor'
      } else {
        const extIndex = nonPrimary.findIndex((np) => np.id === d.id)
        if (extIndex === 0) {
          connectorLabel = 'HDMI 1 / Main Screen'
        } else if (extIndex === 1) {
          connectorLabel = 'HDMI 2 / Alternative Screen'
        } else {
          connectorLabel = `HDMI ${extIndex + 1} / External Screen`
        }
      }

      return {
        id: d.id,
        index: index + 1,
        label: `Display ${index + 1}: ${d.bounds.width}x${d.bounds.height} (${connectorLabel})`,
        connectorLabel,
        isPrimary,
        bounds: d.bounds,
        width: d.bounds.width,
        height: d.bounds.height,
      }
    })
  } catch (err) {
    console.error('[electron] Failed to get display list:', err)
    return []
  }
}

function getWiredStatus(output) {
  const mainActive = Boolean(wiredWindows.main?.window && !wiredWindows.main.window.isDestroyed())
  const altActive = Boolean(wiredWindows.alt?.window && !wiredWindows.alt.window.isDestroyed())

  const fullStatus = {
    main: {
      active: mainActive,
      displayId: mainActive ? wiredWindows.main.displayId : null,
    },
    alt: {
      active: altActive,
      displayId: altActive ? wiredWindows.alt.displayId : null,
    },
    active: mainActive || altActive,
    displayId: mainActive ? wiredWindows.main.displayId : (altActive ? wiredWindows.alt.displayId : null),
  }

  if (output && fullStatus[output]) {
    return {
      ...fullStatus[output],
      status: fullStatus,
    }
  }
  return fullStatus
}

function openWiredDisplay(displayId, options = {}) {
  try {
    const displays = screen.getAllDisplays()
    const primary = screen.getPrimaryDisplay()
    const primaryId = primary.id
    const nonPrimary = displays.filter((d) => d.id !== primaryId)
    const output = (options.output === 'alt') ? 'alt' : 'main'

    // If requesting alt screen but there is only 1 external display and no specific displayId was set:
    // Skip alt output so it doesn't open on top of the main screen and cover it with black
    if (output === 'alt' && !displayId && nonPrimary.length < 2) {
      console.warn('[electron] Alt output requested, but only 1 external display is connected. Skipping Alt to protect Main screen.')
      return { success: false, error: 'Only 1 external display available; skipped second screen.' }
    }

    let target = null
    if (displayId) {
      target = displays.find((d) => String(d.id) === String(displayId))
    }
    if (!target) {
      // Intelligently assign default display for 2 HDMI outputs:
      // If output is main: default to 1st external display (HDMI 1), else primary
      // If output is alt: default to 2nd external display (HDMI 2) if present
      if (output === 'alt') {
        target = nonPrimary[1] || (nonPrimary.length > 1 ? nonPrimary[0] : null)
      } else {
        target = nonPrimary[0] || primary
      }
    }

    if (!target) {
      target = primary
    }

    const isPrimaryScreen = target.id === primaryId
    // If opening on primary screen (no external screen available), do not force fullscreen alwaysOnTop over the control UI
    const isFullscreen = isPrimaryScreen ? false : (options.fullscreen !== false)
    const isAlwaysOnTop = isPrimaryScreen ? false : (options.alwaysOnTop ?? true)
    const session = options.session || 'default'

    // Close existing window for this specific output channel if already running
    if (wiredWindows[output]?.window && !wiredWindows[output].window.isDestroyed()) {
      wiredWindows[output].window.close()
      wiredWindows[output] = { window: null, displayId: null }
    }

    const { bounds } = target
    const title = output === 'alt'
      ? 'Sharon AG – HDMI 2 Alternative / Stage Output'
      : (isPrimaryScreen ? 'Sharon AG – HDMI Preview (No external display connected)' : 'Sharon AG – HDMI 1 Main Presentation Output')

    const winWidth = isPrimaryScreen ? Math.min(1280, Math.floor(bounds.width * 0.85)) : bounds.width
    const winHeight = isPrimaryScreen ? Math.min(720, Math.floor(bounds.height * 0.85)) : bounds.height
    const winX = isPrimaryScreen ? bounds.x + Math.floor((bounds.width - winWidth) / 2) : bounds.x
    const winY = isPrimaryScreen ? bounds.y + Math.floor((bounds.height - winHeight) / 2) : bounds.y

    const win = new BrowserWindow({
      x: winX,
      y: winY,
      width: winWidth,
      height: winHeight,
      fullscreen: false,
      frame: !isFullscreen,
      alwaysOnTop: isAlwaysOnTop,
      backgroundColor: '#000000',
      title,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    if (isFullscreen) {
      win.setBounds(bounds)
      win.setFullScreen(true)
    }

    wiredWindows[output] = {
      window: win,
      displayId: target.id,
    }

    const targetUrl = `${API_URL}/overlay.html?role=overlay&output=${output}&session=${session}`
    win.loadURL(targetUrl)

    win.on('closed', () => {
      wiredWindows[output] = { window: null, displayId: null }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('wired-display:status-change', {
          output,
          active: false,
          displayId: null,
          main: getWiredStatus('main'),
          alt: getWiredStatus('alt'),
          status: getWiredStatus(),
        })
      }
    })

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wired-display:status-change', {
        output,
        active: true,
        displayId: target.id,
        main: getWiredStatus('main'),
        alt: getWiredStatus('alt'),
        status: getWiredStatus(),
      })
    }

    return { success: true, displayId: target.id, output }
  } catch (err) {
    console.error('[electron] Failed to open wired display:', err)
    return { success: false, error: err.message }
  }
}

function closeWiredDisplay(output) {
  if (output && wiredWindows[output]) {
    if (wiredWindows[output].window && !wiredWindows[output].window.isDestroyed()) {
      wiredWindows[output].window.close()
    }
    wiredWindows[output] = { window: null, displayId: null }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wired-display:status-change', {
        output,
        active: false,
        displayId: null,
        main: getWiredStatus('main'),
        alt: getWiredStatus('alt'),
        status: getWiredStatus(),
      })
    }
    return { success: true }
  }

  for (const key of ['main', 'alt']) {
    if (wiredWindows[key]?.window && !wiredWindows[key].window.isDestroyed()) {
      wiredWindows[key].window.close()
    }
    wiredWindows[key] = { window: null, displayId: null }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('wired-display:status-change', {
      active: false,
      displayId: null,
      main: { active: false, displayId: null },
      alt: { active: false, displayId: null },
      status: getWiredStatus(),
    })
  }
  return { success: true }
}

function getLocalNetworkIps() {
  const nets = os.networkInterfaces()
  const results = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({ name, address: net.address })
      }
    }
  }
  return results
}

ipcMain.handle('displays:get', () => getDisplayList())
ipcMain.handle('wired-display:open', (_event, { displayId, options } = {}) => openWiredDisplay(displayId, options))
ipcMain.handle('wired-display:close', (_event, { output } = {}) => closeWiredDisplay(output))
ipcMain.handle('wired-display:status', (_event, { output } = {}) => getWiredStatus(output))
ipcMain.handle('network:get-ips', () => ({
  port: API_PORT,
  ips: getLocalNetworkIps(),
}))

function getSecureStoragePath() {
  const userData = app.getPath('userData')
  if (!fs.existsSync(userData)) {
    fs.mkdirSync(userData, { recursive: true })
  }
  return path.join(userData, 'secure-settings.json')
}

const DEFAULT_KEY = 'e5e3d90f142670adaed0a57f48a2249148c4dc8f'

function getStoredDeepgramKey() {
  try {
    const filePath = getSecureStoragePath()
    if (!fs.existsSync(filePath)) {
      return process.env.DEEPGRAM_API_KEY || DEFAULT_KEY
    }
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw)
    if (data.encryptedKey && safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(data.encryptedKey, 'base64'))
      if (decrypted && decrypted.trim()) {
        return decrypted.trim()
      }
    }
    if (data.key && typeof data.key === 'string' && data.key.trim()) {
      return data.key.trim()
    }
    return DEFAULT_KEY
  } catch (err) {
    console.error('[electron] Failed to get Deepgram key from secure storage:', err)
    return DEFAULT_KEY
  }
}

function setStoredDeepgramKey(key) {
  try {
    const filePath = getSecureStoragePath()
    if (!key) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      return true
    }
    let payload = {}
    if (safeStorage.isEncryptionAvailable()) {
      payload.encryptedKey = safeStorage.encryptString(key).toString('base64')
    } else {
      payload.key = key
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
    return true
  } catch (err) {
    console.error('[electron] Failed to save Deepgram key to secure storage:', err)
    return false
  }
}

ipcMain.handle('deepgram:get-key', () => {
  return getStoredDeepgramKey()
})

ipcMain.handle('deepgram:set-key', (_event, key) => {
  return setStoredDeepgramKey(key)
})

// ─── Queue Local Database & File I/O ───────────────────────────────────────────
function getQueueDbPath() {
  const userData = app.getPath('userData')
  if (!fs.existsSync(userData)) {
    fs.mkdirSync(userData, { recursive: true })
  }
  return path.join(userData, 'queue_database.json')
}

ipcMain.handle('queue:save-local-db', (_event, items) => {
  try {
    const filePath = getQueueDbPath()
    fs.writeFileSync(
      filePath,
      JSON.stringify({ version: '1.0', updatedAt: new Date().toISOString(), items: items || [] }, null, 2),
      'utf8'
    )
    return { success: true, path: filePath }
  } catch (err) {
    console.error('[electron] Failed to save queue to local DB:', err)
    return { success: false, error: err.message }
  }
})

ipcMain.handle('queue:load-local-db', () => {
  try {
    const filePath = getQueueDbPath()
    if (!fs.existsSync(filePath)) {
      return { success: true, items: [] }
    }
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw)
    return {
      success: true,
      items: Array.isArray(data) ? data : (data.items || []),
      updatedAt: data.updatedAt,
      path: filePath,
    }
  } catch (err) {
    console.error('[electron] Failed to load queue from local DB:', err)
    return { success: false, error: err.message, items: [] }
  }
})

ipcMain.handle('queue:export-file', async (_event, { filename, content, filters }) => {
  try {
    const defaultName = filename || `sharon_ag_queue_${new Date().toISOString().slice(0, 10)}.json`
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Download / Save Queue File',
      defaultPath: path.join(app.getPath('downloads'), defaultName),
      filters: filters || [
        { name: 'JSON Database (*.json)', extensions: ['json'] },
        { name: 'Text Set List (*.txt)', extensions: ['txt'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    })
    if (canceled || !filePath) return { canceled: true }
    fs.writeFileSync(filePath, content, 'utf8')
    return { success: true, filePath }
  } catch (err) {
    console.error('[electron] Failed to export queue file:', err)
    return { success: false, error: err.message }
  }
})

ipcMain.handle('queue:import-file', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Open / Import Saved Queue File',
      defaultPath: app.getPath('downloads'),
      filters: [
        { name: 'JSON Queue File (*.json)', extensions: ['json'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true }
    const content = fs.readFileSync(filePaths[0], 'utf8')
    return { success: true, content, filePath: filePaths[0] }
  } catch (err) {
    console.error('[electron] Failed to import queue file:', err)
    return { success: false, error: err.message }
  }
})

let mainWindow = null
let tray = null

const API_PORT = 4001
const API_URL = `http://127.0.0.1:${API_PORT}`

// ─── Create main window ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Sharon AG – Bible Presentation',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0f0f11',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  })

  // Load from local embedded server (handles both API and static UI with zero latency)
  const localIndex = path.join(__dirname, 'dist', 'index.html')

  const tryLoad = async () => {
    try {
      await mainWindow.loadURL(API_URL)
      console.log('[electron] Loaded embedded server:', API_URL)
    } catch (err) {
      console.warn('[electron] Embedded server load failed:', err.message)

      if (fs.existsSync(localIndex)) {
        console.log('[electron] Loading local file:', localIndex)
        await mainWindow.loadFile(localIndex)
      } else {
        console.error('[electron] Local index.html not found:', localIndex)
      }
    }
  }

  tryLoad()

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('localhost')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  // Set native menu
  const template = [
    {
      label: 'Sharon AG',
      submenu: [
        { label: 'About Sharon AG', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', role: 'resetZoom' },
        { label: 'Zoom In', role: 'zoomIn' },
        { label: 'Zoom Out', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', role: 'minimize' },
        { label: 'Maximize', role: 'zoom' },
        { type: 'separator' },
        { label: 'Close', role: 'close' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── App lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    const userData = app.getPath('userData')
    await startServer(API_PORT, { userData })
    console.log('[electron] Embedded server started on port', API_PORT)
  } catch (err) {
    console.error('[electron] Error starting embedded server:', err)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer()
    app.quit()
  }
})

app.on('before-quit', () => {
  stopServer()
})

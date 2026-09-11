const { app, BrowserWindow, Menu, shell, ipcMain, Tray, nativeImage, safeStorage, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { startServer, stopServer } = require('./server')

let wiredWindow = null
let wiredDisplayId = null

function getDisplayList() {
  try {
    const displays = screen.getAllDisplays()
    const primaryId = screen.getPrimaryDisplay().id
    return displays.map((d, index) => ({
      id: d.id,
      index: index + 1,
      label: `Display ${index + 1}: ${d.bounds.width}x${d.bounds.height}${d.id === primaryId ? ' (Primary / Control)' : ' (External / Projector)'}`,
      isPrimary: d.id === primaryId,
      bounds: d.bounds,
      width: d.bounds.width,
      height: d.bounds.height,
    }))
  } catch (err) {
    console.error('[electron] Failed to get display list:', err)
    return []
  }
}

function openWiredDisplay(displayId, options = {}) {
  try {
    const displays = screen.getAllDisplays()
    let target = null
    if (displayId) {
      target = displays.find((d) => String(d.id) === String(displayId))
    }
    if (!target) {
      // Prefer non-primary display (external monitor/projector)
      target = displays.find((d) => d.id !== screen.getPrimaryDisplay().id) || screen.getPrimaryDisplay()
    }

    if (wiredWindow && !wiredWindow.isDestroyed()) {
      wiredWindow.close()
      wiredWindow = null
    }

    const { bounds } = target
    const isFullscreen = options.fullscreen !== false
    const output = options.output || 'main'
    const session = options.session || 'default'

    wiredWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      fullscreen: isFullscreen,
      frame: !isFullscreen,
      alwaysOnTop: options.alwaysOnTop ?? true,
      backgroundColor: '#000000',
      title: 'Sharon AG – Wired Presentation Output',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    wiredDisplayId = target.id

    const targetUrl = `${API_URL}/overlay.html?role=overlay&output=${output}&session=${session}`
    wiredWindow.loadURL(targetUrl)

    wiredWindow.on('closed', () => {
      wiredWindow = null
      wiredDisplayId = null
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('wired-display:status-change', { active: false, displayId: null })
      }
    })

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wired-display:status-change', { active: true, displayId: target.id })
    }

    return { success: true, displayId: target.id }
  } catch (err) {
    console.error('[electron] Failed to open wired display:', err)
    return { success: false, error: err.message }
  }
}

function closeWiredDisplay() {
  if (wiredWindow && !wiredWindow.isDestroyed()) {
    wiredWindow.close()
    wiredWindow = null
    wiredDisplayId = null
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wired-display:status-change', { active: false, displayId: null })
    }
    return { success: true }
  }
  return { success: false }
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
ipcMain.handle('wired-display:close', () => closeWiredDisplay())
ipcMain.handle('wired-display:status', () => ({
  active: Boolean(wiredWindow && !wiredWindow.isDestroyed()),
  displayId: wiredDisplayId,
}))
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

function getStoredDeepgramKey() {
  try {
    const filePath = getSecureStoragePath()
    if (!fs.existsSync(filePath)) {
      return process.env.DEEPGRAM_API_KEY || null
    }
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw)
    if (data.encryptedKey && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(data.encryptedKey, 'base64'))
    }
    return data.key || null
  } catch (err) {
    console.error('[electron] Failed to get Deepgram key from secure storage:', err)
    return null
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
    await startServer(API_PORT)
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

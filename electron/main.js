const { app, BrowserWindow, Menu, shell, ipcMain, Tray, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { startServer, stopServer } = require('./server')

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

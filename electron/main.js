const { app, BrowserWindow, Menu, shell, ipcMain, Tray, nativeImage } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')

let mainWindow = null
let tray = null
let apiServer = null

const isDev = process.env.NODE_ENV === 'development'
const API_PORT = 4001
const API_URL = `http://localhost:${API_PORT}`

// ─── Start embedded Node API server ────────────────────────────────────────────
function startApiServer() {
  // In packaged app: resources are in process.resourcesPath
  const appRoot = app.isPackaged
    ? path.join(process.resourcesPath, '..', 'app')
    : path.join(__dirname, '..')

  const serverScript = path.join(appRoot, 'apps', 'server', 'dev-server.mjs')

  // DB lives in extraResources/server/data or the source tree
  const dbPath = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'data', 'openbeam.db')
    : path.join(appRoot, 'apps', 'server', 'data', 'openbeam.db')

  if (!fs.existsSync(serverScript)) {
    console.warn('[electron] API server script not found at', serverScript)
    return
  }

  console.log('[electron] Starting API server:', serverScript)
  console.log('[electron] DB path:', dbPath)

  apiServer = spawn(process.execPath, [serverScript], {
    cwd: appRoot,
    env: { ...process.env, NODE_ENV: 'production', DB_PATH: dbPath },
    stdio: 'pipe',
  })
  apiServer.stdout.on('data', (d) => console.log('[api]', d.toString().trim()))
  apiServer.stderr.on('data', (d) => console.error('[api]', d.toString().trim()))
  apiServer.on('exit', (code) => console.log('[api] exited with code', code))
}

function stopApiServer() {
  if (apiServer) {
    apiServer.kill()
    apiServer = null
  }
}

// ─── Wait for API to be ready ───────────────────────────────────────────────────
function waitForApi(url, retries = 20, delayMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const tryConnect = () => {
      http.get(`${url}/api/health`, (res) => {
        if (res.statusCode === 200) return resolve()
        retry()
      }).on('error', retry)
    }
    const retry = () => {
      attempts++
      if (attempts >= retries) return reject(new Error('API server did not start in time'))
      setTimeout(tryConnect, delayMs)
    }
    tryConnect()
  })
}

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

  const appRoot = app.isPackaged
    ? path.join(process.resourcesPath, '..', 'app')
    : path.join(__dirname, '..')

  const distDir = path.join(appRoot, 'apps', 'web', 'dist')
  const indexFile = path.join(distDir, 'index.html')

  if (fs.existsSync(indexFile)) {
    mainWindow.loadFile(indexFile)
  } else {
    mainWindow.loadURL('http://localhost:3000')
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
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
  startApiServer()

  // Give the API server a moment to start (up to 10s)
  try {
    await waitForApi(API_URL, 20, 500)
    console.log('[electron] API server is ready')
  } catch (e) {
    console.warn('[electron] API server not ready, opening UI anyway:', e.message)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopApiServer()
    app.quit()
  }
})

app.on('before-quit', () => {
  stopApiServer()
})

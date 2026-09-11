const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')
const { WebSocketServer, WebSocket } = require('ws')

let serverInstance = null
let db = null
const overlayClients = new Set()

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const remoteState = {
  on_air: false,
  active_theme: null,
  live_verse: null,
  queue_length: 0,
  confidence_threshold: 0.75,
}

function resolveDbPath() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'data', 'openbeam.db') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'server', 'data', 'openbeam.db') : null,
    path.join(__dirname, 'data', 'openbeam.db'),
    path.join(__dirname, '..', 'apps', 'server', 'data', 'openbeam.db'),
  ].filter(Boolean)

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log('[server] Found database at:', p)
      return p
    }
  }
  console.warn('[server] Database not found in candidate paths, using default:', candidates[0])
  return candidates[0]
}

function resolveDistDir() {
  const candidates = [
    path.join(__dirname, 'dist'),
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar', 'dist') : null,
    path.join(__dirname, '..', 'apps', 'web', 'dist'),
  ].filter(Boolean)

  for (const p of candidates) {
    if (fs.existsSync(path.join(p, 'index.html'))) {
      console.log('[server] Found web dist at:', p)
      return p
    }
  }
  return path.join(__dirname, 'dist')
}

function startServer(port = 4001) {
  if (serverInstance) return Promise.resolve(serverInstance)

  const dbPath = resolveDbPath()
  try {
    db = new DatabaseSync(dbPath)
    console.log('[server] SQLite database connected successfully')
  } catch (err) {
    console.error('[server] Failed to open SQLite database:', err)
  }

  const distDir = resolveDistDir()

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const pathname = parsedUrl.pathname

      const sendJson = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(data))
      }

      const sendError = (status, message) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: message }))
      }

      // ── API ROUTES ───────────────────────────────────────────────────────────
      if (pathname.startsWith('/api/')) {
        try {
          if (!db) return sendError(503, 'Database unavailable')

          // 1. Health
          if (pathname === '/api/health') {
            return sendJson(200, {
              status: 'ok',
              service: 'sharon-ag-server',
              version: '0.1.0',
              capabilities: {
                bible: true,
                detection: { direct: true, semantic: false, quotation: true },
                stt: true,
                overlay: true,
              },
            })
          }

          // 2. Translations
          if (pathname === '/api/bible/translations') {
            const translations = db.prepare(
              'SELECT id, abbreviation, title, language, license, is_copyrighted = 1 as is_copyrighted, is_downloaded = 1 as is_downloaded FROM translations ORDER BY id'
            ).all()
            return sendJson(200, translations)
          }

          // 3. Books
          if (pathname === '/api/bible/books') {
            const translationId = Number(parsedUrl.searchParams.get('translationId') || 1)
            const books = db.prepare(
              'SELECT id, translation_id, book_number, name, abbreviation, testament FROM books WHERE translation_id = ? ORDER BY book_number'
            ).all(translationId)
            return sendJson(200, books)
          }

          // 4. Chapter
          const chapterMatch = pathname.match(/^\/api\/bible\/chapter\/(\d+)\/(\d+)\/(\d+)$/)
          if (chapterMatch) {
            const translationId = Number(chapterMatch[1])
            const bookNumber = Number(chapterMatch[2])
            const chapter = Number(chapterMatch[3])
            const verses = db.prepare(
              'SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text FROM verses WHERE translation_id = ? AND book_number = ? AND chapter = ? ORDER BY verse'
            ).all(translationId, bookNumber, chapter)
            return sendJson(200, verses)
          }

          // 5. Verse by reference
          const verseMatch = pathname.match(/^\/api\/bible\/verse\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/)
          if (verseMatch) {
            const translationId = Number(verseMatch[1])
            const bookNumber = Number(verseMatch[2])
            const chapter = Number(verseMatch[3])
            const verse = Number(verseMatch[4])
            const row = db.prepare(
              'SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text FROM verses WHERE translation_id = ? AND book_number = ? AND chapter = ? AND verse = ?'
            ).get(translationId, bookNumber, chapter, verse)
            return sendJson(200, row || null)
          }

          // 6. Verse by ID
          const verseIdMatch = pathname.match(/^\/api\/bible\/verse\/(\d+)$/)
          if (verseIdMatch) {
            const id = Number(verseIdMatch[1])
            const row = db.prepare(
              'SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text FROM verses WHERE id = ?'
            ).get(id)
            return sendJson(200, row || null)
          }

          // 7. Search
          if (pathname === '/api/bible/search') {
            const query = parsedUrl.searchParams.get('q') || ''
            const translationId = Number(parsedUrl.searchParams.get('translationId') || 1)
            const limit = Number(parsedUrl.searchParams.get('limit') || 50)
            if (!query.trim()) return sendJson(200, [])

            try {
              const cleanQuery = query.replace(/[^\w\s\u0C00-\u0C7F]/gi, '').trim()
              if (cleanQuery) {
                const ftsRows = db.prepare(`
                  SELECT v.id, v.translation_id, v.book_number, v.book_name, v.book_abbreviation, v.chapter, v.verse, v.text
                  FROM verses_fts f
                  JOIN verses v ON f.rowid = v.id
                  WHERE verses_fts MATCH ? AND v.translation_id = ?
                  LIMIT ?
                `).all(cleanQuery, translationId, limit)
                if (ftsRows.length > 0) return sendJson(200, ftsRows)
              }
            } catch {
              // fallback to LIKE
            }

            const likeRows = db.prepare(
              'SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text FROM verses WHERE translation_id = ? AND text LIKE ? LIMIT ?'
            ).all(translationId, `%${query}%`, limit)
            return sendJson(200, likeRows)
          }

          // 8. Cross references
          const crossRefMatch = pathname.match(/^\/api\/bible\/cross-references\/(\d+)\/(\d+)\/(\d+)$/)
          if (crossRefMatch) {
            const bookNumber = Number(crossRefMatch[1])
            const chapter = Number(crossRefMatch[2])
            const verse = Number(crossRefMatch[3])
            const book = db.prepare('SELECT name FROM books WHERE translation_id = 1 AND book_number = ?').get(bookNumber)
            if (!book) return sendJson(200, [])
            const fromRef = `${book.name} ${chapter}:${verse}`
            const refs = db.prepare('SELECT from_ref, to_ref, votes FROM cross_references WHERE from_ref = ? ORDER BY votes DESC LIMIT 10').all(fromRef)
            return sendJson(200, refs)
          }

          // 9. Verses for search
          const versesSearchMatch = pathname.match(/^\/api\/bible\/verses-for-search\/(\d+)$/)
          if (versesSearchMatch) {
            const translationId = Number(versesSearchMatch[1])
            const rows = db.prepare(
              'SELECT book_number, book_name, chapter, verse, text FROM verses WHERE translation_id = ?'
            ).all(translationId)
            return sendJson(200, rows)
          }

          // 10. Status & Control
          if (pathname === '/api/detection/status') {
            return sendJson(200, { has_direct: true, has_semantic: false, has_cloud: false })
          }

          if (pathname === '/api/remote/status') {
            if (req.method === 'POST') {
              let body = ''
              req.on('data', chunk => { body += chunk })
              req.on('end', () => {
                try {
                  const updates = JSON.parse(body || '{}')
                  Object.assign(remoteState, updates)
                  sendJson(200, { success: true })
                } catch (e) {
                  sendError(400, e.message)
                }
              })
              return
            }
            return sendJson(200, remoteState)
          }

          if (pathname === '/api/v1/control') {
            return sendJson(200, { success: true })
          }

          return sendError(404, `API route not found: ${pathname}`)
        } catch (err) {
          console.error('[server] API error:', err)
          return sendError(500, err.message)
        }
      }

      // ── STATIC FILE SERVING ──────────────────────────────────────────────────
      let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname)

      // Prevent directory traversal
      if (!filePath.startsWith(distDir)) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          // SPA fallback: return index.html for non-asset routes
          const ext = path.extname(pathname)
          if (!ext || ext === '.html') {
            const indexHtml = path.join(distDir, 'index.html')
            fs.readFile(indexHtml, (err2, data) => {
              if (err2) {
                res.writeHead(404, { 'Content-Type': 'text/plain' })
                res.end('Sharon AG Web Assets Not Found. Please run: npm run build')
                return
              }
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
              res.end(data)
            })
            return
          }
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Not found')
          return
        }

        const ext = path.extname(filePath).toLowerCase()
        const contentType = MIME_TYPES[ext] || 'application/octet-stream'

        res.writeHead(200, { 'Content-Type': contentType })
        fs.createReadStream(filePath).pipe(res)
      })
    })

    // ── WEBSOCKET SERVER ───────────────────────────────────────────────────────
    const wss = new WebSocketServer({ noServer: true })

    server.on('upgrade', (req, socket, head) => {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      if (parsedUrl.pathname.startsWith('/ws/')) {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req)
        })
      } else {
        socket.destroy()
      }
    })

    wss.on('connection', (ws) => {
      overlayClients.add(ws)
      ws.on('message', (message) => {
        try {
          const str = message.toString()
          for (const client of overlayClients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(str)
            }
          }
        } catch { }
      })
      ws.on('close', () => {
        overlayClients.delete(ws)
      })
    })

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[server] Port ${port} is already in use. Assuming server already running.`)
        resolve(server)
      } else {
        reject(err)
      }
    })

    server.listen(port, '127.0.0.1', () => {
      console.log(`[server] Sharon AG Server listening on http://127.0.0.1:${port}`)
      serverInstance = server
      resolve(server)
    })
  })
}

function stopServer() {
  if (serverInstance) {
    serverInstance.close()
    serverInstance = null
  }
}

module.exports = { startServer, stopServer }

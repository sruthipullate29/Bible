import http from "node:http"
import { WebSocketServer, WebSocket } from "ws"
import { DatabaseSync } from "node:sqlite"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH || path.resolve(__dirname, "data/openbeam.db")
const PORT = Number(process.env.PORT || 4001)

console.log(`[openbeam-api] Opening Bible DB at ${dbPath}...`)
const db = new DatabaseSync(dbPath)

// App state for remote / live control
const remoteState = {
  on_air: false,
  active_theme: null,
  live_verse: null,
  queue_length: 0,
  confidence_threshold: 0.75,
}

// Active overlay / broadcast clients
const overlayClients = new Set()

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  const pathname = parsedUrl.pathname

  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { "Content-Type": "application/json" })
    res.end(JSON.stringify(data))
  }

  const sendError = (statusCode, message) => {
    res.writeHead(statusCode, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: message }))
  }

  try {
    // 1. Health check
    if (pathname === "/api/health") {
      return sendJson(200, {
        status: "ok",
        service: "openbeam-server",
        version: "0.1.0",
        capabilities: {
          bible: true,
          detection: { direct: true, semantic: false, quotation: true },
          stt: true,
          overlay: true,
        },
      })
    }

    // 2. Bible Translations
    if (pathname === "/api/bible/translations") {
      const translations = db.prepare("SELECT id, abbreviation, title, language, license, is_copyrighted = 1 as is_copyrighted, is_downloaded = 1 as is_downloaded FROM translations ORDER BY id").all()
      return sendJson(200, translations)
    }

    // 3. Books
    if (pathname === "/api/bible/books") {
      const translationId = Number(parsedUrl.searchParams.get("translationId") || 1)
      const books = db.prepare("SELECT id, translation_id, book_number, name, abbreviation, testament FROM books WHERE translation_id = ? ORDER BY book_number").all(translationId)
      return sendJson(200, books)
    }

    // 4. Chapter: /api/bible/chapter/:translationId/:bookNumber/:chapter
    const chapterMatch = pathname.match(/^\/api\/bible\/chapter\/(\d+)\/(\d+)\/(\d+)$/)
    if (chapterMatch) {
      const translationId = Number(chapterMatch[1])
      const bookNumber = Number(chapterMatch[2])
      const chapter = Number(chapterMatch[3])
      const verses = db.prepare(
        "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text FROM verses WHERE translation_id = ? AND book_number = ? AND chapter = ? ORDER BY verse"
      ).all(translationId, bookNumber, chapter)
      return sendJson(200, verses)
    }

    // 5. Verse by ref: /api/bible/verse/:translationId/:bookNumber/:chapter/:verse
    const verseMatch = pathname.match(/^\/api\/bible\/verse\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/)
    if (verseMatch) {
      const translationId = Number(verseMatch[1])
      const bookNumber = Number(verseMatch[2])
      const chapter = Number(verseMatch[3])
      const verse = Number(verseMatch[4])
      const row = db.prepare(
        "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text FROM verses WHERE translation_id = ? AND book_number = ? AND chapter = ? AND verse = ?"
      ).get(translationId, bookNumber, chapter, verse)
      if (!row) return sendJson(200, null)
      return sendJson(200, row)
    }

    // 6. Verse by ID: /api/bible/verse/:id
    const verseIdMatch = pathname.match(/^\/api\/bible\/verse\/(\d+)$/)
    if (verseIdMatch) {
      const id = Number(verseIdMatch[1])
      const row = db.prepare(
        "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text FROM verses WHERE id = ?"
      ).get(id)
      if (!row) return sendJson(200, null)
      return sendJson(200, row)
    }

    // 7. Search: /api/bible/search?q=...&translationId=...&limit=...
    if (pathname === "/api/bible/search") {
      const query = parsedUrl.searchParams.get("q") || ""
      const translationId = Number(parsedUrl.searchParams.get("translationId") || 1)
      const limit = Number(parsedUrl.searchParams.get("limit") || 50)

      if (!query.trim()) return sendJson(200, [])

      // Try FTS search first, fallback to LIKE
      try {
        const cleanQuery = query.replace(/[^\w\s\u0C00-\u0C7F]/gi, "").trim()
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
        // Fallback to LIKE
      }

      const likeRows = db.prepare(
        "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text FROM verses WHERE translation_id = ? AND text LIKE ? LIMIT ?"
      ).all(translationId, `%${query}%`, limit)
      return sendJson(200, likeRows)
    }

    // 8. Cross references: /api/bible/cross-references/:bookNumber/:chapter/:verse
    const crossRefMatch = pathname.match(/^\/api\/bible\/cross-references\/(\d+)\/(\d+)\/(\d+)$/)
    if (crossRefMatch) {
      const bookNumber = Number(crossRefMatch[1])
      const chapter = Number(crossRefMatch[2])
      const verse = Number(crossRefMatch[3])
      const book = db.prepare("SELECT name FROM books WHERE translation_id = 1 AND book_number = ?").get(bookNumber)
      if (!book) return sendJson(200, [])
      const fromRef = `${book.name} ${chapter}:${verse}`
      const refs = db.prepare("SELECT from_ref, to_ref, votes FROM cross_references WHERE from_ref = ? ORDER BY votes DESC LIMIT 10").all(fromRef)
      return sendJson(200, refs)
    }

    // 9. Verses for search (Fuse.js index prefetch): /api/bible/verses-for-search/:translationId
    const versesSearchMatch = pathname.match(/^\/api\/bible\/verses-for-search\/(\d+)$/)
    if (versesSearchMatch) {
      const translationId = Number(versesSearchMatch[1])
      const rows = db.prepare(
        "SELECT book_number, book_name, chapter, verse, text FROM verses WHERE translation_id = ?"
      ).all(translationId)
      return sendJson(200, rows)
    }

    // 10. Detection status
    if (pathname === "/api/detection/status") {
      return sendJson(200, { has_direct: true, has_semantic: false, has_cloud: false })
    }

    // 11. Remote status
    if (pathname === "/api/remote/status") {
      if (req.method === "POST") {
        let body = ""
        req.on("data", chunk => { body += chunk })
        req.on("end", () => {
          try {
            const updates = JSON.parse(body || "{}")
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

    // 12. Control command
    if (pathname === "/api/v1/control") {
      return sendJson(200, { success: true })
    }

    sendError(404, `Not found: ${pathname}`)
  } catch (err) {
    console.error("[openbeam-api] Error:", err)
    sendError(500, err.message)
  }
})

// WebSocket Server
const wss = new WebSocketServer({ noServer: true })

server.on("upgrade", (req, socket, head) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  if (parsedUrl.pathname.startsWith("/ws/")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req)
    })
  } else {
    socket.destroy()
  }
})

wss.on("connection", (ws, req) => {
  overlayClients.add(ws)

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString())
      if (data.type === "overlay:ready" || data.event === "overlay:ready") {
        // Send initial state if any
      }
      // Broadcast to other overlay clients
      for (const client of overlayClients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message.toString())
        }
      }
    } catch {
      // ignore
    }
  })

  ws.on("close", () => {
    overlayClients.delete(ws)
  })
})

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[openbeam-api] OpenBeam API server listening on http://localhost:${PORT}`)
})

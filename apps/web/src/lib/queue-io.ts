import type { QueueItem } from "@/types"

export function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function serializeQueue(items: QueueItem[]): string {
  const payload = {
    app: "Sharon AG Bible Presentation",
    version: "1.0",
    exportedAt: new Date().toISOString(),
    totalVerses: items.length,
    items,
  }
  return JSON.stringify(payload, null, 2)
}

export function serializeQueueText(items: QueueItem[]): string {
  const dateStr = new Date().toLocaleString()
  const lines: string[] = [
    "==================================================",
    "SHARON AG – BIBLE PRESENTATION QUEUE SET LIST",
    `Exported: ${dateStr}`,
    `Total Verses: ${items.length}`,
    "==================================================",
    "",
  ]

  items.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.reference}`)
    if (item.verse.text) {
      lines.push(`   ${item.verse.text.trim()}`)
    }
    if (item.secondaryVerse?.text) {
      const secBook = item.secondaryVerse.book_name || "Telugu"
      lines.push(`   [${secBook}] ${item.secondaryVerse.text.trim()}`)
    }
    lines.push("")
  })

  return lines.join("\n")
}

export async function exportQueueAsJson(
  items: QueueItem[],
  customFilename?: string
): Promise<{ success: boolean; filePath?: string; filename: string }> {
  const dateSlug = new Date().toISOString().slice(0, 10)
  const filename = customFilename || `sharon_ag_queue_${dateSlug}.json`
  const content = serializeQueue(items)

  if (typeof window !== "undefined" && window.electronAPI?.exportQueueFile) {
    try {
      const res = await window.electronAPI.exportQueueFile({
        filename,
        content,
        filters: [
          { name: "JSON Database File (*.json)", extensions: ["json"] },
          { name: "All Files (*.*)", extensions: ["*"] },
        ],
      })
      if (res.canceled) {
        return { success: false, filename }
      }
      if (res.success && res.filePath) {
        return { success: true, filePath: res.filePath, filename }
      }
    } catch (e) {
      console.warn("[queue-io] Native export failed, falling back to browser download:", e)
    }
  }

  // Fallback to standard browser file download
  downloadBlob(filename, content, "application/json")
  return { success: true, filename }
}

export async function exportQueueAsText(
  items: QueueItem[],
  customFilename?: string
): Promise<{ success: boolean; filePath?: string; filename: string }> {
  const dateSlug = new Date().toISOString().slice(0, 10)
  const filename = customFilename || `sharon_ag_queue_${dateSlug}.txt`
  const content = serializeQueueText(items)

  if (typeof window !== "undefined" && window.electronAPI?.exportQueueFile) {
    try {
      const res = await window.electronAPI.exportQueueFile({
        filename,
        content,
        filters: [
          { name: "Text Set List (*.txt)", extensions: ["txt"] },
          { name: "All Files (*.*)", extensions: ["*"] },
        ],
      })
      if (res.canceled) {
        return { success: false, filename }
      }
      if (res.success && res.filePath) {
        return { success: true, filePath: res.filePath, filename }
      }
    } catch (e) {
      console.warn("[queue-io] Native export failed, falling back to browser download:", e)
    }
  }

  // Fallback to standard browser file download
  downloadBlob(filename, content, "text/plain")
  return { success: true, filename }
}

export function parseQueueFile(text: string): QueueItem[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Invalid JSON format. Please select a valid queue database file.")
  }

  let itemsArray: unknown[] = []
  if (Array.isArray(parsed)) {
    itemsArray = parsed
  } else if (parsed && typeof parsed === "object" && "items" in parsed && Array.isArray((parsed as any).items)) {
    itemsArray = (parsed as any).items
  } else {
    throw new Error("File does not contain a list of queue items.")
  }

  if (itemsArray.length === 0) {
    throw new Error("The selected file has no queued verses.")
  }

  const validItems: QueueItem[] = []
  for (let i = 0; i < itemsArray.length; i++) {
    const item = itemsArray[i] as any
    if (!item || typeof item !== "object") continue
    if (!item.reference || !item.verse) continue

    validItems.push({
      id: item.id || `queue-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      reference: String(item.reference),
      confidence: typeof item.confidence === "number" ? item.confidence : 1.0,
      source: item.source || "manual",
      added_at: typeof item.added_at === "number" ? item.added_at : Date.now(),
      verse: {
        id: Number(item.verse.id) || 0,
        translation_id: Number(item.verse.translation_id) || 1,
        book_number: Number(item.verse.book_number) || 1,
        book_name: String(item.verse.book_name || ""),
        book_abbreviation: String(item.verse.book_abbreviation || ""),
        chapter: Number(item.verse.chapter) || 1,
        verse: Number(item.verse.verse) || 1,
        text: String(item.verse.text || ""),
      },
      secondaryVerse: item.secondaryVerse
        ? {
            id: Number(item.secondaryVerse.id) || 0,
            translation_id: Number(item.secondaryVerse.translation_id) || 2,
            book_number: Number(item.secondaryVerse.book_number) || 1,
            book_name: String(item.secondaryVerse.book_name || ""),
            book_abbreviation: String(item.secondaryVerse.book_abbreviation || ""),
            chapter: Number(item.secondaryVerse.chapter) || 1,
            verse: Number(item.secondaryVerse.verse) || 1,
            text: String(item.secondaryVerse.text || ""),
          }
        : undefined,
    })
  }

  if (validItems.length === 0) {
    throw new Error("No valid verse records found in this file.")
  }

  return validItems
}

import { describe, it, expect } from "vitest"
import { serializeQueue, serializeQueueText, parseQueueFile } from "@/lib/queue-io"
import type { QueueItem } from "@/types"

describe("Queue File I/O & Local Database Persistence", () => {
  const sampleItems: QueueItem[] = [
    {
      id: "queue-1",
      reference: "John 3:16",
      confidence: 1.0,
      source: "manual",
      added_at: 1700000000000,
      verse: {
        id: 1,
        translation_id: 1,
        book_number: 43,
        book_name: "John",
        book_abbreviation: "Jn",
        chapter: 3,
        verse: 16,
        text: "For God so loved the world that he gave his one and only Son...",
      },
      secondaryVerse: {
        id: 2,
        translation_id: 2,
        book_number: 43,
        book_name: "యోహాను",
        book_abbreviation: "యోహాను",
        chapter: 3,
        verse: 16,
        text: "దేవుడు లోకమును ఎంతో ప్రేమించెను...",
      },
    },
    {
      id: "queue-2",
      reference: "Psalm 23:1",
      confidence: 0.95,
      source: "ai-direct",
      added_at: 1700000010000,
      verse: {
        id: 3,
        translation_id: 1,
        book_number: 19,
        book_name: "Psalms",
        book_abbreviation: "Ps",
        chapter: 23,
        verse: 1,
        text: "The LORD is my shepherd; I shall not want.",
      },
    },
  ]

  it("serializes queue items into valid JSON with metadata", () => {
    const json = serializeQueue(sampleItems)
    const parsed = JSON.parse(json)

    expect(parsed.app).toBe("Sharon AG Bible Presentation")
    expect(parsed.totalVerses).toBe(2)
    expect(parsed.items).toHaveLength(2)
    expect(parsed.items[0].reference).toBe("John 3:16")
    expect(parsed.items[1].reference).toBe("Psalm 23:1")
  })

  it("serializes queue items into readable text set list with Telugu support", () => {
    const text = serializeQueueText(sampleItems)

    expect(text).toContain("SHARON AG – BIBLE PRESENTATION QUEUE SET LIST")
    expect(text).toContain("1. John 3:16")
    expect(text).toContain("For God so loved the world")
    expect(text).toContain("[యోహాను] దేవుడు లోకమును ఎంతో ప్రేమించెను...")
    expect(text).toContain("2. Psalm 23:1")
    expect(text).toContain("The LORD is my shepherd")
  })

  it("parses valid JSON database file back into QueueItem array", () => {
    const json = serializeQueue(sampleItems)
    const items = parseQueueFile(json)

    expect(items).toHaveLength(2)
    expect(items[0].reference).toBe("John 3:16")
    expect(items[0].verse.text).toContain("For God so loved the world")
    expect(items[0].secondaryVerse?.text).toContain("దేవుడు లోకమును")
    expect(items[1].reference).toBe("Psalm 23:1")
  })

  it("parses raw array format JSON as well", () => {
    const json = JSON.stringify(sampleItems)
    const items = parseQueueFile(json)

    expect(items).toHaveLength(2)
    expect(items[0].reference).toBe("John 3:16")
  })

  it("throws descriptive error when given invalid JSON", () => {
    expect(() => parseQueueFile("{ not json }")).toThrow("Invalid JSON format")
  })

  it("throws descriptive error when JSON has no verses", () => {
    expect(() => parseQueueFile(JSON.stringify({ items: [] }))).toThrow("The selected file has no queued verses")
  })
})

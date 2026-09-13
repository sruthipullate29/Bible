import { describe, it, expect } from "vitest"
import {
  getAutocompleteSuggestion,
  getTabNavigationResult,
  normalizeInput,
  type Book,
} from "../quick-search"

const books: Book[] = [
  { id: 1, translation_id: 1, book_number: 22, name: "Song of Solomon", abbreviation: "SOS", testament: "OT" },
  { id: 2, translation_id: 1, book_number: 43, name: "John", abbreviation: "Jn", testament: "NT" },
  { id: 3, translation_id: 1, book_number: 62, name: "1 John", abbreviation: "1Jn", testament: "NT" },
  { id: 4, translation_id: 1, book_number: 63, name: "2 John", abbreviation: "2Jn", testament: "NT" },
  { id: 5, translation_id: 1, book_number: 45, name: "Romans", abbreviation: "Rom", testament: "NT" },
  { id: 6, translation_id: 1, book_number: 19, name: "Psalms", abbreviation: "Ps", testament: "OT" },
  { id: 7, translation_id: 1, book_number: 1, name: "Genesis", abbreviation: "Gen", testament: "OT" },
  { id: 8, translation_id: 1, book_number: 60, name: "1 Peter", abbreviation: "1 Pet", testament: "NT" },
  { id: 9, translation_id: 1, book_number: 61, name: "2 Peter", abbreviation: "2 Pet", testament: "NT" },
  { id: 10, translation_id: 1, book_number: 46, name: "1 Corinthians", abbreviation: "1 Cor", testament: "NT" },
]

describe("normalizeInput", () => {
  it("converts leading numbers to Roman numerals", () => {
    expect(normalizeInput("1 J")).toBe("I J")
    expect(normalizeInput("2 C")).toBe("II C")
    expect(normalizeInput("3 J")).toBe("III J")
  })

  it("leaves non-numbered input unchanged", () => {
    expect(normalizeInput("John")).toBe("John")
    expect(normalizeInput("  Song  ")).toBe("Song")
  })
})

describe("getAutocompleteSuggestion", () => {
  it("returns none for empty input", () => {
    const result = getAutocompleteSuggestion("", books)
    expect(result.stage).toBe("none")
  })

  it("suggests full reference from partial book name", () => {
    const result = getAutocompleteSuggestion("Jo", books)
    expect(result.matchedBook?.name).toBe("John")
    expect(result.suggestion).toBe("John 1:1")
    expect(result.stage).toBe("book")
  })

  it("suggests colon after chapter number", () => {
    const result = getAutocompleteSuggestion("John 3", books)
    expect(result.matchedBook?.name).toBe("John")
    expect(result.chapter).toBe(3)
    expect(result.suggestion).toBe("John 3:1")
    expect(result.stage).toBe("chapter")
  })

  it("recognizes complete reference with verse", () => {
    const result = getAutocompleteSuggestion("John 3:16", books)
    expect(result.matchedBook?.name).toBe("John")
    expect(result.chapter).toBe(3)
    expect(result.verse).toBe(16)
    expect(result.stage).toBe("complete")
  })

  it("handles numbered books like 1 John and 1 Peter", () => {
    const r1 = getAutocompleteSuggestion("1 Jo", books)
    expect(r1.matchedBook?.name).toBe("1 John")
    expect(r1.stage).toBe("book")

    const r2 = getAutocompleteSuggestion("1 John 3:16", books)
    expect(r2.matchedBook?.name).toBe("1 John")
    expect(r2.chapter).toBe(3)
    expect(r2.verse).toBe(16)
    expect(r2.stage).toBe("complete")

    const r3 = getAutocompleteSuggestion("1 Peter 1:3", books)
    expect(r3.matchedBook?.name).toBe("1 Peter")
    expect(r3.chapter).toBe(1)
    expect(r3.verse).toBe(3)
    expect(r3.stage).toBe("complete")

    const r4 = getAutocompleteSuggestion("1 p", books)
    expect(r4.matchedBook?.name).toBe("1 Peter")

    const r5 = getAutocompleteSuggestion("1pet", books)
    expect(r5.matchedBook?.name).toBe("1 Peter")

    const r6 = getAutocompleteSuggestion("2 Peter", books)
    expect(r6.matchedBook?.name).toBe("2 Peter")

    const r7 = getAutocompleteSuggestion("1 Cor 13", books)
    expect(r7.matchedBook?.name).toBe("1 Corinthians")
    expect(r7.chapter).toBe(13)
  })

  it("handles Song of Solomon", () => {
    const result = getAutocompleteSuggestion("Song", books)
    expect(result.matchedBook?.name).toBe("Song of Solomon")
    expect(result.suggestion).toBe("Song of Solomon 1:1")
    expect(result.stage).toBe("book")
  })

  it("parses Song of Solomon with chapter and verse", () => {
    const result = getAutocompleteSuggestion("Song of Solomon 4:4", books)
    expect(result.matchedBook?.name).toBe("Song of Solomon")
    expect(result.chapter).toBe(4)
    expect(result.verse).toBe(4)
    expect(result.stage).toBe("complete")
  })
})

describe("getTabNavigationResult", () => {
  it("advances from partial book to full book name", () => {
    const result = getTabNavigationResult("Jo", "John 1:1")
    expect(result).toBe("John ")
  })

  it("advances from book name to chapter with colon", () => {
    const result = getTabNavigationResult("John 3", "John 3:1")
    expect(result).toBe("John 3:")
  })

  it("returns full suggestion as fallback", () => {
    const result = getTabNavigationResult("John 3:", "John 3:")
    expect(result).toBe("John 3:")
  })
})

describe("input sync behavior (edit-in-place)", () => {
  it("resolves reference on Enter for chapter+verse input", () => {
    // Simulates: user typed "John 3:16", presses Enter
    // Expected: input syncs to "John 3:16" (resolved from autocomplete)
    const result = getAutocompleteSuggestion("John 3:16", books)
    expect(result.matchedBook).toBeTruthy()
    expect(result.chapter).toBe(3)
    expect(result.verse).toBe(16)

    // The synced input would be:
    const synced = `${result.matchedBook!.name} ${result.chapter}:${result.verse}`
    expect(synced).toBe("John 3:16")
  })

  it("resolves partial book input to full reference on Enter", () => {
    // Simulates: user typed "Jo", Tab to "John ", then "3:16", then Enter
    const result = getAutocompleteSuggestion("John 3:16", books)
    const synced = `${result.matchedBook!.name} ${result.chapter}:${result.verse}`
    expect(synced).toBe("John 3:16")
  })

  it("allows editing from synced state to change chapter", () => {
    // User is at "Song of Solomon 4:4" and wants to go to chapter 8
    // They backspace "4:4" → "Song of Solomon " → type "8" → "Song of Solomon 8"
    const afterBackspace = "Song of Solomon 8"
    const result = getAutocompleteSuggestion(afterBackspace, books)
    expect(result.matchedBook?.name).toBe("Song of Solomon")
    expect(result.chapter).toBe(8)
    expect(result.suggestion).toBe("Song of Solomon 8:1")
    expect(result.stage).toBe("chapter")
  })

  it("allows editing from synced state to change verse", () => {
    // User is at "John 3:16", backspaces "16" → "John 3:" → types "1" → "John 3:1"
    const afterEdit = "John 3:1"
    const result = getAutocompleteSuggestion(afterEdit, books)
    expect(result.matchedBook?.name).toBe("John")
    expect(result.chapter).toBe(3)
    expect(result.verse).toBe(1)
    expect(result.stage).toBe("complete")
  })

  it("allows editing to switch books entirely", () => {
    // User is at "John 3:16", backspaces everything to "Ro" → "Romans"
    const afterEdit = "Ro"
    const result = getAutocompleteSuggestion(afterEdit, books)
    expect(result.matchedBook?.name).toBe("Romans")
    expect(result.suggestion).toBe("Romans 1:1")
    expect(result.stage).toBe("book")
  })

  it("chapter-only input resolves with verse 1 for syncing", () => {
    // User typed "Psalms 23" — on Enter, should sync to "Psalms 23:1" (with default verse)
    const result = getAutocompleteSuggestion("Psalms 23", books)
    expect(result.matchedBook?.name).toBe("Psalms")
    expect(result.chapter).toBe(23)
    expect(result.verse).toBe(1)

    const synced = result.verse
      ? `${result.matchedBook!.name} ${result.chapter}:${result.verse}`
      : `${result.matchedBook!.name} ${result.chapter}:`
    expect(synced).toBe("Psalms 23:1")
  })

  it("handles colon-without-verse as pending state", () => {
    // User typed "John 3:" — waiting for verse number
    const result = getAutocompleteSuggestion("John 3:", books)
    expect(result.matchedBook?.name).toBe("John")
    expect(result.chapter).toBe(3)
    expect(result.verse).toBeUndefined()
    expect(result.stage).toBe("verse")

    // Sync should preserve the colon
    const synced = result.verse
      ? `${result.matchedBook!.name} ${result.chapter}:${result.verse}`
      : `${result.matchedBook!.name} ${result.chapter}:`
    expect(synced).toBe("John 3:")
  })
})

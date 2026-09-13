/**
 * Quick Search Utility Functions
 * Pure functions for Bible reference autocomplete logic
 */

export interface Book {
  id: number
  translation_id: number
  book_number: number
  name: string
  abbreviation: string
  testament: string
}

export interface AutocompleteResult {
  suggestion: string
  matchedBook?: Book
  chapter?: number
  verse?: number
  stage: "book" | "chapter" | "verse" | "complete" | "none"
}

/**
 * Common Bible book aliases and abbreviations
 */
const BOOK_ALIASES: Record<string, string[]> = {
  // Numbered books
  "1 samuel": ["1samuel", "1sam", "1sa", "1s", "i samuel", "isamuel", "isam", "1 sam", "1 s", "i s"],
  "2 samuel": ["2samuel", "2sam", "2sa", "2s", "ii samuel", "iisamuel", "iisam", "2 sam", "2 s", "ii s"],
  "1 kings": ["1kings", "1kgs", "1kg", "1ki", "1k", "i kings", "ikings", "1 kgs", "1 k", "i k"],
  "2 kings": ["2kings", "2kgs", "2kg", "2ki", "2k", "ii kings", "iikings", "2 kgs", "2 k", "ii k"],
  "1 chronicles": ["1chronicles", "1chron", "1chr", "1ch", "i chronicles", "ichronicles", "1 chr", "1 ch", "i ch"],
  "2 chronicles": ["2chronicles", "2chron", "2chr", "2ch", "ii chronicles", "iichronicles", "2 chr", "2 ch", "ii ch"],
  "1 corinthians": ["1corinthians", "1cor", "1co", "1c", "i corinthians", "icorinthians", "icor", "1 cor", "1 c", "i c"],
  "2 corinthians": ["2corinthians", "2cor", "2co", "2c", "ii corinthians", "iicorinthians", "iicor", "2 cor", "2 c", "ii c"],
  "1 thessalonians": ["1thessalonians", "1thess", "1th", "i thessalonians", "ithessalonians", "1 thess", "1 th", "i th"],
  "2 thessalonians": ["2thessalonians", "2thess", "2th", "ii thessalonians", "iithessalonians", "2 thess", "2 th", "ii th"],
  "1 timothy": ["1timothy", "1tim", "1ti", "i timothy", "itimothy", "1 tim", "1 ti", "i ti"],
  "2 timothy": ["2timothy", "2tim", "2ti", "ii timothy", "iitimothy", "2 tim", "2 ti", "ii ti"],
  "1 peter": ["1peter", "1pet", "1pe", "1p", "1pt", "i peter", "ipeter", "ipet", "1 pet", "1 p", "1 pt", "i p"],
  "2 peter": ["2peter", "2pet", "2pe", "2p", "2pt", "ii peter", "iipeter", "iipet", "2 pet", "2 p", "2 pt", "ii p"],
  "1 john": ["1john", "1jhn", "1jn", "1j", "i john", "ijohn", "ijn", "1 jhn", "1 jn", "1 j", "i j"],
  "2 john": ["2john", "2jhn", "2jn", "2j", "ii john", "iijohn", "iijn", "2 jhn", "2 jn", "2 j", "ii j"],
  "3 john": ["3john", "3jhn", "3jn", "3j", "iii john", "iiijohn", "iiijn", "3 jhn", "3 jn", "3 j", "iii j"],

  // Single books with common abbreviations
  "genesis": ["gen", "ge", "gn"],
  "exodus": ["exod", "exo", "ex"],
  "leviticus": ["lev", "le", "lv"],
  "numbers": ["num", "nu", "nm", "nb"],
  "deuteronomy": ["deut", "de", "dt"],
  "joshua": ["josh", "jos", "jsh"],
  "judges": ["judg", "jdg", "jg", "jdgs"],
  "ruth": ["rth", "ru"],
  "ezra": ["ezr", "ez"],
  "nehemiah": ["neh", "ne"],
  "esther": ["esth", "es"],
  "job": ["jb"],
  "psalms": ["psalm", "psa", "psm", "pss", "ps"],
  "proverbs": ["prov", "pro", "prv", "pr"],
  "ecclesiastes": ["eccles", "eccle", "eccl", "ecc", "ec"],
  "song of songs": ["song of solomon", "song", "sos", "canticles", "cant"],
  "isaiah": ["isa", "is"],
  "jeremiah": ["jer", "je", "jr"],
  "lamentations": ["lam", "la"],
  "ezekiel": ["ezek", "eze", "ezk"],
  "daniel": ["dan", "da", "dn"],
  "hosea": ["hos", "ho"],
  "joel": ["joe", "jl"],
  "amos": ["amo", "am"],
  "obadiah": ["obad", "oba", "ob"],
  "jonah": ["jnh", "jon"],
  "micah": ["mic", "mc"],
  "nahum": ["nah", "na"],
  "habakkuk": ["hab", "hb"],
  "zephaniah": ["zeph", "zep", "zp"],
  "haggai": ["hag", "hg"],
  "zechariah": ["zech", "zec", "zc"],
  "malachi": ["mal", "ml"],
  "matthew": ["matt", "mat", "mt"],
  "mark": ["mrk", "mar", "mk"],
  "luke": ["luk", "lu", "lk"],
  "john": ["jhn", "joh", "jn"],
  "acts": ["act", "ac"],
  "romans": ["rom", "ro", "rm"],
  "galatians": ["gal", "ga"],
  "ephesians": ["eph", "ep"],
  "philippians": ["phil", "php", "pp"],
  "colossians": ["col", "co"],
  "titus": ["tit", "ti"],
  "philemon": ["philem", "phm", "pm"],
  "hebrews": ["heb", "he"],
  "james": ["jas", "jm"],
  "jude": ["jud", "jd"],
  "revelation": ["rev", "re", "rv", "apocalypse", "apoc"],
}

/**
 * Convert number to Roman numeral for numbered books
 */
export function numberToRoman(num: number): string {
  if (num === 1) return "I"
  if (num === 2) return "II"
  if (num === 3) return "III"
  return String(num)
}

/**
 * Normalize input: converts leading numbers to Roman numerals for matching
 * e.g., "1 J" -> "I J", "2 C" -> "II C", "3 J" -> "III J"
 */
export function normalizeInput(input: string): string {
  const trimmed = input.trim()
  const leadingNumberMatch = trimmed.match(/^(\d+)\s*(.*)$/)

  if (leadingNumberMatch) {
    const num = parseInt(leadingNumberMatch[1], 10)
    const rest = leadingNumberMatch[2]
    return numberToRoman(num) + (rest ? " " + rest : "")
  }

  return trimmed
}

export function toDigitVersion(str: string): string {
  return str.replace(/^III\s*/i, "3 ").replace(/^II\s*/i, "2 ").replace(/^I\s*/i, "1 ")
}

export function toRomanVersion(str: string): string {
  return str.replace(/^3\s*/i, "III ").replace(/^2\s*/i, "II ").replace(/^1\s*/i, "I ")
}

/**
 * Find matching book by name, abbreviation, or alias (case-insensitive)
 * Supports both digits ("1 John") and Roman numerals ("I John").
 */
export function findMatchingBook(bookInput: string, books: Book[]): Book | undefined {
  if (!bookInput) return undefined
  const raw = bookInput.toLowerCase().trim()
  const asDigit = toDigitVersion(raw)
  const asRoman = toRomanVersion(raw)
  const compactDigit = asDigit.replace(/\s+/g, "")
  const compactRoman = asRoman.replace(/\s+/g, "")

  // 1. Direct name or abbreviation match (both digit & Roman)
  let match = books.find((b) => {
    const bName = b.name.toLowerCase()
    const bAbbr = b.abbreviation.toLowerCase()
    const bNameDigit = toDigitVersion(bName)
    const bNameRoman = toRomanVersion(bName)
    const bCompactDigit = bNameDigit.replace(/\s+/g, "")
    const bCompactRoman = bNameRoman.replace(/\s+/g, "")

    return (
      bName.startsWith(raw) ||
      bAbbr.startsWith(raw) ||
      bNameDigit.startsWith(asDigit) ||
      bNameRoman.startsWith(asRoman) ||
      bCompactDigit.startsWith(compactDigit) ||
      bCompactRoman.startsWith(compactRoman)
    )
  })
  if (match) return match

  // 2. Numbered book shorthand and aliases
  for (const [canonical, aliases] of Object.entries(BOOK_ALIASES)) {
    if (
      aliases.some(
        (a) =>
          a === asDigit ||
          a === asRoman ||
          a === compactDigit ||
          a.startsWith(compactDigit) ||
          a.startsWith(compactRoman)
      )
    ) {
      match = books.find((b) => {
        const bNameDigit = toDigitVersion(b.name.toLowerCase())
        return bNameDigit === canonical || bNameDigit.startsWith(canonical)
      })
      if (match) return match
    }
  }

  // 3. Fallback: contains match on name
  match = books.find((b) => b.name.toLowerCase().includes(raw))
  return match
}

/**
 * Parse Bible reference input and return autocomplete suggestion
 */
export function getAutocompleteSuggestion(
  input: string,
  books: Book[]
): AutocompleteResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { suggestion: "", stage: "none" }
  }

  // Extract trailing chapter and verse if present
  // Matches '<book text> <chapter>:<verse>' or '<book text> <chapter>:' or '<book text> <chapter>'
  const cvMatch = trimmed.match(/^(.*?)(?:\s+(\d+)(?::(\d+)?)?)?$/)
  if (!cvMatch) {
    return { suggestion: "", stage: "none" }
  }

  let bookInput = (cvMatch[1] || "").trim()
  let chapterNum: string | undefined = cvMatch[2]
  const verseNum = cvMatch[3]

  // If cvMatch[1] was empty (e.g. user typed "1" or "2"), treat it as bookInput
  if (!bookInput && chapterNum) {
    bookInput = chapterNum
    chapterNum = undefined
  }

  const matchingBook = findMatchingBook(bookInput, books)

  if (!matchingBook) {
    return { suggestion: "", stage: "none" }
  }

  // Stage 1: Autocomplete book name + suggest 1:1
  if (!chapterNum) {
    return {
      suggestion: matchingBook.name + " 1:1",
      matchedBook: matchingBook,
      chapter: 1,
      verse: 1,
      stage: "book",
    }
  }

  const chapter = parseInt(chapterNum, 10)

  // Stage 2: Suggest colon after chapter
  if (!verseNum && !trimmed.includes(":")) {
    return {
      suggestion: `${matchingBook.name} ${chapter}:1`,
      matchedBook: matchingBook,
      chapter,
      verse: 1,
      stage: "chapter",
    }
  }

  // Stage 3: Has colon but no verse number yet
  if (!verseNum && trimmed.includes(":")) {
    return {
      suggestion: `${matchingBook.name} ${chapter}:1`,
      matchedBook: matchingBook,
      chapter,
      stage: "verse",
    }
  }

  // Stage 4: Complete reference
  if (verseNum) {
    const verse = parseInt(verseNum, 10)
    return {
      suggestion: "",
      matchedBook: matchingBook,
      chapter,
      verse,
      stage: "complete",
    }
  }

  return { suggestion: "", stage: "none" }
}

/**
 * Determine what should happen when Tab/Arrow-Right is pressed
 */
export function getTabNavigationResult(
  currentInput: string,
  currentSuggestion: string
): string {
  if (!currentSuggestion || currentSuggestion === currentInput) {
    return currentInput
  }

  const trimmed = currentInput.trim()
  const suggestionTrimmed = currentSuggestion.trim()

  // Extract the full book name and chapter:verse from the suggestion
  const match = suggestionTrimmed.match(/^(.*?)\s+(\d+):(\d+)$/)

  if (match) {
    const fullBookName = match[1]
    const chapter = match[2]

    // Check if current input matches the book name
    const normCurrent = toDigitVersion(trimmed).toLowerCase()
    const normBook = toDigitVersion(fullBookName).toLowerCase()

    if (!normCurrent.startsWith(normBook)) {
      return fullBookName + " "
    }

    // If current has book name but no chapter colon
    if (!trimmed.includes(":")) {
      return `${fullBookName} ${chapter}:`
    }
  }

  // Default: accept full suggestion
  return currentSuggestion
}

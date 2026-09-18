export interface StandardBookInfo {
  num: number
  name: string
  abbr: string
  teluguName: string
  teluguAbbr: string
  testament: "OT" | "NT"
}

export const STANDARD_BOOKS: StandardBookInfo[] = [
  { num: 1, name: "Genesis", abbr: "Gen", teluguName: "ఆదికాండము", teluguAbbr: "ఆది", testament: "OT" },
  { num: 2, name: "Exodus", abbr: "Exod", teluguName: "నిర్గమకాండము", teluguAbbr: "నిర్గ", testament: "OT" },
  { num: 3, name: "Leviticus", abbr: "Lev", teluguName: "లేవీయకాండము", teluguAbbr: "లేవీ", testament: "OT" },
  { num: 4, name: "Numbers", abbr: "Num", teluguName: "సంఖ్యాకాండము", teluguAbbr: "సంఖ్యా", testament: "OT" },
  { num: 5, name: "Deuteronomy", abbr: "Deut", teluguName: "ద్వితీయోపదేశకాండము", teluguAbbr: "ద్వితీ", testament: "OT" },
  { num: 6, name: "Joshua", abbr: "Josh", teluguName: "యెహోషువ", teluguAbbr: "యెహో", testament: "OT" },
  { num: 7, name: "Judges", abbr: "Judg", teluguName: "న్యాయాధిపతులు", teluguAbbr: "న్యాయా", testament: "OT" },
  { num: 8, name: "Ruth", abbr: "Ruth", teluguName: "రూతు", teluguAbbr: "రూతు", testament: "OT" },
  { num: 9, name: "1 Samuel", abbr: "1 Sam", teluguName: "1 సమూయేలు", teluguAbbr: "1 సమూ", testament: "OT" },
  { num: 10, name: "2 Samuel", abbr: "2 Sam", teluguName: "2 సమూయేలు", teluguAbbr: "2 సమూ", testament: "OT" },
  { num: 11, name: "1 Kings", abbr: "1 Kgs", teluguName: "1 రాజులు", teluguAbbr: "1 రాజు", testament: "OT" },
  { num: 12, name: "2 Kings", abbr: "2 Kgs", teluguName: "2 రాజులు", teluguAbbr: "2 రాజు", testament: "OT" },
  { num: 13, name: "1 Chronicles", abbr: "1 Chr", teluguName: "1 దినవృత్తాంతములు", teluguAbbr: "1 దిన", testament: "OT" },
  { num: 14, name: "2 Chronicles", abbr: "2 Chr", teluguName: "2 దినవృత్తాంతములు", teluguAbbr: "2 దిన", testament: "OT" },
  { num: 15, name: "Ezra", abbr: "Ezra", teluguName: "ఎజ్రా", teluguAbbr: "ఎజ్రా", testament: "OT" },
  { num: 16, name: "Nehemiah", abbr: "Neh", teluguName: "నెహెమ్యా", teluguAbbr: "నెహె", testament: "OT" },
  { num: 17, name: "Esther", abbr: "Esth", teluguName: "ఎస్తేరు", teluguAbbr: "ఎస్తే", testament: "OT" },
  { num: 18, name: "Job", abbr: "Job", teluguName: "యోబు", teluguAbbr: "యోబు", testament: "OT" },
  { num: 19, name: "Psalms", abbr: "Ps", teluguName: "కీర్తనలు", teluguAbbr: "కీర్త", testament: "OT" },
  { num: 20, name: "Proverbs", abbr: "Prov", teluguName: "సామెతలు", teluguAbbr: "సామె", testament: "OT" },
  { num: 21, name: "Ecclesiastes", abbr: "Eccl", teluguName: "ప్రసంగి", teluguAbbr: "ప్రసం", testament: "OT" },
  { num: 22, name: "Song of Songs", abbr: "Song", teluguName: "పరమగీతము", teluguAbbr: "పరమ", testament: "OT" },
  { num: 23, name: "Isaiah", abbr: "Isa", teluguName: "యెషయా", teluguAbbr: "యెష", testament: "OT" },
  { num: 24, name: "Jeremiah", abbr: "Jer", teluguName: "యిర్మీయా", teluguAbbr: "యిర్మీ", testament: "OT" },
  { num: 25, name: "Lamentations", abbr: "Lam", teluguName: "విలాపవాక్యములు", teluguAbbr: "విలా", testament: "OT" },
  { num: 26, name: "Ezekiel", abbr: "Ezek", teluguName: "యెహెజ్కేలు", teluguAbbr: "యెహెజ్కే", testament: "OT" },
  { num: 27, name: "Daniel", abbr: "Dan", teluguName: "దానియేలు", teluguAbbr: "దాని", testament: "OT" },
  { num: 28, name: "Hosea", abbr: "Hos", teluguName: "హోషేయ", teluguAbbr: "హోషే", testament: "OT" },
  { num: 29, name: "Joel", abbr: "Joel", teluguName: "యోవేలు", teluguAbbr: "యోవే", testament: "OT" },
  { num: 30, name: "Amos", abbr: "Amos", teluguName: "ఆమోసు", teluguAbbr: "ఆమో", testament: "OT" },
  { num: 31, name: "Obadiah", abbr: "Obad", teluguName: "ఓబద్యా", teluguAbbr: "ఓబ", testament: "OT" },
  { num: 32, name: "Jonah", abbr: "Jonah", teluguName: "యోనా", teluguAbbr: "యోనా", testament: "OT" },
  { num: 33, name: "Micah", abbr: "Mic", teluguName: "మీకా", teluguAbbr: "మీకా", testament: "OT" },
  { num: 34, name: "Nahum", abbr: "Nah", teluguName: "నహూము", teluguAbbr: "నహూ", testament: "OT" },
  { num: 35, name: "Habakkuk", abbr: "Hab", teluguName: "హబక్కూకు", teluguAbbr: "హబ", testament: "OT" },
  { num: 36, name: "Zephaniah", abbr: "Zeph", teluguName: "జెఫన్యా", teluguAbbr: "జెఫ", testament: "OT" },
  { num: 37, name: "Haggai", abbr: "Hag", teluguName: "హగ్గయి", teluguAbbr: "హగ్గ", testament: "OT" },
  { num: 38, name: "Zechariah", abbr: "Zech", teluguName: "జెకర్యా", teluguAbbr: "జెక", testament: "OT" },
  { num: 39, name: "Malachi", abbr: "Mal", teluguName: "మలాకీ", teluguAbbr: "మలా", testament: "OT" },
  { num: 40, name: "Matthew", abbr: "Matt", teluguName: "మత్తయి", teluguAbbr: "మత్త", testament: "NT" },
  { num: 41, name: "Mark", abbr: "Mark", teluguName: "మార్కు", teluguAbbr: "మార్కు", testament: "NT" },
  { num: 42, name: "Luke", abbr: "Luke", teluguName: "లూకా", teluguAbbr: "లూకా", testament: "NT" },
  { num: 43, name: "John", abbr: "John", teluguName: "యోహాను", teluguAbbr: "యోహాను", testament: "NT" },
  { num: 44, name: "Acts", abbr: "Acts", teluguName: "అపొస్తలుల కార్యములు", teluguAbbr: "అపొ", testament: "NT" },
  { num: 45, name: "Romans", abbr: "Rom", teluguName: "రోమీయులకు", teluguAbbr: "రోమా", testament: "NT" },
  { num: 46, name: "1 Corinthians", abbr: "1 Cor", teluguName: "1 కొరింథీయులకు", teluguAbbr: "1 కొరిం", testament: "NT" },
  { num: 47, name: "2 Corinthians", abbr: "2 Cor", teluguName: "2 కొరింథీయులకు", teluguAbbr: "2 కొరిం", testament: "NT" },
  { num: 48, name: "Galatians", abbr: "Gal", teluguName: "గలతీయులకు", teluguAbbr: "గలతీ", testament: "NT" },
  { num: 49, name: "Ephesians", abbr: "Eph", teluguName: "ఎఫెసీయులకు", teluguAbbr: "ఎఫెసీ", testament: "NT" },
  { num: 50, name: "Philippians", abbr: "Phil", teluguName: "ఫిలిప్పీయులకు", teluguAbbr: "ఫిలిప్పీ", testament: "NT" },
  { num: 51, name: "Colossians", abbr: "Col", teluguName: "కొలొస్సయులకు", teluguAbbr: "కొలొస్స", testament: "NT" },
  { num: 52, name: "1 Thessalonians", abbr: "1 Thess", teluguName: "1 థెస్సలొనీకయులకు", teluguAbbr: "1 థెస్స", testament: "NT" },
  { num: 53, name: "2 Thessalonians", abbr: "2 Thess", teluguName: "2 థెస్సలొనీకయులకు", teluguAbbr: "2 థెస్స", testament: "NT" },
  { num: 54, name: "1 Timothy", abbr: "1 Tim", teluguName: "1 తిమోతికి", teluguAbbr: "1 తిమో", testament: "NT" },
  { num: 55, name: "2 Timothy", abbr: "2 Tim", teluguName: "2 తిమోతికి", teluguAbbr: "2 తిమో", testament: "NT" },
  { num: 56, name: "Titus", abbr: "Titus", teluguName: "తీతుకు", teluguAbbr: "తీతు", testament: "NT" },
  { num: 57, name: "Philemon", abbr: "Phlm", teluguName: "ఫిలేమోనుకు", teluguAbbr: "ఫిలే", testament: "NT" },
  { num: 58, name: "Hebrews", abbr: "Heb", teluguName: "హెబ్రీయులకు", teluguAbbr: "హెబ్రీ", testament: "NT" },
  { num: 59, name: "James", abbr: "Jas", teluguName: "యాకోబు", teluguAbbr: "యాకోబు", testament: "NT" },
  { num: 60, name: "1 Peter", abbr: "1 Pet", teluguName: "1 పేతురు", teluguAbbr: "1 పేతు", testament: "NT" },
  { num: 61, name: "2 Peter", abbr: "2 Pet", teluguName: "2 పేతురు", teluguAbbr: "2 పేతు", testament: "NT" },
  { num: 62, name: "1 John", abbr: "1 John", teluguName: "1 యోహాను", teluguAbbr: "1 యోహా", testament: "NT" },
  { num: 63, name: "2 John", abbr: "2 John", teluguName: "2 యోహాను", teluguAbbr: "2 యోహా", testament: "NT" },
  { num: 64, name: "3 John", abbr: "3 John", teluguName: "3 యోహాను", teluguAbbr: "3 యోహా", testament: "NT" },
  { num: 65, name: "Jude", abbr: "Jude", teluguName: "యూదా", teluguAbbr: "యూదా", testament: "NT" },
  { num: 66, name: "Revelation", abbr: "Rev", teluguName: "ప్రకటన గ్రంథము", teluguAbbr: "ప్రక", testament: "NT" },
]

const aliases: Record<string, number> = {
  "psalm": 19,
  "ps": 19,
  "song of solomon": 22,
  "song": 22,
  "jn": 43,
  "jhn": 43,
  "1jn": 62,
  "2jn": 63,
  "3jn": 64,
  "1cor": 46,
  "2cor": 47,
  "1thess": 52,
  "2thess": 53,
  "1tim": 54,
  "2tim": 55,
  "1pet": 60,
  "2pet": 61,
}

export function resolveBook(input: string | number | null | undefined): StandardBookInfo | null {
  if (!input) return null
  if (typeof input === "number" || /^\d+$/.test(String(input).trim())) {
    const num = Number(input)
    return STANDARD_BOOKS.find((b) => b.num === num) ?? null
  }

  const clean = String(input).trim().toLowerCase().replace(/\s+/g, " ")
  if (aliases[clean]) {
    const num = aliases[clean]
    return STANDARD_BOOKS.find((b) => b.num === num) ?? null
  }

  // Exact matches on English name, abbr, Telugu name, or Telugu abbr
  for (const b of STANDARD_BOOKS) {
    if (
      b.name.toLowerCase() === clean ||
      b.abbr.toLowerCase() === clean ||
      b.teluguName.toLowerCase() === clean ||
      b.teluguAbbr.toLowerCase() === clean
    ) {
      return b
    }
  }

  // Prefix match (e.g. "1 యోహాను" matching "1 యోహా", "John" matching "John")
  for (const b of STANDARD_BOOKS) {
    if (
      clean.startsWith(b.name.toLowerCase()) ||
      clean.startsWith(b.teluguName.toLowerCase()) ||
      clean.startsWith(b.teluguAbbr.toLowerCase())
    ) {
      return b
    }
  }

  return null
}

export function parseReference(reference: string | null | undefined): {
  bookNumber: number
  bookName: string
  teluguName: string
  chapter: number
  verse: number
} | null {
  if (!reference) return null

  // Support bilingual references e.g. "John 3:16  •  యోహాను 3:16"
  const primaryPart = reference.split("•")[0].trim()

  const match = primaryPart.match(/^((?:\d\s+)?[^\d:]+?)\s+(\d+)[:\.](\d+)/)
  if (!match) {
    // Try Telugu or reversed format
    const anyMatch = reference.match(/([^\d:]+?)\s*(\d+)[:\.](\d+)/)
    if (!anyMatch) return null
    const b = resolveBook(anyMatch[1])
    if (!b) return null
    return {
      bookNumber: b.num,
      bookName: b.name,
      teluguName: b.teluguName,
      chapter: parseInt(anyMatch[2], 10),
      verse: parseInt(anyMatch[3], 10),
    }
  }

  const bookStr = match[1].trim()
  const chapter = parseInt(match[2], 10)
  const verse = parseInt(match[3], 10)

  const resolved = resolveBook(bookStr)
  if (!resolved) {
    // If not found in primary part, try secondary part
    if (reference.includes("•")) {
      const secondaryPart = reference.split("•")[1].trim()
      const secMatch = secondaryPart.match(/^((?:\d\s+)?[^\d:]+?)\s+(\d+)[:\.](\d+)/)
      if (secMatch) {
        const secResolved = resolveBook(secMatch[1].trim())
        if (secResolved) {
          return {
            bookNumber: secResolved.num,
            bookName: secResolved.name,
            teluguName: secResolved.teluguName,
            chapter,
            verse,
          }
        }
      }
    }
    return null
  }

  return {
    bookNumber: resolved.num,
    bookName: resolved.name,
    teluguName: resolved.teluguName,
    chapter,
    verse,
  }
}

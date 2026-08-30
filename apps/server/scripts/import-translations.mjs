import { DatabaseSync } from "node:sqlite"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, "../data/openbeam.db")

console.log(`Opening database at ${dbPath}...`)
const db = new DatabaseSync(dbPath)

// Standard 66 books list in order
const STANDARD_BOOKS = [
  { num: 1, name: "Genesis", abbr: "Gen", teluguName: "ఆదికాండము", teluguAbbr: "ఆది", testament: "OT", nivFile: "Genesis" },
  { num: 2, name: "Exodus", abbr: "Exod", teluguName: "నిర్గమకాండము", teluguAbbr: "నిర్గ", testament: "OT", nivFile: "Exodus" },
  { num: 3, name: "Leviticus", abbr: "Lev", teluguName: "లేవీయకాండము", teluguAbbr: "లేవీ", testament: "OT", nivFile: "Leviticus" },
  { num: 4, name: "Numbers", abbr: "Num", teluguName: "సంఖ్యాకాండము", teluguAbbr: "సంఖ్యా", testament: "OT", nivFile: "Numbers" },
  { num: 5, name: "Deuteronomy", abbr: "Deut", teluguName: "ద్వితీయోపదేశకాండము", teluguAbbr: "ద్వితీ", testament: "OT", nivFile: "Deuteronomy" },
  { num: 6, name: "Joshua", abbr: "Josh", teluguName: "యెహోషువ", teluguAbbr: "యెహో", testament: "OT", nivFile: "Joshua" },
  { num: 7, name: "Judges", abbr: "Judg", teluguName: "న్యాయాధిపతులు", teluguAbbr: "న్యాయా", testament: "OT", nivFile: "Judges" },
  { num: 8, name: "Ruth", abbr: "Ruth", teluguName: "రూతు", teluguAbbr: "రూతు", testament: "OT", nivFile: "Ruth" },
  { num: 9, name: "1 Samuel", abbr: "1 Sam", teluguName: "1 సమూయేలు", teluguAbbr: "1 సమూ", testament: "OT", nivFile: "1 Samuel" },
  { num: 10, name: "2 Samuel", abbr: "2 Sam", teluguName: "2 సమూయేలు", teluguAbbr: "2 సమూ", testament: "OT", nivFile: "2 Samuel" },
  { num: 11, name: "1 Kings", abbr: "1 Kgs", teluguName: "1 రాజులు", teluguAbbr: "1 రాజు", testament: "OT", nivFile: "1 Kings" },
  { num: 12, name: "2 Kings", abbr: "2 Kgs", teluguName: "2 రాజులు", teluguAbbr: "2 రాజు", testament: "OT", nivFile: "2 Kings" },
  { num: 13, name: "1 Chronicles", abbr: "1 Chr", teluguName: "1 దినవృత్తాంతములు", teluguAbbr: "1 దిన", testament: "OT", nivFile: "1 Chronicles" },
  { num: 14, name: "2 Chronicles", abbr: "2 Chr", teluguName: "2 దినవృత్తాంతములు", teluguAbbr: "2 దిన", testament: "OT", nivFile: "2 Chronicles" },
  { num: 15, name: "Ezra", abbr: "Ezra", teluguName: "ఎజ్రా", teluguAbbr: "ఎజ్రా", testament: "OT", nivFile: "Ezra" },
  { num: 16, name: "Nehemiah", abbr: "Neh", teluguName: "నెహెమ్యా", teluguAbbr: "నెహె", testament: "OT", nivFile: "Nehemiah" },
  { num: 17, name: "Esther", abbr: "Esth", teluguName: "ఎస్తేరు", teluguAbbr: "ఎస్తే", testament: "OT", nivFile: "Esther" },
  { num: 18, name: "Job", abbr: "Job", teluguName: "యోబు", teluguAbbr: "యోబు", testament: "OT", nivFile: "Job" },
  { num: 19, name: "Psalms", abbr: "Ps", teluguName: "కీర్తనలు", teluguAbbr: "కీర్త", testament: "OT", nivFile: "Psalms" },
  { num: 20, name: "Proverbs", abbr: "Prov", teluguName: "సామెతలు", teluguAbbr: "సామె", testament: "OT", nivFile: "Proverbs" },
  { num: 21, name: "Ecclesiastes", abbr: "Eccl", teluguName: "ప్రసంగి", teluguAbbr: "ప్రసం", testament: "OT", nivFile: "Ecclesiastes" },
  { num: 22, name: "Song of Songs", abbr: "Song", teluguName: "పరమగీతము", teluguAbbr: "పరమ", testament: "OT", nivFile: "Song Of Solomon" },
  { num: 23, name: "Isaiah", abbr: "Isa", teluguName: "యెషయా", teluguAbbr: "యెష", testament: "OT", nivFile: "Isaiah" },
  { num: 24, name: "Jeremiah", abbr: "Jer", teluguName: "యిర్మీయా", teluguAbbr: "యిర్మీ", testament: "OT", nivFile: "Jeremiah" },
  { num: 25, name: "Lamentations", abbr: "Lam", teluguName: "విలాపవాక్యములు", teluguAbbr: "విలా", testament: "OT", nivFile: "Lamentations" },
  { num: 26, name: "Ezekiel", abbr: "Ezek", teluguName: "యెహెజ్కేలు", teluguAbbr: "యెహెజ్కే", testament: "OT", nivFile: "Ezekiel" },
  { num: 27, name: "Daniel", abbr: "Dan", teluguName: "దానియేలు", teluguAbbr: "దాని", testament: "OT", nivFile: "Daniel" },
  { num: 28, name: "Hosea", abbr: "Hos", teluguName: "హోషేయ", teluguAbbr: "హోషే", testament: "OT", nivFile: "Hosea" },
  { num: 29, name: "Joel", abbr: "Joel", teluguName: "యోవేలు", teluguAbbr: "యోవే", testament: "OT", nivFile: "Joel" },
  { num: 30, name: "Amos", abbr: "Amos", teluguName: "ఆమోసు", teluguAbbr: "ఆమో", testament: "OT", nivFile: "Amos" },
  { num: 31, name: "Obadiah", abbr: "Obad", teluguName: "ఓబద్యా", teluguAbbr: "ఓబ", testament: "OT", nivFile: "Obadiah" },
  { num: 32, name: "Jonah", abbr: "Jonah", teluguName: "యోనా", teluguAbbr: "యోనా", testament: "OT", nivFile: "Jonah" },
  { num: 33, name: "Micah", abbr: "Mic", teluguName: "మీకా", teluguAbbr: "మీకా", testament: "OT", nivFile: "Micah" },
  { num: 34, name: "Nahum", abbr: "Nah", teluguName: "నహూము", teluguAbbr: "నహూ", testament: "OT", nivFile: "Nahum" },
  { num: 35, name: "Habakkuk", abbr: "Hab", teluguName: "హబక్కూకు", teluguAbbr: "హబ", testament: "OT", nivFile: "Habakkuk" },
  { num: 36, name: "Zephaniah", abbr: "Zeph", teluguName: "జెఫన్యా", teluguAbbr: "జెఫ", testament: "OT", nivFile: "Zephaniah" },
  { num: 37, name: "Haggai", abbr: "Hag", teluguName: "హగ్గయి", teluguAbbr: "హగ్గ", testament: "OT", nivFile: "Haggai" },
  { num: 38, name: "Zechariah", abbr: "Zech", teluguName: "జెకర్యా", teluguAbbr: "జెక", testament: "OT", nivFile: "Zechariah" },
  { num: 39, name: "Malachi", abbr: "Mal", teluguName: "మలాకీ", teluguAbbr: "మలా", testament: "OT", nivFile: "Malachi" },
  { num: 40, name: "Matthew", abbr: "Matt", teluguName: "మత్తయి", teluguAbbr: "మత్త", testament: "NT", nivFile: "Matthew" },
  { num: 41, name: "Mark", abbr: "Mark", teluguName: "మార్కు", teluguAbbr: "మార్కు", testament: "NT", nivFile: "Mark" },
  { num: 42, name: "Luke", abbr: "Luke", teluguName: "లూకా", teluguAbbr: "లూకా", testament: "NT", nivFile: "Luke" },
  { num: 43, name: "John", abbr: "John", teluguName: "యోహాను", teluguAbbr: "యోహాను", testament: "NT", nivFile: "John" },
  { num: 44, name: "Acts", abbr: "Acts", teluguName: "అపొస్తలుల కార్యములు", teluguAbbr: "అపొ", testament: "NT", nivFile: "Acts" },
  { num: 45, name: "Romans", abbr: "Rom", teluguName: "రోమీయులకు", teluguAbbr: "రోమా", testament: "NT", nivFile: "Romans" },
  { num: 46, name: "1 Corinthians", abbr: "1 Cor", teluguName: "1 కొరింథీయులకు", teluguAbbr: "1 కొరిం", testament: "NT", nivFile: "1 Corinthians" },
  { num: 47, name: "2 Corinthians", abbr: "2 Cor", teluguName: "2 కొరింథీయులకు", teluguAbbr: "2 కొరిం", testament: "NT", nivFile: "2 Corinthians" },
  { num: 48, name: "Galatians", abbr: "Gal", teluguName: "గలతీయులకు", teluguAbbr: "గలతీ", testament: "NT", nivFile: "Galatians" },
  { num: 49, name: "Ephesians", abbr: "Eph", teluguName: "ఎఫెసీయులకు", teluguAbbr: "ఎఫెసీ", testament: "NT", nivFile: "Ephesians" },
  { num: 50, name: "Philippians", abbr: "Phil", teluguName: "ఫిలిప్పీయులకు", teluguAbbr: "ఫిలిప్పీ", testament: "NT", nivFile: "Philippians" },
  { num: 51, name: "Colossians", abbr: "Col", teluguName: "కొలొస్సయులకు", teluguAbbr: "కొలొస్స", testament: "NT", nivFile: "Colossians" },
  { num: 52, name: "1 Thessalonians", abbr: "1 Thess", teluguName: "1 థెస్సలొనీకయులకు", teluguAbbr: "1 థెస్స", testament: "NT", nivFile: "1 Thessalonians" },
  { num: 53, name: "2 Thessalonians", abbr: "2 Thess", teluguName: "2 థెస్సలొనీకయులకు", teluguAbbr: "2 థెస్స", testament: "NT", nivFile: "2 Thessalonians" },
  { num: 54, name: "1 Timothy", abbr: "1 Tim", teluguName: "1 తిమోతికి", teluguAbbr: "1 తిమో", testament: "NT", nivFile: "1 Timothy" },
  { num: 55, name: "2 Timothy", abbr: "2 Tim", teluguName: "2 తిమోతికి", teluguAbbr: "2 తిమో", testament: "NT", nivFile: "2 Timothy" },
  { num: 56, name: "Titus", abbr: "Titus", teluguName: "తీతుకు", teluguAbbr: "తీతు", testament: "NT", nivFile: "Titus" },
  { num: 57, name: "Philemon", abbr: "Phlm", teluguName: "ఫిలేమోనుకు", teluguAbbr: "ఫిలే", testament: "NT", nivFile: "Philemon" },
  { num: 58, name: "Hebrews", abbr: "Heb", teluguName: "హెబ్రీయులకు", teluguAbbr: "హెబ్రీ", testament: "NT", nivFile: "Hebrews" },
  { num: 59, name: "James", abbr: "Jas", teluguName: "యాకోబు", teluguAbbr: "యాకోబు", testament: "NT", nivFile: "James" },
  { num: 60, name: "1 Peter", abbr: "1 Pet", teluguName: "1 పేతురు", teluguAbbr: "1 పేతు", testament: "NT", nivFile: "1 Peter" },
  { num: 61, name: "2 Peter", abbr: "2 Pet", teluguName: "2 పేతురు", teluguAbbr: "2 పేతు", testament: "NT", nivFile: "2 Peter" },
  { num: 62, name: "1 John", abbr: "1 John", teluguName: "1 యోహాను", teluguAbbr: "1 యోహా", testament: "NT", nivFile: "1 John" },
  { num: 63, name: "2 John", abbr: "2 John", teluguName: "2 యోహాను", teluguAbbr: "2 యోహా", testament: "NT", nivFile: "2 John" },
  { num: 64, name: "3 John", abbr: "3 John", teluguName: "3 యోహాను", teluguAbbr: "3 యోహా", testament: "NT", nivFile: "3 John" },
  { num: 65, name: "Jude", abbr: "Jude", teluguName: "యూదా", teluguAbbr: "యూదా", testament: "NT", nivFile: "Jude" },
  { num: 66, name: "Revelation", abbr: "Rev", teluguName: "ప్రకటన గ్రంథము", teluguAbbr: "ప్రక", testament: "NT", nivFile: "Revelation" },
]

async function importTelugu(translationId) {
  console.log(`\n=== Importing Telugu Bible (ID: ${translationId}) ===`)
  const url = "https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Telugu/bible.json"
  console.log(`Downloading Telugu dataset from ${url}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch Telugu data: ${res.statusText}`)
  const data = await res.json()
  
  // Clean existing Telugu books/verses if any
  db.prepare("DELETE FROM verses WHERE translation_id = ?").run(translationId)
  db.prepare("DELETE FROM books WHERE translation_id = ?").run(translationId)

  const insertBook = db.prepare(
    "INSERT INTO books (translation_id, book_number, name, abbreviation, testament) VALUES (?, ?, ?, ?, ?)"
  )
  const insertVerse = db.prepare(
    "INSERT INTO verses (translation_id, book_id, book_number, book_name, book_abbreviation, chapter, verse, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )

  let totalVerses = 0

  for (let bIndex = 0; bIndex < STANDARD_BOOKS.length; bIndex++) {
    const bookMeta = STANDARD_BOOKS[bIndex]
    const bookData = data.Book[bIndex]
    if (!bookData) continue

    const bookResult = insertBook.run(
      translationId,
      bookMeta.num,
      bookMeta.teluguName,
      bookMeta.teluguAbbr,
      bookMeta.testament
    )
    const bookId = Number(bookResult.lastInsertRowid)

    for (let cIndex = 0; cIndex < bookData.Chapter.length; cIndex++) {
      const chData = bookData.Chapter[cIndex]
      const chapterNum = cIndex + 1
      if (!chData?.Verse) continue

      for (let vIndex = 0; vIndex < chData.Verse.length; vIndex++) {
        const vObj = chData.Verse[vIndex]
        const verseNum = vIndex + 1
        const rawText = (vObj.Verse || "").trim()
        if (!rawText) continue

        insertVerse.run(
          translationId,
          bookId,
          bookMeta.num,
          bookMeta.teluguName,
          bookMeta.teluguAbbr,
          chapterNum,
          verseNum,
          rawText
        )
        totalVerses++
      }
    }
  }

  console.log(`✓ Telugu import finished! Inserted ${STANDARD_BOOKS.length} books and ${totalVerses} verses.`)
}

async function importNIV(translationId) {
  console.log(`\n=== Importing NIV Bible (ID: ${translationId}) ===`)
  
  // Clean existing NIV books/verses if any
  db.prepare("DELETE FROM verses WHERE translation_id = ?").run(translationId)
  db.prepare("DELETE FROM books WHERE translation_id = ?").run(translationId)

  const insertBook = db.prepare(
    "INSERT INTO books (translation_id, book_number, name, abbreviation, testament) VALUES (?, ?, ?, ?, ?)"
  )
  const insertVerse = db.prepare(
    "INSERT INTO verses (translation_id, book_id, book_number, book_name, book_abbreviation, chapter, verse, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )

  let totalVerses = 0

  for (let bIndex = 0; bIndex < STANDARD_BOOKS.length; bIndex++) {
    const bookMeta = STANDARD_BOOKS[bIndex]
    const url = `https://raw.githubusercontent.com/aruljohn/Bible-niv/master/${encodeURIComponent(bookMeta.nivFile)}.json`
    process.stdout.write(`Downloading ${bookMeta.name} (${bIndex + 1}/${STANDARD_BOOKS.length})...\r`)
    
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`\nWarning: Could not fetch ${bookMeta.name} from ${url}: ${res.statusText}`)
      continue
    }
    const bookData = await res.json()

    const bookResult = insertBook.run(
      translationId,
      bookMeta.num,
      bookMeta.name,
      bookMeta.abbr,
      bookMeta.testament
    )
    const bookId = Number(bookResult.lastInsertRowid)

    if (Array.isArray(bookData.chapters)) {
      for (const chObj of bookData.chapters) {
        const chapterNum = Number(chObj.chapter)
        if (!Array.isArray(chObj.verses)) continue
        for (const vObj of chObj.verses) {
          const verseNum = Number(vObj.verse)
          const text = (vObj.text || "").trim()
          if (!text) continue

          insertVerse.run(
            translationId,
            bookId,
            bookMeta.num,
            bookMeta.name,
            bookMeta.abbr,
            chapterNum,
            verseNum,
            text
          )
          totalVerses++
        }
      }
    }
  }

  console.log(`\n✓ NIV import finished! Inserted ${STANDARD_BOOKS.length} books and ${totalVerses} verses.`)
}

async function run() {
  // Ensure NIV exists in translations table
  let nivRow = db.prepare("SELECT * FROM translations WHERE abbreviation = 'NIV'").get()
  if (!nivRow) {
    const res = db.prepare(
      "INSERT INTO translations (abbreviation, title, language, license, is_copyrighted, is_downloaded) VALUES ('NIV', 'New International Version', 'en', 'Biblica', 0, 1)"
    ).run()
    nivRow = { id: Number(res.lastInsertRowid) }
  }

  // Ensure TEL exists in translations table
  let telRow = db.prepare("SELECT * FROM translations WHERE abbreviation = 'TEL'").get()
  if (!telRow) {
    const res = db.prepare(
      "INSERT INTO translations (abbreviation, title, language, license, is_copyrighted, is_downloaded) VALUES ('TEL', 'Telugu Bible (పరిశుద్ధ గ్రంథము)', 'te', 'Public Domain', 0, 1)"
    ).run()
    telRow = { id: Number(res.lastInsertRowid) }
  }

  console.log(`NIV translation ID: ${nivRow.id}`)
  console.log(`Telugu translation ID: ${telRow.id}`)

  await importTelugu(telRow.id)
  await importNIV(nivRow.id)

  console.log("\nRebuilding FTS virtual table...")
  try {
    db.prepare("INSERT INTO verses_fts(verses_fts) VALUES('rebuild')").run()
    console.log("✓ FTS rebuild complete!")
  } catch (err) {
    console.log("FTS rebuild note:", err.message)
  }

  console.log("\nAll translations successfully imported!")
}

run().catch(err => {
  console.error("Fatal import error:", err)
  process.exit(1)
})

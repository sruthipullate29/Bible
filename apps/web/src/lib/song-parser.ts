import JSZip from "jszip"

export interface SongSlide {
  id: string
  label: string
  text: string
}

export interface ParsedSong {
  title: string
  author?: string
  slides: SongSlide[]
}

const SECTION_HEADER_REGEX = /^(?:\[|\()?((?:verse|chorus|bridge|pre-chorus|intro|outro|ending|stanza|refrain|tag|coda|hook)(?:\s*\d+)?)(?:\]|\)|\:)?$/i

export function parseTextToSlides(rawText: string, defaultTitle?: string): ParsedSong {
  const clean = rawText.trim()
  if (!clean) {
    return {
      title: defaultTitle || "Untitled Song",
      slides: [],
    }
  }

  const rawLines = clean.split(/\r?\n/)
  let extractedTitle = defaultTitle?.trim() || ""
  let extractedAuthor = ""
  let contentStartIndex = 0

  // If no title was provided, try detecting title & author from top lines
  if (!extractedTitle && rawLines.length > 0) {
    const firstLine = rawLines[0].trim()
    if (firstLine && !SECTION_HEADER_REGEX.test(firstLine) && firstLine.length < 75) {
      extractedTitle = firstLine.replace(/^[#*]+/, "").trim()
      contentStartIndex = 1

      // Check second line for author (e.g. "by Chris Tomlin" or "John Newton")
      if (rawLines.length > 1) {
        const secondLine = rawLines[1].trim()
        if (
          secondLine &&
          !SECTION_HEADER_REGEX.test(secondLine) &&
          (secondLine.toLowerCase().startsWith("by ") || secondLine.length < 50) &&
          !secondLine.includes("  ")
        ) {
          extractedAuthor = secondLine.replace(/^by\s+/i, "").trim()
          contentStartIndex = 2
        }
      }
    }
  }

  if (!extractedTitle) {
    extractedTitle = "Untitled Song"
  }

  const lines = rawLines.slice(contentStartIndex)
  const slides: SongSlide[] = []
  let currentLabel = ""
  let currentLines: string[] = []
  let slideCounter = 1

  const flushSlide = () => {
    const slideText = currentLines.join("\n").trim()
    if (slideText) {
      slides.push({
        id: `slide-${Date.now()}-${slideCounter}`,
        label: currentLabel || `Slide ${slideCounter}`,
        text: slideText,
      })
      slideCounter++
    }
    currentLines = []
    currentLabel = ""
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Check for section headers like [Verse 1], Chorus:, Stanza 2
    const headerMatch = line.match(SECTION_HEADER_REGEX)
    if (headerMatch) {
      flushSlide()
      currentLabel = headerMatch[1].trim()
      continue
    }

    // Blank line indicates a slide / stanza break
    if (!line) {
      if (currentLines.length > 0) {
        flushSlide()
      }
      continue
    }

    currentLines.push(line)
  }

  flushSlide()

  // Fallback: If no slides were created (e.g. empty lines), make one slide with whole text
  if (slides.length === 0 && clean) {
    slides.push({
      id: `slide-${Date.now()}-1`,
      label: "Slide 1",
      text: clean,
    })
  }

  return {
    title: extractedTitle,
    author: extractedAuthor,
    slides,
  }
}

export async function parseDocxFile(file: File | ArrayBuffer, filename = ""): Promise<ParsedSong> {
  const zip = await JSZip.loadAsync(file)
  const docXmlFile = zip.files["word/document.xml"]
  if (!docXmlFile) {
    throw new Error("Invalid Word document: missing word/document.xml inside archive.")
  }

  const xmlText = await docXmlFile.async("text")
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, "application/xml")

  // Extract all paragraphs
  const paragraphs = Array.from(xmlDoc.getElementsByTagName("w:p"))
  const lines: string[] = []

  for (const p of paragraphs) {
    const textNodes = Array.from(p.getElementsByTagName("w:t"))
    const pText = textNodes.map((n) => n.textContent || "").join("").trim()
    lines.push(pText)
  }

  const defaultTitle = filename.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ")
  return parseTextToSlides(lines.join("\n"), defaultTitle)
}

export async function parsePptxFile(file: File | ArrayBuffer, filename = ""): Promise<ParsedSong> {
  const zip = await JSZip.loadAsync(file)
  const slideFilenames = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/i.test(name)
  )

  if (slideFilenames.length === 0) {
    throw new Error("No PowerPoint slides found in this presentation.")
  }

  // Sort slides numerically: slide1.xml, slide2.xml, slide10.xml
  slideFilenames.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)![0], 10)
    const numB = parseInt(b.match(/\d+/)![0], 10)
    return numA - numB
  })

  const parser = new DOMParser()
  const slides: SongSlide[] = []
  let detectedTitle = filename.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ")

  for (let idx = 0; idx < slideFilenames.length; idx++) {
    const sName = slideFilenames[idx]
    const xmlText = await zip.files[sName].async("text")
    const xmlDoc = parser.parseFromString(xmlText, "application/xml")

    // Paragraphs inside a slide
    const paragraphs = Array.from(xmlDoc.getElementsByTagName("a:p"))
    const slideLines: string[] = []

    for (const p of paragraphs) {
      const textNodes = Array.from(p.getElementsByTagName("a:t"))
      const line = textNodes.map((t) => t.textContent || "").join("").trim()
      if (line) {
        slideLines.push(line)
      }
    }

    const slideText = slideLines.join("\n").trim()
    if (!slideText) continue

    // Use first slide as Title if short and first slide
    if (idx === 0 && slideLines.length === 1 && slideText.length < 60) {
      detectedTitle = slideText
    }

    slides.push({
      id: `slide-${Date.now()}-${idx + 1}`,
      label: `Slide ${idx + 1}`,
      text: slideText,
    })
  }

  return {
    title: detectedTitle || "PowerPoint Presentation",
    slides,
  }
}

export async function parseSongFile(file: File): Promise<ParsedSong> {
  const name = file.name.toLowerCase()

  if (name.endsWith(".pptx") || name.endsWith(".ppt")) {
    return parsePptxFile(file, file.name)
  }

  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    return parseDocxFile(file, file.name)
  }

  // Plain text, markdown, or text-based lyric file
  const text = await file.text()
  const defaultTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ")
  return parseTextToSlides(text, defaultTitle)
}

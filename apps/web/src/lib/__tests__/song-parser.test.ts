import { describe, it, expect } from "vitest"
import { parseTextToSlides } from "@/lib/song-parser"

describe("Song & Lyrics Parser", () => {
  it("extracts song title, author, and section slides from text", () => {
    const raw = `Amazing Grace
John Newton

[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me

[Chorus]
My chains are gone
I've been set free

[Verse 2]
'Twas grace that taught my heart to fear
And grace my fears relieved`

    const parsed = parseTextToSlides(raw)

    expect(parsed.title).toBe("Amazing Grace")
    expect(parsed.author).toBe("John Newton")
    expect(parsed.slides).toHaveLength(3)
    expect(parsed.slides[0].label).toBe("Verse 1")
    expect(parsed.slides[0].text).toContain("Amazing grace how sweet the sound")
    expect(parsed.slides[1].label).toBe("Chorus")
    expect(parsed.slides[1].text).toContain("My chains are gone")
    expect(parsed.slides[2].label).toBe("Verse 2")
    expect(parsed.slides[2].text).toContain("'Twas grace that taught")
  })

  it("splits stanzas by empty lines if no section headers exist", () => {
    const raw = `యేసయ్య నా ప్రాణమా
నిన్నే నే స్తుతించెదన్

జీవితాంతం నీలోనే
నే జీవించెదన్`

    const parsed = parseTextToSlides(raw, "Yesayya")

    expect(parsed.title).toBe("Yesayya")
    expect(parsed.slides).toHaveLength(2)
    expect(parsed.slides[0].text).toContain("యేసయ్య నా ప్రాణమా")
    expect(parsed.slides[1].text).toContain("జీవితాంతం నీలోనే")
  })
})

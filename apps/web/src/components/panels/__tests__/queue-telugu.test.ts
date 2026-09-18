// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { toVerseRenderData, deriveLiveVerse } from "@/hooks/use-broadcast"
import { useBibleStore } from "@/stores/bible-store"
import { useQueueStore } from "@/stores/queue-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import type { Verse, QueueItem } from "@/types"

vi.mock("@/streams/setup", () => ({ getManager: () => null }))

describe("Queue Telugu bilingual and chapter display", () => {
  const englishVerse: Verse = {
    id: 181708,
    translation_id: 5,
    book_number: 43,
    book_name: "John",
    book_abbreviation: "John",
    chapter: 3,
    verse: 16,
    text: "For God so loved the world that he gave his one and only Son...",
  }

  const teluguVerse: Verse = {
    id: 150616,
    translation_id: 6,
    book_number: 43,
    book_name: "యోహాను",
    book_abbreviation: "యోహాను",
    chapter: 3,
    verse: 16,
    text: "దేవుడు లోకమును ఎంతో ప్రేమించెను...",
  }

  beforeEach(() => {
    useBibleStore.setState({
      activeTranslationId: 5,
      secondaryTranslationId: 6,
      isDualMode: true,
      selectedVerse: null,
      pendingNavigation: null,
      currentChapter: [],
      secondaryChapter: [],
    })
    useQueueStore.setState({
      items: [],
      activeIndex: null,
    })
    useBroadcastStore.setState({
      isLive: true,
      liveVerse: null,
    })
  })

  it("produces bilingual Telugu render data when secondary verse is provided", () => {
    const renderData = toVerseRenderData(englishVerse, "NIV", teluguVerse, "TEL")

    expect(renderData.reference).toContain("John 3:16")
    expect(renderData.reference).toContain("యోహాను 3:16")
    expect(renderData.segments[0].text).toContain(englishVerse.text)
    expect(renderData.segments[0].text).toContain(teluguVerse.text)
    expect(renderData.segments[0].text).toContain("\n\n")
  })

  it("stores secondaryVerse on queue items", () => {
    const queueItem: QueueItem = {
      id: "test-1",
      verse: englishVerse,
      secondaryVerse: teluguVerse,
      reference: "John 3:16",
      confidence: 1,
      source: "manual",
      added_at: Date.now(),
    }

    useQueueStore.getState().addItem(queueItem)
    const stored = useQueueStore.getState().items[0]

    expect(stored.secondaryVerse).toBeDefined()
    expect(stored.secondaryVerse?.text).toBe(teluguVerse.text)
    expect(stored.secondaryVerse?.book_name).toBe("యోహాను")
  })

  it("sets pending navigation for book search when navigating to verse", () => {
    useBibleStore.getState().setPendingNavigation({
      bookNumber: 43,
      chapter: 3,
      verse: 16,
    })

    const pending = useBibleStore.getState().pendingNavigation
    expect(pending).toEqual({
      bookNumber: 43,
      chapter: 3,
      verse: 16,
    })
  })

  it("derives live verse with Telugu when live and dual mode active", () => {
    const liveVerse = deriveLiveVerse({
      isLive: true,
      selectedVerse: englishVerse,
      translation: "NIV",
      secondaryVerse: teluguVerse,
      secondaryTranslation: "TEL",
    })

    expect(liveVerse).not.toBeNull()
    expect(liveVerse?.reference).toBe("John 3:16  •  యోహాను 3:16")
    expect(liveVerse?.segments[0].text).toBe(
      `${englishVerse.text}\n\n${teluguVerse.text}`
    )
  })

  it("updates selectedVerse and liveVerse when a new verse in the same chapter is played", () => {
    const verse17: Verse = {
      ...englishVerse,
      id: 181709,
      verse: 17,
      text: "For God did not send his Son into the world to condemn the world...",
    }
    const secVerse17: Verse = {
      ...teluguVerse,
      id: 150617,
      verse: 17,
      text: "లోకము తన ద్వారా రక్షణ పొందుటకే గాని...",
    }

    useBibleStore.getState().selectVerse(verse17)
    useBroadcastStore.getState().setLiveVerse(
      toVerseRenderData(verse17, "NIV", secVerse17, "TEL")
    )

    const currentLive = useBroadcastStore.getState().liveVerse
    expect(currentLive?.reference).toBe("John 3:17  •  యోహాను 3:17")
    expect(currentLive?.segments[0].verseNumber).toBe(17)
    expect(useBibleStore.getState().selectedVerse?.verse).toBe(17)
  })

  it("updates selectedVerse and liveVerse when a verse in a different chapter is played", () => {
    const verse4_1: Verse = {
      ...englishVerse,
      id: 181750,
      chapter: 4,
      verse: 1,
      text: "Now Jesus learned that the Pharisees had heard...",
    }
    const secVerse4_1: Verse = {
      ...teluguVerse,
      id: 150650,
      chapter: 4,
      verse: 1,
      text: "పరిసయ్యులు వినిన సంగతి ప్రభువునకు తెలిసినప్పుడు...",
    }

    useBibleStore.getState().selectVerse(verse4_1)
    useBroadcastStore.getState().setLiveVerse(
      toVerseRenderData(verse4_1, "NIV", secVerse4_1, "TEL")
    )

    const currentLive = useBroadcastStore.getState().liveVerse
    expect(currentLive?.reference).toBe("John 4:1  •  యోహాను 4:1")
    expect(currentLive?.segments[0].verseNumber).toBe(1)
    expect(useBibleStore.getState().selectedVerse?.chapter).toBe(4)
    expect(useBibleStore.getState().selectedVerse?.verse).toBe(1)
  })

  it("parses Telugu references and bilingual references correctly", async () => {
    const { resolveBook, parseReference } = await import("@/lib/bible-books")

    const teluguParsed = parseReference("యోహాను 3:16")
    expect(teluguParsed).not.toBeNull()
    expect(teluguParsed?.bookNumber).toBe(43)
    expect(teluguParsed?.bookName).toBe("John")
    expect(teluguParsed?.teluguName).toBe("యోహాను")
    expect(teluguParsed?.chapter).toBe(3)
    expect(teluguParsed?.verse).toBe(16)

    const bilingualParsed = parseReference("John 3:16  •  యోహాను 3:16")
    expect(bilingualParsed).not.toBeNull()
    expect(bilingualParsed?.bookNumber).toBe(43)
    expect(bilingualParsed?.chapter).toBe(3)
    expect(bilingualParsed?.verse).toBe(16)

    const firstJohn = parseReference("1 యోహాను 1:9")
    expect(firstJohn).not.toBeNull()
    expect(firstJohn?.bookNumber).toBe(62)
    expect(firstJohn?.chapter).toBe(1)
    expect(firstJohn?.verse).toBe(9)

    expect(resolveBook(43)?.name).toBe("John")
    expect(resolveBook(43)?.teluguName).toBe("యోహాను")
    expect(resolveBook("యోహాను")?.num).toBe(43)
    expect(resolveBook("1 యోహాను")?.num).toBe(62)
    expect(resolveBook("Genesis")?.num).toBe(1)
    expect(resolveBook("ఆదికాండము")?.num).toBe(1)
  })
})


import { useBroadcastStore } from "@/stores/broadcast-store"
import { useBibleStore } from "@/stores/bible-store"
import { useQueueStore } from "@/stores/queue-store"
import { toVerseRenderData } from "@/hooks/use-broadcast"
import { bibleActions } from "@/hooks/use-bible"
import { parseReference, resolveBook } from "@/lib/bible-books"
import type { Verse } from "@/types"

/**
 * Find the index of the currently displayed verse in the queue.
 */
function findCurrentVerseIndex(): number | null {
  const { items, activeIndex } = useQueueStore.getState()
  if (activeIndex !== null && activeIndex >= 0 && activeIndex < items.length) {
    return activeIndex
  }
  const { liveVerse } = useBroadcastStore.getState()
  if (!liveVerse) return null

  const index = items.findIndex(
    (item) =>
      item.reference === liveVerse.reference ||
      liveVerse.reference.includes(item.reference) ||
      item.reference.includes(liveVerse.reference)
  )
  return index >= 0 ? index : null
}

/**
 * Present a queue item at the given index to the live display.
 */
export async function presentQueueItem(index: number) {
  try {
    const { items } = useQueueStore.getState()
    const item = items[index]
    if (!item) return

    const parsed = parseReference(item.reference)
    let bookNumber = Number(item.verse.book_number) || 0
    let chapter = Number(item.verse.chapter) || 0
    let verse = Number(item.verse.verse) || 0

    if (parsed) {
      if (!bookNumber) bookNumber = parsed.bookNumber
      if (!chapter) chapter = parsed.chapter
      if (!verse) verse = parsed.verse
    }
    if (!bookNumber && item.verse.book_name) {
      const res = resolveBook(item.verse.book_name)
      if (res) bookNumber = res.num
    }

    const resBook = resolveBook(bookNumber)
    const bookName = resBook?.name || item.verse.book_name || ""
    const teluguBookName = resBook?.teluguName || item.secondaryVerse?.book_name || ""

    const verseToPresent: Verse = {
      ...item.verse,
      book_number: bookNumber,
      book_name: bookName,
      chapter,
      verse,
    }

    const bibleState = useBibleStore.getState()
    const { isDualMode, secondaryTranslationId, translations, activeTranslationId } = bibleState
    const translation =
      translations.find((t) => t.id === activeTranslationId)?.abbreviation ?? "NIV"
    const secondaryTranslation =
      translations.find((t) => t.id === secondaryTranslationId)?.abbreviation ?? "TEL"

    let secVerse = isDualMode ? item.secondaryVerse ?? null : null
    if (secVerse && !secVerse.book_name && teluguBookName) {
      secVerse = { ...secVerse, book_name: teluguBookName, book_number: bookNumber }
    }
    const verseToSelect = secVerse ? { ...verseToPresent, secondaryVerse: secVerse } : verseToPresent

    bibleState.selectVerse(verseToSelect)
    if (bookNumber > 0) {
      bibleActions.navigateToVerse(bookNumber, chapter, verse)
    }
    useBroadcastStore.getState().setLive(true)
    useBroadcastStore
      .getState()
      .setLiveVerse(toVerseRenderData(verseToPresent, translation, isDualMode ? secVerse : null, isDualMode ? secondaryTranslation : undefined))
  } catch (e) {
    console.warn("[remote-control] presentQueueItem failed:", e)
  }
}

/**
 * Navigate to next verse in queue.
 */
export function navigateNext() {
  const { items, activeIndex } = useQueueStore.getState()
  if (items.length === 0) return

  const currentIndex = activeIndex ?? findCurrentVerseIndex()
  const nextIndex = Math.min(
    currentIndex === null ? 0 : currentIndex + 1,
    items.length - 1
  )
  useQueueStore.getState().setActive(nextIndex)
  presentQueueItem(nextIndex)
}

/**
 * Navigate to previous verse in queue.
 */
export function navigatePrev() {
  const { items, activeIndex } = useQueueStore.getState()
  if (items.length === 0) return

  const currentIndex = activeIndex ?? findCurrentVerseIndex()
  const prevIndex = Math.max(
    currentIndex === null ? 0 : currentIndex - 1,
    0
  )
  useQueueStore.getState().setActive(prevIndex)
  presentQueueItem(prevIndex)
}

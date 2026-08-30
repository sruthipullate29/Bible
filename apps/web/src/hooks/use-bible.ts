import { useBibleStore } from "@/stores"
import { api } from "@/services"
import type { Verse } from "@/types"

async function loadTranslations() {
  const translations = await api.listTranslations()
  useBibleStore.getState().setTranslations(translations)
  return translations
}

async function loadBooks(translationId?: number) {
  const tid = translationId ?? useBibleStore.getState().activeTranslationId
  const books = await api.listBooks(tid)
  useBibleStore.getState().setBooks(books)
  return books
}

async function loadChapter(
  bookNumber: number,
  chapter: number,
  translationId?: number,
) {
  const tid = translationId ?? useBibleStore.getState().activeTranslationId
  const { isDualMode, secondaryTranslationId } = useBibleStore.getState()
  
  const [verses, secVerses] = await Promise.all([
    api.getChapter(tid, bookNumber, chapter),
    isDualMode && secondaryTranslationId && secondaryTranslationId !== tid
      ? api.getChapter(secondaryTranslationId, bookNumber, chapter).catch(() => [] as Verse[])
      : Promise.resolve([] as Verse[]),
  ])

  useBibleStore.getState().setCurrentChapter(verses)
  useBibleStore.getState().setSecondaryChapter(secVerses)
  return verses
}


async function fetchVerse(
  bookNumber: number,
  chapter: number,
  verse: number,
  translationId?: number,
): Promise<Verse | null> {
  const tid = translationId ?? useBibleStore.getState().activeTranslationId
  return api.getVerse(tid, bookNumber, chapter, verse)
}

async function searchVerses(
  query: string,
  limit = 20,
  translationId?: number,
) {
  const tid = translationId ?? useBibleStore.getState().activeTranslationId
  const results = await api.searchVerses(query, tid, limit)
  useBibleStore.getState().setSearchResults(results)
  return results
}

async function semanticSearch(query: string, limit = 10) {
  const results = await api.semanticSearch(query, limit)
  useBibleStore.getState().setSemanticResults(results)
  return results
}

async function loadCrossReferences(
  bookNumber: number,
  chapter: number,
  verse: number,
) {
  const refs = await api.getCrossReferences(bookNumber, chapter, verse)
  useBibleStore.getState().setCrossReferences(refs)
  return refs
}

export const bibleActions = {
  loadTranslations,
  loadBooks,
  loadChapter,
  fetchVerse,
  searchVerses,
  semanticSearch,
  loadCrossReferences,
  navigateToVerse: (bookNumber: number, chapter: number, verse: number) =>
    useBibleStore
      .getState()
      .setPendingNavigation({ bookNumber, chapter, verse }),
  selectVerse: (verse: Verse | null) =>
    useBibleStore.getState().selectVerse(verse),
}

export function useBible() {
  const translations = useBibleStore((s) => s.translations)
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)
  const books = useBibleStore((s) => s.books)
  const currentChapter = useBibleStore((s) => s.currentChapter)
  const searchResults = useBibleStore((s) => s.searchResults)
  const semanticResults = useBibleStore((s) => s.semanticResults)
  const selectedVerse = useBibleStore((s) => s.selectedVerse)
  const crossReferences = useBibleStore((s) => s.crossReferences)

  return {
    translations,
    activeTranslationId,
    books,
    currentChapter,
    searchResults,
    semanticResults,
    selectedVerse,
    crossReferences,
    ...bibleActions,
  }
}

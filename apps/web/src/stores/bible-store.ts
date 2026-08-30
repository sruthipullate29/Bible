import { create } from "zustand"
import type { Translation, Book, Verse, CrossReference } from "@/types"
import type { SemanticSearchResult } from "@/types/detection"

interface PendingNavigation {
  bookNumber: number
  chapter: number
  verse: number
}

interface BibleState {
  translations: Translation[]
  activeTranslationId: number
  secondaryTranslationId: number | null
  isDualMode: boolean
  books: Book[]
  searchResults: Verse[]
  semanticResults: SemanticSearchResult[]
  selectedVerse: Verse | null
  currentChapter: Verse[]
  secondaryChapter: Verse[]
  crossReferences: CrossReference[]
  pendingNavigation: PendingNavigation | null

  setTranslations: (translations: Translation[]) => void
  setActiveTranslation: (id: number) => void
  setSecondaryTranslationId: (id: number | null) => void
  setIsDualMode: (isDual: boolean) => void
  setBooks: (books: Book[]) => void
  setSearchResults: (results: Verse[]) => void
  setSemanticResults: (results: SemanticSearchResult[]) => void
  selectVerse: (verse: Verse | null) => void
  setCurrentChapter: (verses: Verse[]) => void
  setSecondaryChapter: (verses: Verse[]) => void
  setCrossReferences: (refs: CrossReference[]) => void
  setPendingNavigation: (nav: PendingNavigation | null) => void
}

export const useBibleStore = create<BibleState>((set, get) => ({
  translations: [],
  activeTranslationId: 5, // Default to NIV
  secondaryTranslationId: 6, // Default secondary to Telugu
  isDualMode: true, // Enable Dual Language (English + Telugu) by default
  books: [],
  searchResults: [],
  semanticResults: [],
  selectedVerse: null,
  currentChapter: [],
  secondaryChapter: [],
  crossReferences: [],
  pendingNavigation: null,

  setTranslations: (translations) => {
    // If NIV or Telugu exist in the fetched translations, ensure IDs match
    const niv = translations.find((t) => t.abbreviation === "NIV")
    const tel = translations.find((t) => t.abbreviation === "TEL")
    const currentActive = get().activeTranslationId
    const currentSecondary = get().secondaryTranslationId
    
    set({
      translations,
      activeTranslationId: currentActive || (niv ? niv.id : (translations[0]?.id ?? 1)),
      secondaryTranslationId: currentSecondary || (tel ? tel.id : (translations.find(t => t.language === "te")?.id ?? null)),
    })
  },
  setActiveTranslation: (activeTranslationId) => set({ activeTranslationId }),
  setSecondaryTranslationId: (secondaryTranslationId) => set({ secondaryTranslationId }),
  setIsDualMode: (isDualMode) => set({ isDualMode }),
  setBooks: (books) => set({ books }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setSemanticResults: (semanticResults) => {
    const current = get().semanticResults
    if (current.length === 0 && semanticResults.length === 0) return
    if (current === semanticResults) return
    set({ semanticResults })
  },
  selectVerse: (selectedVerse) => set({ selectedVerse }),
  setCurrentChapter: (currentChapter) => set({ currentChapter }),
  setSecondaryChapter: (secondaryChapter) => set({ secondaryChapter }),
  setCrossReferences: (crossReferences) => set({ crossReferences }),
  setPendingNavigation: (pendingNavigation) => set({ pendingNavigation }),
}))


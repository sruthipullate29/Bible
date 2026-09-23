import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Song, Playlist } from "@/types"
import type { SongSlide } from "@/lib/song-parser"
import { useQueueStore } from "./queue-store"
import { useBroadcastStore } from "./broadcast-store"
import type { QueueItem } from "@/types"

export interface SongState {
  songs: Song[]
  playlists: Playlist[]
  activePlaylistId: string | null
  selectedSongId: string | null

  // Song actions
  addSong: (song: Omit<Song, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Song
  updateSong: (id: string, updates: Partial<Song>) => void
  deleteSong: (id: string) => void
  setSelectedSong: (id: string | null) => void

  // Playlist actions
  createPlaylist: (name: string, date?: string, description?: string) => Playlist
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void
  deletePlaylist: (id: string) => void
  setActivePlaylist: (id: string | null) => void
  addSongToPlaylist: (playlistId: string, songId: string) => void
  removeSongFromPlaylist: (playlistId: string, songIndex: number) => void
  reorderSongsInPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void

  // Queue & Presentation actions
  loadSongToQueue: (songId: string) => void
  loadPlaylistToQueue: (playlistId: string, append?: boolean) => void
  presentSlideDirectly: (slide: SongSlide, songTitle: string) => void
  previewSlideDirectly: (slide: SongSlide, songTitle: string) => void
}

function getTodayIsoDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const DEFAULT_SONGS: Song[] = [
  {
    id: "song-amazing-grace",
    title: "Amazing Grace",
    author: "John Newton",
    category: "Hymn",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    slides: [
      {
        id: "ag-v1",
        label: "Verse 1",
        text: "Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.",
      },
      {
        id: "ag-v2",
        label: "Verse 2",
        text: "'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed!",
      },
      {
        id: "ag-v3",
        label: "Verse 3",
        text: "Through many dangers, toils and snares,\nI have already come;\n'Tis grace hath brought me safe thus far,\nAnd grace will lead me home.",
      },
      {
        id: "ag-v4",
        label: "Verse 4",
        text: "When we've been there ten thousand years,\nBright shining as the sun,\nWe've no less days to sing God's praise\nThan when we'd first begun.",
      },
    ],
  },
  {
    id: "song-10000-reasons",
    title: "10,000 Reasons (Bless The Lord)",
    author: "Matt Redman",
    category: "Worship",
    createdAt: 1700000001000,
    updatedAt: 1700000001000,
    slides: [
      {
        id: "tr-c1",
        label: "Chorus",
        text: "Bless the Lord, O my soul, O my soul\nWorship His holy name\nSing like never before, O my soul\nI'll worship Your holy name",
      },
      {
        id: "tr-v1",
        label: "Verse 1",
        text: "The sun comes up, it's a new day dawning\nIt's time to sing Your song again\nWhatever may pass, and whatever lies before me\nLet me be singing when the evening comes",
      },
      {
        id: "tr-v2",
        label: "Verse 2",
        text: "You're rich in love, and You're slow to anger\nYour name is great, and Your heart is kind\nFor all Your goodness I will keep on singing\nTen thousand reasons for my heart to find",
      },
      {
        id: "tr-v3",
        label: "Verse 3",
        text: "And on that day when my strength is failing\nThe end draws near and my time has come\nStill my soul will sing Your praise unending\nTen thousand years and then forevermore",
      },
    ],
  },
  {
    id: "song-how-great-thou-art",
    title: "How Great Thou Art",
    author: "Stuart K. Hine",
    category: "Hymn",
    createdAt: 1700000002000,
    updatedAt: 1700000002000,
    slides: [
      {
        id: "hg-v1",
        label: "Verse 1",
        text: "O Lord my God, when I in awesome wonder\nConsider all the worlds Thy hands have made\nI see the stars, I hear the rolling thunder\nThy power throughout the universe displayed",
      },
      {
        id: "hg-c1",
        label: "Chorus",
        text: "Then sings my soul, my Savior God, to Thee\nHow great Thou art, how great Thou art\nThen sings my soul, my Savior God, to Thee\nHow great Thou art, how great Thou art!",
      },
      {
        id: "hg-v2",
        label: "Verse 2",
        text: "When through the woods and forest glades I wander\nAnd hear the birds sing sweetly in the trees\nWhen I look down from lofty mountain grandeur\nAnd hear the brook and feel the gentle breeze",
      },
    ],
  },
  {
    id: "song-neeve-naa-sannidhi",
    title: "Neeve Naa Sannidhi (నీవే నా సన్నిధి)",
    author: "Telugu Christian Worship",
    category: "Telugu",
    createdAt: 1700000003000,
    updatedAt: 1700000003000,
    slides: [
      {
        id: "nns-c1",
        label: "పల్లవి (Chorus)",
        text: "నీవే నా సన్నిధి - నీవే నా నిధి\nయేసయ్యా నా ప్రాణమా - నా ఆశ్రయ దుర్గమా\nనీవే నా సన్నిధి - నీవే నా నిధి",
      },
      {
        id: "nns-v1",
        label: "చరణం 1 (Verse 1)",
        text: "అలసిన వేళలో విశ్రాంతి నీవే\nకలత చెందే వేళ నెమ్మది నీవే\nనా భారమంతా మోసే బలం నీవే యేసయ్యా\nనీవే నా సన్నిధి - నీవే నా నిధి",
      },
      {
        id: "nns-v2",
        label: "చరణం 2 (Verse 2)",
        text: "కృపతో నను కాచి కరుణతో నింపి\nనా పాదములు జారక కాపాడినావు\nయుగయుగములు నీకే నా స్తోత్ర బలి అర్పింతును\nనీవే నా సన్నిధి - నీవే నా నిధి",
      },
    ],
  },
]

const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: "playlist-today-service",
    name: "Sunday Worship Service",
    date: getTodayIsoDate(),
    description: "Default service playlist with hymns and worship songs",
    songIds: ["song-amazing-grace", "song-10000-reasons", "song-neeve-naa-sannidhi"],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
]

export const useSongStore = create<SongState>()(
  persist(
    (set, get) => ({
      songs: DEFAULT_SONGS,
      playlists: DEFAULT_PLAYLISTS,
      activePlaylistId: "playlist-today-service",
      selectedSongId: "song-amazing-grace",

      addSong: (songInput) => {
        const id = songInput.id || `song-${Date.now()}`
        const now = Date.now()
        const newSong: Song = {
          ...songInput,
          id,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          songs: [newSong, ...state.songs.filter((s) => s.id !== id)],
          selectedSongId: id,
        }))
        return newSong
      },

      updateSong: (id, updates) =>
        set((state) => ({
          songs: state.songs.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
          ),
        })),

      deleteSong: (id) =>
        set((state) => ({
          songs: state.songs.filter((s) => s.id !== id),
          playlists: state.playlists.map((p) => ({
            ...p,
            songIds: p.songIds.filter((sid) => sid !== id),
          })),
          selectedSongId: state.selectedSongId === id ? null : state.selectedSongId,
        })),

      setSelectedSong: (id) => set({ selectedSongId: id }),

      createPlaylist: (name, date = getTodayIsoDate(), description) => {
        const id = `playlist-${Date.now()}`
        const now = Date.now()
        const newPlaylist: Playlist = {
          id,
          name: name.trim() || `Service - ${date}`,
          date,
          description,
          songIds: [],
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          playlists: [newPlaylist, ...state.playlists],
          activePlaylistId: id,
        }))
        return newPlaylist
      },

      updatePlaylist: (id, updates) =>
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
        })),

      deletePlaylist: (id) =>
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
          activePlaylistId: state.activePlaylistId === id ? null : state.activePlaylistId,
        })),

      setActivePlaylist: (id) => set({ activePlaylistId: id }),

      addSongToPlaylist: (playlistId, songId) =>
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId
              ? {
                  ...p,
                  songIds: [...p.songIds, songId],
                  updatedAt: Date.now(),
                }
              : p
          ),
        })),

      removeSongFromPlaylist: (playlistId, songIndex) =>
        set((state) => ({
          playlists: state.playlists.map((p) => {
            if (p.id !== playlistId) return p
            const nextSongIds = [...p.songIds]
            nextSongIds.splice(songIndex, 1)
            return { ...p, songIds: nextSongIds, updatedAt: Date.now() }
          }),
        })),

      reorderSongsInPlaylist: (playlistId, fromIndex, toIndex) =>
        set((state) => ({
          playlists: state.playlists.map((p) => {
            if (p.id !== playlistId) return p
            const nextSongIds = [...p.songIds]
            const [moved] = nextSongIds.splice(fromIndex, 1)
            nextSongIds.splice(toIndex, 0, moved)
            return { ...p, songIds: nextSongIds, updatedAt: Date.now() }
          }),
        })),

      loadSongToQueue: (songId) => {
        const song = get().songs.find((s) => s.id === songId)
        if (!song || song.slides.length === 0) return

        const queueItems: QueueItem[] = song.slides.map((slide, idx) => ({
          id: crypto.randomUUID(),
          verse: {
            id: (Date.now() + idx) % 2147483647,
            translation_id: 0,
            book_number: 0,
            book_name: song.title,
            book_abbreviation: song.author?.slice(0, 10).toUpperCase() || "SONG",
            chapter: 1,
            verse: idx + 1,
            text: slide.text,
          },
          reference: `${song.title} - ${slide.label}`,
          confidence: 1,
          source: "song",
          added_at: Date.now() + idx,
        }))

        useQueueStore.getState().appendItems(queueItems)
      },

      loadPlaylistToQueue: (playlistId, append = true) => {
        const playlist = get().playlists.find((p) => p.id === playlistId)
        if (!playlist || playlist.songIds.length === 0) return

        const allQueueItems: QueueItem[] = []
        let itemIndex = 0

        for (const songId of playlist.songIds) {
          const song = get().songs.find((s) => s.id === songId)
          if (!song) continue

          for (const slide of song.slides) {
            allQueueItems.push({
              id: crypto.randomUUID(),
              verse: {
                id: (Date.now() + itemIndex) % 2147483647,
                translation_id: 0,
                book_number: 0,
                book_name: song.title,
                book_abbreviation: song.author?.slice(0, 10).toUpperCase() || "SONG",
                chapter: 1,
                verse: itemIndex + 1,
                text: slide.text,
              },
              reference: `${song.title} - ${slide.label}`,
              confidence: 1,
              source: "song",
              added_at: Date.now() + itemIndex,
            })
            itemIndex++
          }
        }

        if (append) {
          useQueueStore.getState().appendItems(allQueueItems)
        } else {
          useQueueStore.getState().setItems(allQueueItems)
        }
      },

      presentSlideDirectly: (slide, songTitle) => {
        const renderData = {
          reference: `${songTitle} - ${slide.label}`,
          segments: [
            {
              verseNumber: 1,
              text: slide.text,
            },
          ],
        }
        useBroadcastStore.getState().projectVerse(renderData)
      },

      previewSlideDirectly: (slide, songTitle) => {
        const renderData = {
          reference: `${songTitle} - ${slide.label}`,
          segments: [
            {
              verseNumber: 1,
              text: slide.text,
            },
          ],
        }
        useBroadcastStore.getState().setPreviewVerse(renderData)
      },
    }),
    {
      name: "openbeam-song-library",
    }
  )
)

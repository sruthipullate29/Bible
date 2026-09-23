import type { SongSlide } from "@/lib/song-parser"

export interface Song {
  id: string
  title: string
  author?: string
  ccli?: string
  key?: string
  category?: string
  slides: SongSlide[]
  createdAt: number
  updatedAt: number
}

export interface Playlist {
  id: string
  name: string
  date: string // e.g. "2026-09-24"
  description?: string
  songIds: string[]
  createdAt: number
  updatedAt: number
}

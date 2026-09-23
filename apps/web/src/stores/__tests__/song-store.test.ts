import { describe, it, expect, beforeEach } from "vitest"
import { useSongStore } from "../song-store"
import { useQueueStore } from "../queue-store"

describe("useSongStore", () => {
  beforeEach(() => {
    useQueueStore.getState().clearQueue()
  })

  it("initializes with default worship songs and default service playlist", () => {
    const { songs, playlists } = useSongStore.getState()
    expect(songs.length).toBeGreaterThanOrEqual(4)
    expect(songs.some((s) => s.title === "Amazing Grace")).toBe(true)
    expect(playlists.length).toBeGreaterThanOrEqual(1)
  })

  it("can add a new song to the default library", () => {
    const newSong = useSongStore.getState().addSong({
      title: "Way Maker",
      author: "Sinach",
      category: "Worship",
      slides: [
        { id: "s1", label: "Chorus", text: "Way Maker, Miracle Worker, Promise Keeper" },
        { id: "s2", label: "Verse 1", text: "You are here, moving in our midst" },
      ],
    })

    expect(newSong.id).toBeDefined()
    const { songs } = useSongStore.getState()
    expect(songs.some((s) => s.title === "Way Maker")).toBe(true)
  })

  it("can create a new daily playlist and add songs to it", () => {
    const playlist = useSongStore.getState().createPlaylist("Youth Night", "2026-09-24", "Special service")
    expect(playlist.name).toBe("Youth Night")
    expect(playlist.date).toBe("2026-09-24")

    const firstSong = useSongStore.getState().songs[0]
    useSongStore.getState().addSongToPlaylist(playlist.id, firstSong.id)

    const updatedPl = useSongStore.getState().playlists.find((p) => p.id === playlist.id)
    expect(updatedPl?.songIds).toContain(firstSong.id)
  })

  it("can reorder songs inside a playlist", () => {
    const playlist = useSongStore.getState().createPlaylist("Reorder Test", "2026-09-24")
    const { songs } = useSongStore.getState()
    const s1 = songs[0].id
    const s2 = songs[1].id

    useSongStore.getState().addSongToPlaylist(playlist.id, s1)
    useSongStore.getState().addSongToPlaylist(playlist.id, s2)

    useSongStore.getState().reorderSongsInPlaylist(playlist.id, 0, 1)

    const updatedPl = useSongStore.getState().playlists.find((p) => p.id === playlist.id)
    expect(updatedPl?.songIds[0]).toBe(s2)
    expect(updatedPl?.songIds[1]).toBe(s1)
  })

  it("can load an entire daily playlist into the presentation queue", () => {
    const playlist = useSongStore.getState().createPlaylist("Queue Load Test", "2026-09-24")
    const { songs } = useSongStore.getState()
    const s1 = songs[0].id

    useSongStore.getState().addSongToPlaylist(playlist.id, s1)
    useSongStore.getState().loadPlaylistToQueue(playlist.id, false)

    const queueItems = useQueueStore.getState().items
    expect(queueItems.length).toBe(songs[0].slides.length)
    expect(queueItems[0].source).toBe("song")
    expect(queueItems[0].reference).toContain(songs[0].title)
  })
})

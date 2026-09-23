import { SongLibraryPanel } from "./song-library-panel"

/**
 * Re-export SongLibraryPanel so that audio transcription is completely removed
 * and any legacy reference renders the Song Library & Daily Playlists.
 */
export function TranscriptPanel() {
  return <SongLibraryPanel />
}

export default TranscriptPanel

import { useState, useMemo } from "react"
import { PanelHeader } from "@/components/ui/panel-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MusicIcon,
  PlusIcon,
  PlayIcon,
  Trash2Icon,
  CalendarIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FolderPlusIcon,
  LayersIcon,
  LibraryIcon,
  Edit3Icon,
  SplitIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useSongStore } from "@/stores/song-store"
import { SongLyricsDialog } from "@/components/song/song-lyrics-dialog"
import { SongEditDialog } from "@/components/song/song-edit-dialog"
import type { Song } from "@/types"

export function SongLibraryPanel() {
  const songs = useSongStore((s) => s.songs)
  const playlists = useSongStore((s) => s.playlists)
  const activePlaylistId = useSongStore((s) => s.activePlaylistId)
  const setActivePlaylist = useSongStore((s) => s.setActivePlaylist)
  const deleteSong = useSongStore((s) => s.deleteSong)
  const deletePlaylist = useSongStore((s) => s.deletePlaylist)
  const loadSongToQueue = useSongStore((s) => s.loadSongToQueue)
  const loadPlaylistToQueue = useSongStore((s) => s.loadPlaylistToQueue)
  const addSongToPlaylist = useSongStore((s) => s.addSongToPlaylist)
  const removeSongFromPlaylist = useSongStore((s) => s.removeSongFromPlaylist)
  const reorderSongsInPlaylist = useSongStore((s) => s.reorderSongsInPlaylist)
  const presentSlideDirectly = useSongStore((s) => s.presentSlideDirectly)
  const createPlaylist = useSongStore((s) => s.createPlaylist)

  const [activeTab, setActiveTab] = useState<"default" | "playlists">("default")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null)
  const [isSongDialogOpen, setIsSongDialogOpen] = useState(false)
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isNewPlaylistOpen, setIsNewPlaylistOpen] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState("")
  const [newPlaylistDate, setNewPlaylistDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>()
    songs.forEach((s) => {
      if (s.category) set.add(s.category)
    })
    return ["All", ...Array.from(set)]
  }, [songs])

  // Filtered songs
  const filteredSongs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return songs.filter((song) => {
      const matchesCategory =
        selectedCategory === "All" || song.category === selectedCategory
      if (!matchesCategory) return false

      if (!query) return true

      const inTitle = song.title.toLowerCase().includes(query)
      const inAuthor = song.author?.toLowerCase().includes(query)
      const inLyrics = song.slides.some((sl) => sl.text.toLowerCase().includes(query))
      return inTitle || inAuthor || inLyrics
    })
  }, [songs, searchQuery, selectedCategory])

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlaylistName.trim()) {
      toast.warning("Please enter a playlist name")
      return
    }
    const created = createPlaylist(newPlaylistName.trim(), newPlaylistDate)
    toast.success(`Created playlist "${created.name}" for ${created.date}`)
    setNewPlaylistName("")
    setIsNewPlaylistOpen(false)
    setActiveTab("playlists")
  }

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) || playlists[0] || null,
    [playlists, activePlaylistId]
  )

  return (
    <div
      data-slot="song-library-panel"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <SongLyricsDialog
        open={isSongDialogOpen}
        onOpenChange={setIsSongDialogOpen}
      />

      <SongEditDialog
        song={editingSong}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <PanelHeader
        title="Song Library & Sets"
        icon={<MusicIcon className="size-3.5 text-purple-500" />}
      >
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            className="h-6 gap-1 px-2 text-[0.65rem] border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-medium"
            onClick={() => setIsSongDialogOpen(true)}
            title="Import lyrics from clipboard, Word doc (.docx), or PowerPoint (.pptx)"
          >
            <PlusIcon className="size-3" />
            Add Song
          </Button>

          <Button
            variant="ghost"
            size="xs"
            className="h-6 gap-1 px-1.5 text-[0.65rem] text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsNewPlaylistOpen(true)
              setActiveTab("playlists")
            }}
            title="Create a new daily playlist set"
          >
            <CalendarIcon className="size-3 text-amber-500" />
            <span className="hidden sm:inline">New Day</span>
          </Button>
        </div>
      </PanelHeader>

      {/* Tabs Header */}
      <div className="border-b border-border bg-muted/30 px-2 py-1.5">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "default" | "playlists")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 h-7 p-0.5">
            <TabsTrigger value="default" className="text-xs gap-1.5 py-1">
              <LibraryIcon className="size-3" />
              Default Library ({songs.length})
            </TabsTrigger>
            <TabsTrigger value="playlists" className="text-xs gap-1.5 py-1">
              <CalendarIcon className="size-3" />
              Daily Sets ({playlists.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* TAB 1: DEFAULT SONGS LIBRARY */}
      {activeTab === "default" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Search & Category Filter */}
          <div className="border-b border-border p-2 space-y-1.5">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs by title or lyrics..."
                className="h-7 pl-7 pr-2 text-xs"
              />
            </div>
            {categories.length > 2 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded px-1.5 py-0.5 text-[0.625rem] font-medium transition-colors shrink-0 ${
                      selectedCategory === cat
                        ? "bg-purple-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Songs List */}
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-1">
            {filteredSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <MusicIcon className="size-7 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">
                  {searchQuery ? "No matching songs found" : "Default songs library is empty"}
                </p>
                <p className="text-[0.7rem] text-muted-foreground/70 mt-1">
                  Import songs from clipboard, Word (.docx), or PowerPoint (.pptx)
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-3 gap-1.5 text-xs border-purple-500/30 text-purple-600 dark:text-purple-400"
                  onClick={() => setIsSongDialogOpen(true)}
                >
                  <PlusIcon className="size-3" />
                  Add Song
                </Button>
              </div>
            ) : (
              filteredSongs.map((song) => {
                const isExpanded = expandedSongId === song.id
                return (
                  <div
                    key={song.id}
                    className="rounded-md border border-border bg-card/60 transition-colors hover:border-purple-500/30"
                  >
                    <div className="flex items-center justify-between p-2 gap-2">
                      <button
                        onClick={() =>
                          setExpandedSongId(isExpanded ? null : song.id)
                        }
                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                      >
                        {isExpanded ? (
                          <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {song.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {song.author && (
                              <span className="truncate text-[0.625rem] text-muted-foreground">
                                {song.author}
                              </span>
                            )}
                            <Badge
                              variant="secondary"
                              className="text-[0.55rem] h-3.5 px-1 py-0"
                            >
                              {song.slides.length} slides
                            </Badge>
                            {song.category && (
                              <span className="rounded bg-purple-500/10 px-1 text-[0.55rem] text-purple-600 dark:text-purple-400 font-medium">
                                {song.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Song Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {/* Edit Song & Divide Pages */}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title="Edit Song & Divide Pages"
                          onClick={() => {
                            setEditingSong(song)
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit3Icon className="size-3 text-purple-500" />
                        </Button>

                        {/* Present First Slide Live */}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title="Project first slide live"
                          onClick={() => {
                            if (song.slides[0]) {
                              presentSlideDirectly(song.slides[0], song.title)
                              toast.success(`Projected "${song.title}" live!`)
                            }
                          }}
                        >
                          <PlayIcon className="size-3 text-emerald-500" />
                        </Button>

                        {/* Add to Presentation Queue */}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title="Add all slides to Queue"
                          onClick={() => {
                            loadSongToQueue(song.id)
                            toast.success(`Added "${song.title}" to Presentation Queue`)
                          }}
                        >
                          <LayersIcon className="size-3 text-blue-500" />
                        </Button>

                        {/* Add to Daily Playlist */}
                        {playlists.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                title="Add to Daily Playlist"
                              >
                                <FolderPlusIcon className="size-3 text-amber-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <div className="px-2 py-1 text-[0.65rem] font-semibold text-muted-foreground">
                                Add to Daily Set:
                              </div>
                              {playlists.map((pl) => (
                                <DropdownMenuItem
                                  key={pl.id}
                                  onClick={() => {
                                    addSongToPlaylist(pl.id, song.id)
                                    toast.success(`Added to ${pl.name}`)
                                  }}
                                  className="text-xs"
                                >
                                  {pl.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {/* Delete Song */}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title="Delete from Library"
                          onClick={() => {
                            deleteSong(song.id)
                            toast.info(`Deleted "${song.title}" from library`)
                          }}
                          className="hover:text-destructive text-muted-foreground/60"
                        >
                          <Trash2Icon className="size-2.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Slide Preview */}
                    {isExpanded && (
                      <div className="border-t border-border/60 bg-muted/20 p-2 space-y-1.5">
                        <div className="flex items-center justify-between pb-1 border-b border-border/40">
                          <span className="text-[0.65rem] font-semibold text-muted-foreground">
                            Divided into {song.slides.length} pages
                          </span>
                          <Button
                            variant="outline"
                            size="xs"
                            className="h-5 gap-1 text-[0.625rem] border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-medium"
                            onClick={() => {
                              setEditingSong(song)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <SplitIcon className="size-2.5" />
                            Edit / Divide Pages
                          </Button>
                        </div>
                        {song.slides.map((slide, sIdx) => (
                          <div
                            key={slide.id}
                            onClick={() => {
                              presentSlideDirectly(slide, song.title)
                              toast.success(`Projected "${song.title} - ${slide.label}" live!`)
                            }}
                            className="group flex items-start justify-between rounded border border-border/40 bg-card/80 p-1.5 text-xs hover:border-purple-500/40 cursor-pointer transition-colors"
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="font-semibold text-purple-600 dark:text-purple-400 text-[0.65rem] block mb-0.5">
                                #{sIdx + 1} {slide.label}
                              </span>
                              <p className="whitespace-pre-line text-[0.65rem] text-muted-foreground line-clamp-2">
                                {slide.text}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Project this slide live"
                            >
                              <PlayIcon className="size-2.5 text-emerald-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DAILY PLAYLISTS */}
      {activeTab === "playlists" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* New Playlist Form Banner */}
          {isNewPlaylistOpen ? (
            <form
              onSubmit={handleCreatePlaylist}
              className="border-b border-border bg-muted/40 p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">New Daily Playlist</span>
                <button
                  type="button"
                  onClick={() => setIsNewPlaylistOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="e.g. Sunday Morning Service"
                  className="h-7 text-xs"
                  autoFocus
                />
                <Input
                  type="date"
                  value={newPlaylistDate}
                  onChange={(e) => setNewPlaylistDate(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex justify-end gap-1.5">
                <Button
                  type="submit"
                  size="xs"
                  className="gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs"
                >
                  <PlusIcon className="size-3" />
                  Save Playlist
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-muted/20">
              <span className="text-[0.7rem] text-muted-foreground font-medium">
                Organize songs per service or day
              </span>
              <Button
                variant="outline"
                size="xs"
                className="h-6 gap-1 text-[0.65rem] border-purple-500/30 text-purple-600 dark:text-purple-400"
                onClick={() => setIsNewPlaylistOpen(true)}
              >
                <PlusIcon className="size-2.5" />
                New Daily Set
              </Button>
            </div>
          )}

          {/* Playlist Selector Pill Bar */}
          {playlists.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border p-2 bg-card">
              {playlists.map((pl) => {
                const isSelected = activePlaylist?.id === pl.id
                return (
                  <button
                    key={pl.id}
                    onClick={() => setActivePlaylist(pl.id)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium shrink-0 transition-colors ${
                      isSelected
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    <span>{pl.name}</span>
                    <Badge
                      variant="secondary"
                      className={`h-3.5 px-1 text-[0.55rem] ${
                        isSelected ? "bg-white/20 text-white" : ""
                      }`}
                    >
                      {pl.songIds.length}
                    </Badge>
                  </button>
                )
              })}
            </div>
          )}

          {/* Active Playlist Details & Songs */}
          {activePlaylist ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/10">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">
                      {activePlaylist.name}
                    </span>
                    <Badge variant="outline" className="text-[0.6rem] h-4">
                      {activePlaylist.date}
                    </Badge>
                  </div>
                  <span className="text-[0.65rem] text-muted-foreground">
                    {activePlaylist.songIds.length} song{activePlaylist.songIds.length === 1 ? "" : "s"} scheduled
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Load All To Queue Action */}
                  <Button
                    size="xs"
                    disabled={activePlaylist.songIds.length === 0}
                    onClick={() => {
                      loadPlaylistToQueue(activePlaylist.id)
                      toast.success(`Loaded all songs from "${activePlaylist.name}" into Queue!`)
                    }}
                    className="h-6 gap-1 text-[0.65rem] bg-emerald-600 hover:bg-emerald-700 text-white"
                    title="Load all songs in this playlist to the live presentation queue"
                  >
                    <LayersIcon className="size-2.5" />
                    Load to Queue
                  </Button>

                  {/* Add Song from Library to this Playlist */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-xs"
                        className="h-6 w-6"
                        title="Add song from library to this playlist"
                      >
                        <PlusIcon className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 max-h-60 overflow-y-auto">
                      <div className="px-2 py-1 text-[0.65rem] font-semibold text-muted-foreground">
                        Select Song to Add:
                      </div>
                      {songs.map((s) => (
                        <DropdownMenuItem
                          key={s.id}
                          onClick={() => {
                            addSongToPlaylist(activePlaylist.id, s.id)
                            toast.success(`Added "${s.title}" to ${activePlaylist.name}`)
                          }}
                          className="text-xs"
                        >
                          {s.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Delete Playlist */}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-6 w-6 text-muted-foreground/60 hover:text-destructive"
                    onClick={() => {
                      deletePlaylist(activePlaylist.id)
                      toast.info(`Deleted playlist "${activePlaylist.name}"`)
                    }}
                    title="Delete playlist"
                  >
                    <Trash2Icon className="size-2.5" />
                  </Button>
                </div>
              </div>

              {/* Playlist Tracks List */}
              <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
                {activePlaylist.songIds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-xs font-medium text-muted-foreground">
                      No songs in this day's playlist yet
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground/70 mt-1">
                      Add songs using the "+" button above or from the Default Library tab
                    </p>
                  </div>
                ) : (
                  activePlaylist.songIds.map((songId, idx) => {
                    const song = songs.find((s) => s.id === songId)
                    if (!song) return null
                    return (
                      <div
                        key={`${songId}-${idx}`}
                        className="group flex items-center justify-between rounded border border-border bg-card p-2 text-xs hover:border-purple-500/30"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-bold text-[0.65rem] text-muted-foreground w-4">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-foreground text-xs">
                              {song.title}
                            </p>
                            <span className="text-[0.625rem] text-muted-foreground">
                              {song.slides.length} slides {song.author ? `• ${song.author}` : ""}
                            </span>
                          </div>
                        </div>

                        {/* Track Actions */}
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Edit Song & Divide Pages"
                            onClick={() => {
                              setEditingSong(song)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Edit3Icon className="size-2.5 text-purple-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Move Up"
                            disabled={idx === 0}
                            onClick={() => reorderSongsInPlaylist(activePlaylist.id, idx, idx - 1)}
                          >
                            <ArrowUpIcon className="size-2.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Move Down"
                            disabled={idx === activePlaylist.songIds.length - 1}
                            onClick={() => reorderSongsInPlaylist(activePlaylist.id, idx, idx + 1)}
                          >
                            <ArrowDownIcon className="size-2.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Add to Queue"
                            onClick={() => {
                              loadSongToQueue(song.id)
                              toast.success(`Added "${song.title}" to Queue`)
                            }}
                          >
                            <LayersIcon className="size-2.5 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Remove from playlist"
                            onClick={() => removeSongFromPlaylist(activePlaylist.id, idx)}
                            className="text-muted-foreground/60 hover:text-destructive"
                          >
                            <Trash2Icon className="size-2.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <CalendarIcon className="size-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs font-medium text-muted-foreground">
                No daily playlists created yet
              </p>
              <Button
                variant="outline"
                size="xs"
                className="mt-3 gap-1.5 text-xs border-purple-500/30 text-purple-600 dark:text-purple-400"
                onClick={() => setIsNewPlaylistOpen(true)}
              >
                <PlusIcon className="size-3" />
                Create Daily Playlist
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

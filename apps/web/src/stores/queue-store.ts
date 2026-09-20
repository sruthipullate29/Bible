import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { QueueItem } from "@/types"

export interface QueueState {
  items: QueueItem[]
  activeIndex: number | null
  lastSavedAt: number | null

  addItem: (item: QueueItem) => void
  setItems: (items: QueueItem[]) => void
  appendItems: (items: QueueItem[]) => void
  removeItem: (id: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  setActive: (index: number | null) => void
  clearQueue: () => void
}

function syncToSystemDb(items: QueueItem[]) {
  if (typeof window !== "undefined" && window.electronAPI?.saveQueueToDb) {
    window.electronAPI.saveQueueToDb(items).catch((err) => {
      console.warn("[queue-store] Failed to auto-sync queue to local database:", err)
    })
  }
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set) => ({
      items: [],
      activeIndex: null,
      lastSavedAt: null,

      addItem: (item) =>
        set((state) => {
          const nextItems = [...state.items, item]
          syncToSystemDb(nextItems)
          return { items: nextItems, lastSavedAt: Date.now() }
        }),

      setItems: (items) => {
        syncToSystemDb(items)
        set({ items, activeIndex: null, lastSavedAt: Date.now() })
      },

      appendItems: (newItems) =>
        set((state) => {
          const existingIds = new Set(state.items.map((i) => i.id))
          const filteredNew = newItems.filter((i) => !existingIds.has(i.id))
          const nextItems = [...state.items, ...filteredNew]
          syncToSystemDb(nextItems)
          return { items: nextItems, lastSavedAt: Date.now() }
        }),

      removeItem: (id) =>
        set((state) => {
          const nextItems = state.items.filter((i) => i.id !== id)
          syncToSystemDb(nextItems)
          return {
            items: nextItems,
            activeIndex:
              state.activeIndex !== null && state.activeIndex >= nextItems.length
                ? Math.max(0, nextItems.length - 1)
                : state.activeIndex,
            lastSavedAt: Date.now(),
          }
        }),

      reorderItems: (fromIndex, toIndex) =>
        set((state) => {
          const items = [...state.items]
          const [moved] = items.splice(fromIndex, 1)
          items.splice(toIndex, 0, moved)
          syncToSystemDb(items)
          return { items, lastSavedAt: Date.now() }
        }),

      setActive: (activeIndex) => set({ activeIndex }),

      clearQueue: () => {
        syncToSystemDb([])
        set({ items: [], activeIndex: null, lastSavedAt: Date.now() })
      },
    }),
    {
      name: "openbeam:queue",
      partialize: (state) => ({
        items: state.items,
        activeIndex: state.activeIndex,
        lastSavedAt: state.lastSavedAt,
      }),
    }
  )
)

// Attempt to rehydrate from Electron local database if localStorage is empty
if (typeof window !== "undefined" && window.electronAPI?.loadQueueFromDb) {
  window.electronAPI
    .loadQueueFromDb()
    .then((res) => {
      if (res?.success && Array.isArray(res.items) && res.items.length > 0) {
        const currentItems = useQueueStore.getState().items
        if (currentItems.length === 0) {
          useQueueStore.getState().setItems(res.items)
        }
      }
    })
    .catch((err) => {
      console.warn("[queue-store] Could not load initial queue from local database:", err)
    })
}

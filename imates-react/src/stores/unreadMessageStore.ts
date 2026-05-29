import { create } from 'zustand'

interface UnreadMessageState {
  unreadSessionsMap: Map<string, boolean>
  
  // Actions
  markUnread: (sessionId: string) => void
  clearUnread: (sessionId: string) => void
  hasUnread: (sessionId: string) => boolean
  clearAll: () => void
  
  // Helper to get unread session IDs
  getUnreadSessions: () => string[]
}

export const useUnreadMessageStore = create<UnreadMessageState>((set, get) => ({
  unreadSessionsMap: new Map(),

  markUnread: (sessionId) => {
    if (sessionId) {
      set((state) => {
        const newMap = new Map(state.unreadSessionsMap)
        newMap.set(sessionId, true)
        return { unreadSessionsMap: newMap }
      })
    }
  },

  clearUnread: (sessionId) => {
    if (sessionId && get().unreadSessionsMap.has(sessionId)) {
      set((state) => {
        const newMap = new Map(state.unreadSessionsMap)
        newMap.delete(sessionId)
        return { unreadSessionsMap: newMap }
      })
    }
  },

  hasUnread: (sessionId) => {
    return sessionId ? get().unreadSessionsMap.has(sessionId) : false
  },

  clearAll: () => {
    set({ unreadSessionsMap: new Map() })
  },

  getUnreadSessions: () => {
    return Array.from(get().unreadSessionsMap.keys())
  }
}))

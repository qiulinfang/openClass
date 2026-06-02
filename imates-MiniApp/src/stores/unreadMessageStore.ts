/**
 * 未读消息跟踪 Store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUnreadMessageStore = defineStore('unreadMessage', () => {
  const unreadSessionsMap = ref<Map<string, boolean>>(new Map())

  const markUnread = (sessionId: string) => {
    if (sessionId) {
      const newMap = new Map(unreadSessionsMap.value)
      newMap.set(sessionId, true)
      unreadSessionsMap.value = newMap
    }
  }

  const clearUnread = (sessionId: string) => {
    if (sessionId && unreadSessionsMap.value.has(sessionId)) {
      const newMap = new Map(unreadSessionsMap.value)
      newMap.delete(sessionId)
      unreadSessionsMap.value = newMap
    }
  }

  const hasUnread = (sessionId: string): boolean => {
    return sessionId ? unreadSessionsMap.value.has(sessionId) : false
  }

  const clearAll = () => {
    unreadSessionsMap.value = new Map()
  }

  const unreadSessions = computed(() => {
    return Array.from(unreadSessionsMap.value.keys())
  })

  return {
    unreadSessionsMap,
    unreadSessions,
    markUnread,
    clearUnread,
    hasUnread,
    clearAll,
  }
})

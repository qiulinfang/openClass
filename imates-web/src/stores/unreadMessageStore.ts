/**
 * 未读消息跟踪 Store
 * 职责：跟踪哪些会话有新消息（当消息到达但用户不在查看该会话时）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUnreadMessageStore = defineStore('unreadMessage', () => {
  // 存储有未读消息的会话ID集合
  // 使用 Map 而不是 Set，确保 Vue 能追踪到变化
  const unreadSessionsMap = ref<Map<string, boolean>>(new Map())

  /**
   * 标记会话有未读消息
   * @param sessionId 会话ID
   */
  const markUnread = (sessionId: string) => {
    if (sessionId) {
      // 创建新的 Map 以确保响应式更新
      const newMap = new Map(unreadSessionsMap.value)
      newMap.set(sessionId, true)
      unreadSessionsMap.value = newMap
      console.log(`[UnreadStore] 📍 标记会话未读: ${sessionId}`)
    }
  }

  /**
   * 清除会话的未读标记
   * @param sessionId 会话ID
   */
  const clearUnread = (sessionId: string) => {
    if (sessionId && unreadSessionsMap.value.has(sessionId)) {
      // 创建新的 Map 以确保响应式更新
      const newMap = new Map(unreadSessionsMap.value)
      newMap.delete(sessionId)
      unreadSessionsMap.value = newMap
      console.log(`[UnreadStore] ✅ 清除会话未读标记: ${sessionId}`)
    }
  }

  /**
   * 检查会话是否有未读消息
   * @param sessionId 会话ID
   * @returns 是否有未读消息
   */
  const hasUnread = (sessionId: string): boolean => {
    return sessionId ? unreadSessionsMap.value.has(sessionId) : false
  }

  /**
   * 清除所有未读标记
   */
  const clearAll = () => {
    unreadSessionsMap.value = new Map()
    console.log('[UnreadStore] 🧹 清除所有未读标记')
  }

  // 计算属性：用于响应式追踪
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


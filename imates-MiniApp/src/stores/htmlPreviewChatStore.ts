/**
 * HTML 预览聊天 Store
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatBubble, AttachedScreenshot } from '../types'
import { Sender } from '../types'

export const useHtmlPreviewChatStore = defineStore('htmlPreviewChat', () => {
  const messages = ref<ChatBubble[]>([])
  const isChatLoading = ref(false)
  const sessionId = ref<string | null>(null)
  const enableWebSearch = ref(false)
  const inputAttachedScreenshots = ref<AttachedScreenshot[]>([])

  const setSessionId = (id: string | null): void => {
    sessionId.value = id
  }

  const sendMessage = async (
    content: string,
    userInfo: any = null,
    options: any = {}
  ): Promise<void> => {
    if (!sessionId.value) {
      sessionId.value = `preview-${Date.now()}`
    }

    if (!options.skipUserMessage) {
      messages.value.push({
        id: Date.now().toString(),
        content,
        sender: Sender.USER,
        type: Sender.USER,
        timestamp: new Date().toISOString(),
        sessionId: sessionId.value,
        messageType: 'text'
      })
    }

    isChatLoading.value = true
    
    // 模拟回复
    setTimeout(() => {
      messages.value.push({
        id: (Date.now() + 1).toString(),
        content: '这是 HTML 预览的 AI 模拟回复...',
        sender: Sender.AI,
        type: Sender.AI,
        timestamp: new Date().toISOString(),
        sessionId: sessionId.value || '',
        messageType: 'text'
      })
      isChatLoading.value = false
    }, 1000)
  }

  const resetState = (): void => {
    messages.value = []
    sessionId.value = null
    isChatLoading.value = false
    enableWebSearch.value = false
    inputAttachedScreenshots.value = []
  }

  const clearMessages = (): void => {
    messages.value = []
  }

  return {
    messages,
    isChatLoading,
    sessionId,
    enableWebSearch,
    inputAttachedScreenshots,
    setSessionId,
    sendMessage,
    resetState,
    clearMessages
  }
})

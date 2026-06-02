/**
 * AI教材聊天场景专用Store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/http/api-service'
import { chatStorage } from '../services/storage/chat-storage'
import type { ChatBubble, AttachedScreenshot } from '../types'
import { Sender } from '../types'

export interface TextbookChatImageData {
  base64DataUrl: string
}

export interface ScreenshotDrawingState {
  objects: unknown
  history: unknown
  historyIndex: number
}

export const useAiTextbookChatStore = defineStore('aiTextbookChat', () => {
  // ==================== 状态管理 ====================
  
  const messages = ref<ChatBubble[]>([])
  const isChatLoading = ref(false)
  const chatResponseTimes = ref(0)
  const resourceId = ref<string | null>(null)
  const sectionName = ref<string | null>(null)
  const chapterInfo = ref<{
    grade: string
    subject: string
    textbook: string
    chapter_title: string
  } | null>(null)
  const currentSessionId = ref<string | null>(null)
  const inputAttachedScreenshots = ref<AttachedScreenshot[]>([])
  const inputScreenshotDrawingStates = ref<Record<string, ScreenshotDrawingState>>({})

  const canViewAnswer = computed(() => chatResponseTimes.value >= 3)

  // ==================== 方法定义 ====================

  const setResourceId = (id: string): void => {
    if (resourceId.value !== id) {
      resourceId.value = id
      currentSessionId.value = null
      messages.value = []
      chatResponseTimes.value = 0
    }
  }

  const setSectionName = (name: string | null): void => {
    sectionName.value = name
  }

  const setChapterInfo = (info: any): void => {
    chapterInfo.value = info
  }

  const sendMessage = async (
    content: string,
    selectedModel: string = 'mate',
    imageData?: any,
    hidePrefix: boolean = false,
    skipUserMessage?: boolean,
    quotedMessage?: any,
    imageList?: any[],
    focus?: any,
  ): Promise<void> => {
    if (!currentSessionId.value) {
      currentSessionId.value = `textbook-${Date.now()}`
    }

    if (!skipUserMessage) {
      const userMessage: ChatBubble = {
        id: Date.now().toString(),
        content,
        sender: Sender.USER,
        type: Sender.USER,
        timestamp: new Date().toISOString(),
        sessionId: currentSessionId.value,
        messageType: 'text'
      }
      messages.value.push(userMessage)
    }

    isChatLoading.value = true
    
    // 模拟 AI 回复逻辑
    setTimeout(() => {
      const aiReply: ChatBubble = {
        id: (Date.now() + 1).toString(),
        content: '这是教材 AI 的模拟回复...',
        sender: Sender.AI,
        type: Sender.AI,
        timestamp: new Date().toISOString(),
        sessionId: currentSessionId.value || '',
        messageType: 'text'
      }
      messages.value.push(aiReply)
      chatResponseTimes.value++
      isChatLoading.value = false
      saveChatHistory()
    }, 1000)
  }

  const saveChatHistory = async (): Promise<void> => {
    if (!resourceId.value) return
    const key = `ai-textbook-${resourceId.value}`
    await chatStorage.saveChatHistory(key, {
      questionId: resourceId.value,
      messages: messages.value,
      chatResponseTimes: chatResponseTimes.value,
      lastUpdated: Date.now()
    })
  }

  const loadChatHistory = async (id?: string): Promise<void> => {
    const targetId = id || resourceId.value
    if (!targetId) return
    isChatLoading.value = true
    try {
      const history = await chatStorage.loadChatHistory(`ai-textbook-${targetId}`)
      messages.value = history?.messages || []
      chatResponseTimes.value = history?.chatResponseTimes || 0
    } finally {
      isChatLoading.value = false
    }
  }

  const clearMessages = (): void => {
    messages.value = []
    chatResponseTimes.value = 0
    currentSessionId.value = null
  }

  const appendInputAttachedScreenshots = (shots: AttachedScreenshot[]) => {
    inputAttachedScreenshots.value = [...inputAttachedScreenshots.value, ...shots]
  }

  const setInputScreenshotDrawingStates = (states: Record<string, ScreenshotDrawingState>) => {
    inputScreenshotDrawingStates.value = { ...inputScreenshotDrawingStates.value, ...states }
  }

  return {
    messages,
    isChatLoading,
    chatResponseTimes,
    resourceId,
    sectionName,
    chapterInfo,
    currentSessionId,
    inputAttachedScreenshots,
    inputScreenshotDrawingStates,
    canViewAnswer,
    setResourceId,
    setSectionName,
    setChapterInfo,
    sendMessage,
    saveChatHistory,
    loadChatHistory,
    clearMessages,
    appendInputAttachedScreenshots,
    setInputScreenshotDrawingStates
  }
})

/**
 * AI 通用聊天 Store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/http/api-service'
import { chatStorage } from '../services/storage/chat-storage'
import type { ChatBubble, AttachedScreenshot } from '../types'
import { Sender } from '../types'

/**
 * 会话信息接口
 */
export interface AiGeneralSession {
  sessionId: string
  sessionName: string
  createTime: number
  updateTime: number
  msgCount: number
  pinned?: boolean
}

export const useAiGeneralChatStore = defineStore('aiGeneralChat', () => {
  // ==================== 状态定义 ====================
  
  const messages = ref<ChatBubble[]>([])
  const sessions = ref<AiGeneralSession[]>([])
  const currentSession = ref<AiGeneralSession | null>(null)
  const isChatLoading = ref(false)
  const enableWebSearch = ref(false)
  const isCreatingSession = ref(false)
  
  const inputAttachedScreenshots = ref<AttachedScreenshot[]>([])
  const inputScreenshotDrawingStates = ref<Record<string, any>>({})

  // ==================== 公开方法 ====================
  
  /**
   * 发送消息
   */
  const sendMessage = async (
    content: string,
    userInfo: any = null,
    subject: 'MATH' | 'BIOLOGY' = 'MATH',
    selectedModel: string = 'mate',
    skipUserMessage?: boolean,
    quotedMessage?: any,
    imageData?: any,
    imageList?: any[],
    focus?: any,
  ): Promise<void> => {
    if (!currentSession.value) {
      await createSession(content)
    }
    
    if (!skipUserMessage) {
      const userMessage: ChatBubble = {
        id: Date.now().toString(),
        content,
        sender: Sender.USER,
        type: Sender.USER,
        timestamp: new Date().toISOString(),
        sessionId: currentSession.value?.sessionId || '',
        messageType: 'text'
      }
      messages.value.push(userMessage)
    }

    isChatLoading.value = true
    
    // 模拟 AI 回复逻辑，实际应调用 apiService.sendChatMessage
    setTimeout(() => {
      const aiReply: ChatBubble = {
        id: (Date.now() + 1).toString(),
        content: '这是通用 AI 的模拟回复...',
        sender: Sender.AI,
        type: Sender.AI,
        timestamp: new Date().toISOString(),
        sessionId: currentSession.value?.sessionId || '',
        messageType: 'text'
      }
      messages.value.push(aiReply)
      isChatLoading.value = false
      saveChatHistory()
    }, 1000)
  }

  /**
   * 创建新会话
   */
  const createSession = async (firstMessage: string): Promise<void> => {
    isCreatingSession.value = true
    try {
      const newSession: AiGeneralSession = {
        sessionId: `general-${Date.now()}`,
        sessionName: firstMessage.substring(0, 20),
        createTime: Date.now(),
        updateTime: Date.now(),
        msgCount: 0
      }
      sessions.value.unshift(newSession)
      currentSession.value = newSession
      messages.value = []
      await saveSessions()
    } finally {
      isCreatingSession.value = false
    }
  }

  /**
   * 切换会话
   */
  const switchSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.find(s => s.sessionId === sessionId)
    if (session) {
      currentSession.value = session
      await loadChatHistory(sessionId)
    }
  }

  /**
   * 保存聊天历史
   */
  const saveChatHistory = async (): Promise<void> => {
    if (!currentSession.value) return
    const key = `ai-general-${currentSession.value.sessionId}`
    await chatStorage.saveChatHistory(key, {
      questionId: currentSession.value.sessionId,
      messages: messages.value,
      chatResponseTimes: 0,
      lastUpdated: Date.now()
    })
    await saveSessions()
  }

  /**
   * 加载聊天历史
   */
  const loadChatHistory = async (sessionId: string): Promise<void> => {
    isChatLoading.value = true
    try {
      const history = await chatStorage.loadChatHistory(`ai-general-${sessionId}`)
      messages.value = history?.messages || []
    } finally {
      isChatLoading.value = false
    }
  }

  /**
   * 保存会话列表
   */
  const saveSessions = async (): Promise<void> => {
    await chatStorage.saveGeneralSessions(sessions.value)
  }

  /**
   * 加载会话列表
   */
  const loadSessions = async (): Promise<void> => {
    sessions.value = await chatStorage.loadGeneralSessions()
  }

  const deleteSession = async (sessionId: string): Promise<void> => {
    sessions.value = sessions.value.filter(s => s.sessionId !== sessionId)
    if (currentSession.value?.sessionId === sessionId) {
      currentSession.value = null
      messages.value = []
    }
    await saveSessions()
  }

  const resetState = (): void => {
    messages.value = []
    currentSession.value = null
    isChatLoading.value = false
  }

  const toggleWebSearch = (): void => {
    enableWebSearch.value = !enableWebSearch.value
  }

  return {
    messages,
    sessions,
    currentSession,
    isChatLoading,
    enableWebSearch,
    isCreatingSession,
    inputAttachedScreenshots,
    inputScreenshotDrawingStates,
    sendMessage,
    createSession,
    switchSession,
    deleteSession,
    saveChatHistory,
    loadChatHistory,
    saveSessions,
    loadSessions,
    resetState,
    toggleWebSearch
  }
})

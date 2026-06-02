/**
 * AI 作业聊天 Store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/http/api-service'
import { chatStorage } from '../services/storage/chat-storage'
import type { ChatBubble, AttachedScreenshot, ExerciseItem } from '../types'
import { Sender } from '../types'

/**
 * 作业会话信息接口
 */
export interface AiHomeworkSession {
  sessionId: string
  sessionName: string
  createTime: number
  updateTime: number
  msgCount: number
  metadata?: {
    questionBmNo: string
  }
}

export const useAiHomeworkChatStore = defineStore('aiHomeworkChat', () => {
  // ==================== 状态定义 ====================
  
  const messages = ref<ChatBubble[]>([])
  const sessions = ref<AiHomeworkSession[]>([])
  const currentSession = ref<AiHomeworkSession | null>(null)
  const isChatLoading = ref(false)
  const enableWebSearch = ref(false)
  const currentQuestionId = ref<string | null>(null)
  
  const inputAttachedScreenshots = ref<AttachedScreenshot[]>([])
  const inputScreenshotDrawingStates = ref<Record<string, any>>({})

  // 基于题目 ID 过滤的会话列表
  const filteredSessions = computed(() => {
    if (!currentQuestionId.value) return []
    return sessions.value.filter(s => s.metadata?.questionBmNo === currentQuestionId.value)
  })

  // ==================== 公开方法 ====================
  
  const setQuestionContext = async (questionId: string) => {
    currentQuestionId.value = questionId
    if (sessions.value.length === 0) {
      await loadSessions()
    }
    
    const mySessions = filteredSessions.value.sort((a, b) => (b.updateTime || 0) - (a.updateTime || 0))
    if (mySessions.length > 0) {
      await switchSession(mySessions[0].sessionId)
    } else {
      messages.value = []
      currentSession.value = null
    }
  }

  const sendMessage = async (
    content: string,
    userInfo: any = null,
    subject: 'MATH' | 'BIOLOGY' = 'MATH',
    question: ExerciseItem | null = null,
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
    
    // 模拟 AI 回复逻辑
    setTimeout(() => {
      const aiReply: ChatBubble = {
        id: (Date.now() + 1).toString(),
        content: '这是作业 AI 的模拟回复...',
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

  const createSession = async (firstMessage: string): Promise<void> => {
    if (!currentQuestionId.value) return
    const newSession: AiHomeworkSession = {
      sessionId: `homework-${Date.now()}`,
      sessionName: firstMessage.substring(0, 20),
      createTime: Date.now(),
      updateTime: Date.now(),
      msgCount: 0,
      metadata: { questionBmNo: currentQuestionId.value }
    }
    sessions.value.unshift(newSession)
    currentSession.value = newSession
    messages.value = []
    await saveSessions()
  }

  const switchSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.find(s => s.sessionId === sessionId)
    if (session) {
      currentSession.value = session
      await loadChatHistory(sessionId)
    }
  }

  const saveChatHistory = async (): Promise<void> => {
    if (!currentSession.value) return
    const key = `ai-homework-${currentSession.value.sessionId}`
    await chatStorage.saveChatHistory(key, {
      questionId: currentSession.value.sessionId,
      messages: messages.value,
      chatResponseTimes: 0,
      lastUpdated: Date.now()
    })
    await saveSessions()
  }

  const loadChatHistory = async (sessionId: string): Promise<void> => {
    isChatLoading.value = true
    try {
      const history = await chatStorage.loadChatHistory(`ai-homework-${sessionId}`)
      messages.value = history?.messages || []
    } finally {
      isChatLoading.value = false
    }
  }

  const saveSessions = async (): Promise<void> => {
    await chatStorage.saveHomeworkSessions(sessions.value)
  }

  const loadSessions = async (): Promise<void> => {
    sessions.value = await chatStorage.loadHomeworkSessions()
  }

  const deleteSession = async (sessionId: string) => {
    sessions.value = sessions.value.filter(s => s.sessionId !== sessionId)
    if (currentSession.value?.sessionId === sessionId) {
      currentSession.value = null
      messages.value = []
    }
    await saveSessions()
  }

  const resetState = (resetContext = true) => {
    messages.value = []
    currentSession.value = null
    if (resetContext) {
      currentQuestionId.value = null
    }
  }

  return {
    messages,
    sessions,
    filteredSessions,
    currentSession,
    isChatLoading,
    enableWebSearch,
    currentQuestionId,
    inputAttachedScreenshots,
    inputScreenshotDrawingStates,
    setQuestionContext,
    sendMessage,
    createSession,
    switchSession,
    deleteSession,
    resetState,
    loadSessions,
    saveChatHistory
  }
})

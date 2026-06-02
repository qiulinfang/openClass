/**
 * AI 题目聊天 Store
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatBubble, ExerciseItem, AttachedScreenshot } from '../types'
import { Sender } from '../types'

export interface ExerciseSession {
  id: string
  questionBmNo: string
  title: string
  messages: ChatBubble[]
  chatResponseTimes: number
  createdAt: number
  updatedAt: number
  aiMessage?: string
  userMessage?: string
  lastMessage?: string
  previewMessagesMarkdown?: string[]
}

export const useAiExerciseChatStore = defineStore('aiExerciseChat', () => {
  const messages = ref<ChatBubble[]>([])
  const currentSessionId = ref<string | null>(null)
  const sessions = ref<ExerciseSession[]>([])
  const chatResponseTimes = ref(0)
  const isChatLoading = ref(false)
  const enableWebSearch = ref(false)
  const canViewAnswer = ref(false)
  const inputAttachedScreenshots = ref<AttachedScreenshot[]>([])
  const inputScreenshotDrawingStates = ref<Record<string, any>>({})

  const sendMessage = async (
    content: string,
    currentQuestion: ExerciseItem,
    userInfo: any,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel: string = 'mate',
    imageData?: any,
    hidePrefix: boolean = false,
    skipUserMessage?: boolean,
    quotedMessage?: any,
    imageList?: any[],
    focus?: any,
  ) => {
    // 模拟发送消息
    console.log('[AI_EXERCISE] Sending message:', content)
    
    if (!skipUserMessage) {
      messages.value.push({
        id: Date.now().toString(),
        content,
        sender: Sender.USER,
        type: Sender.USER,
        timestamp: new Date().toISOString(),
        sessionId: currentSessionId.value || ''
      })
    }

    isChatLoading.value = true
    // 模拟 AI 回复
    setTimeout(() => {
      messages.value.push({
        id: (Date.now() + 1).toString(),
        content: '这是 AI 的模拟回复内容...',
        sender: Sender.AI,
        type: Sender.AI,
        timestamp: new Date().toISOString(),
        sessionId: currentSessionId.value || ''
      })
      chatResponseTimes.value++
      isChatLoading.value = false
      if (chatResponseTimes.value >= 3) canViewAnswer.value = true
    }, 1000)
  }

  const loadChatHistory = async (questionBmNo: string) => {
    console.log('[AI_EXERCISE] Loading history for:', questionBmNo)
    // 模拟加载历史
    messages.value = []
    chatResponseTimes.value = 0
    canViewAnswer.value = false
  }

  const resetState = () => {
    messages.value = []
    currentSessionId.value = null
    chatResponseTimes.value = 0
    canViewAnswer.value = false
  }

  const setInputAttachedScreenshots = (shots: AttachedScreenshot[]) => {
    inputAttachedScreenshots.value = shots
  }

  const appendInputAttachedScreenshots = (shots: AttachedScreenshot[]) => {
    inputAttachedScreenshots.value = [...inputAttachedScreenshots.value, ...shots]
  }

  const removeInputAttachedScreenshot = (id: string) => {
    inputAttachedScreenshots.value = inputAttachedScreenshots.value.filter(s => s.id !== id)
  }

  const clearInputAttachedScreenshots = () => {
    inputAttachedScreenshots.value = []
  }

  const setInputScreenshotDrawingStates = (states: Record<string, any>) => {
    inputScreenshotDrawingStates.value = states
  }

  const toggleWebSearch = () => {
    enableWebSearch.value = !enableWebSearch.value
  }

  const createNewSession = async (questionBmNo: string) => {
    const id = `session_${Date.now()}`
    currentSessionId.value = id
    messages.value = []
    return id
  }

  const switchToSession = async (sessionId: string) => {
    currentSessionId.value = sessionId
    // 加载会话消息逻辑
  }

  const deleteSession = async (sessionId: string, questionBmNo: string) => {
    sessions.value = sessions.value.filter(s => s.id !== sessionId)
    if (currentSessionId.value === sessionId) resetState()
  }

  const deleteMessage = async (messageId: string, questionBmNo?: string) => {
    messages.value = messages.value.filter(m => m.id !== messageId)
  }

  const retryMessage = async (messageId: string, question: any, userInfo: any, subject: any, model: string, imageData: any) => {
    // 重试逻辑
  }

  return {
    messages,
    currentSessionId,
    sessions,
    chatResponseTimes,
    isChatLoading,
    enableWebSearch,
    canViewAnswer,
    inputAttachedScreenshots,
    inputScreenshotDrawingStates,
    sendMessage,
    loadChatHistory,
    resetState,
    setInputAttachedScreenshots,
    appendInputAttachedScreenshots,
    removeInputAttachedScreenshot,
    clearInputAttachedScreenshots,
    setInputScreenshotDrawingStates,
    toggleWebSearch,
    createNewSession,
    switchToSession,
    deleteSession,
    deleteMessage,
    retryMessage
  }
})

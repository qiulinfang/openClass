/**
 * AI 题目聊天 Store (UniApp 适配版)
 * 职责：管理 AI 题目场景下的聊天消息与逻辑
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AiChatApi } from '@/services/api/aiChatApi'
import { ChatStorageService } from '@/services/chatStorageService'
import type { AttachedScreenshot, ChatBubble } from '@/types/chat'
import type { ChatImageData, ChatQuotedMessage } from '@/store/utils/chatStoreUtils'
import { createUserMessage, generateUniqueId } from '@/store/utils/chatStoreUtils'
import { useChatPersistence } from '@/composables/useChatPersistence'
import { useChatRetry } from '@/composables/useChatRetry'
import { useChatEngine } from '@/composables/useChatEngine'
import { validateExerciseChatRequest } from '@/store/utils/requestValidator'
import { getApiPaths } from '@/config/env-config'
import { Sender } from '@/types/enums'

export interface ExerciseSession {
  id: string
  questionBmNo: string
  title: string
  messages: ChatBubble[]
  chatResponseTimes: number
  createdAt: number
  updatedAt: number
}

const normalizeSubject = (sub?: string): string => {
  if (!sub) return 'math'
  const lower = String(sub).toLowerCase()
  if (lower.includes('math') || lower.includes('数学')) return 'math'
  return lower
}

const buildAiExerciseMessage = (
  content: string,
  currentQuestion: any,
  subject: 'MATH' | 'BIOLOGY',
  enableWebSearch: boolean,
  selectedModel: string = 'mate',
  imageData?: ChatImageData,
  imageList?: ChatImageData[],
  sessionId?: string | null,
) => {
  let conversationContent = content
  if (content.includes('我们开始吧')) {
    conversationContent = '我们开始吧'
  }

  const questionId = currentQuestion?.bmNo || currentQuestion?.id || ''
  const userId = uni.getStorageSync('xuebanuserid') || 'User'
  const finalSessionId = sessionId || `${userId ? userId + '-' : ''}exercise-${questionId}-${Date.now()}`

  const effectiveApiSubject = normalizeSubject(currentQuestion?.subject || subject)
  const apiUrl = effectiveApiSubject === 'math' ? getApiPaths().xueban.ai.chatMath : getApiPaths().xueban.ai.chat

  const maxImages = 3
  const normalizedImageList = Array.isArray(imageList)
    ? imageList
        .filter((img) => !!img?.base64DataUrl)
        .slice(0, maxImages)
        .map((img) => ({
          base64DataUrl: img.base64DataUrl!.startsWith('data:image/jpeg;')
            ? img.base64DataUrl!.replace('data:image/jpeg;', 'data:image/jpg;')
            : img.base64DataUrl!,
        }))
    : []

  const singleBase64 = imageData?.base64DataUrl
    ? (imageData.base64DataUrl.startsWith('data:image/jpeg;')
      ? imageData.base64DataUrl.replace('data:image/jpeg;', 'data:image/jpg;')
      : imageData.base64DataUrl)
    : undefined

  const request = {
    sessionId: finalSessionId,
    newValue: '1',
    coversation: conversationContent,
    question: currentQuestion?.question || currentQuestion?.title || '',
    answer: Array.isArray(currentQuestion?.answer) ? currentQuestion.answer.join(', ') : String(currentQuestion?.answer || ''),
    name: userId,
    reason: 'start',
    bmNo: questionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    role: selectedModel,
    subject: subject,
    dstUrl: apiUrl,
    explanation: currentQuestion?.explanation || '',
    imageList:
      normalizedImageList.length > 0
        ? normalizedImageList
        : singleBase64
          ? [{ base64DataUrl: singleBase64 }]
          : undefined,
  }

  validateExerciseChatRequest(request, currentQuestion?.title || currentQuestion?.question || '未知题目')
  return request
}

export const useAiExerciseChatStore = defineStore('aiExerciseChat', () => {
  const messages = ref<ChatBubble[]>([])
  const lastHistorySignature = ref<string>('')
  const currentSessionId = ref<string | null>(null)
  const sessions = ref<ExerciseSession[]>([])
  const isChatLoading = ref(false)
  const enableWebSearch = ref(false)

  const inputAttachedScreenshots = ref<AttachedScreenshot[]>([])
  const inputScreenshotDrawingStates = ref<Record<string, unknown>>({})

  const chatPersistence = useChatPersistence(
    {
      save: async (key: string, payload: { messages: ChatBubble[] }) => {
        ChatStorageService.saveSessionMessages(key, payload.messages)
      },
      load: async (key: string) => {
        const msgs = ChatStorageService.getSessionMessages(key)
        return { messages: msgs }
      },
    },
    { debounceMs: 0 }
  )

  const retryHelper = useChatRetry({ maxRetries: 3 })
  const chatEngine = useChatEngine({
    messagesRef: messages,
    lastHistorySignatureRef: lastHistorySignature,
    onAfterHistorySync: () => saveChatHistory(),
  })

  const sendMessage = async (
    content: string,
    currentQuestion: any,
    userInfo: any = null,
    subject: 'MATH' | 'BIOLOGY' = 'MATH',
    selectedModel: string = 'mate',
    skipUserMessage?: boolean,
    quotedMessage?: ChatQuotedMessage,
    imageData?: ChatImageData,
    imageList?: ChatImageData[],
  ): Promise<void> => {
    if (!currentQuestion) {
      throw new Error('请先选择题目')
    }

    if (!currentSessionId.value) {
      const qBmNo = currentQuestion.bmNo || currentQuestion.id || 'default'
      currentSessionId.value = `exercise_${qBmNo}_${Date.now()}`
    }

    if (!skipUserMessage) {
      const userMessage = createUserMessage(content, imageData, false, currentSessionId.value, quotedMessage)
      messages.value.push(userMessage)
    }

    const tempReplyId = generateUniqueId('temp_ai')
    const tempReplyMessage: ChatBubble = {
      id: tempReplyId,
      content: '',
      type: Sender.AI,
      timestamp: new Date().toISOString(),
      sender: Sender.AI,
      isStreaming: false,
      selectedModel: selectedModel || 'mate',
      sessionId: currentSessionId.value,
    }
    messages.value.push(tempReplyMessage)

    const aiRequest = buildAiExerciseMessage(
      content,
      currentQuestion,
      subject,
      enableWebSearch.value,
      selectedModel,
      imageData,
      imageList,
      currentSessionId.value,
    )

    try {
      isChatLoading.value = true
      const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReplyMessage)
      await AiChatApi.sendChatMessage(aiRequest, onComplete, onStream, onHistoryUpdate)
      await saveChatHistory()
    } catch (error) {
      console.error('[aiExerciseChatStore] 发送失败:', error)
      const index = messages.value.findIndex((m) => m.id === tempReplyId)
      if (index >= 0) {
        messages.value[index] = {
          ...tempReplyMessage,
          content: '发送失败，请重试',
          isStreaming: false,
          isError: true,
          canRetry: true,
          originalMessage: content,
        }
      }
      throw error
    } finally {
      isChatLoading.value = false
    }
  }

  const deleteMessage = async (messageId: string): Promise<void> => {
    messages.value = messages.value.filter((m) => m.id !== messageId)
    await saveChatHistory()
  }

  const saveChatHistory = async (): Promise<void> => {
    if (!currentSessionId.value) return
    await chatPersistence.save(currentSessionId.value, { messages: messages.value })
  }

  const loadChatHistory = async (sessionId: string): Promise<void> => {
    currentSessionId.value = sessionId
    const data = await chatPersistence.load(sessionId)
    messages.value = data?.messages || []
  }

  const setInputAttachedScreenshots = (shots: AttachedScreenshot[]): void => {
    inputAttachedScreenshots.value = Array.isArray(shots) ? shots : []
  }

  const removeInputAttachedScreenshot = (id: string): void => {
    inputAttachedScreenshots.value = inputAttachedScreenshots.value.filter((s) => s.id !== id)
  }

  const clearInputAttachedScreenshots = (): void => {
    inputAttachedScreenshots.value = []
  }

  const setInputScreenshotDrawingStates = (states: Record<string, unknown>): void => {
    inputScreenshotDrawingStates.value = states || {}
  }

  return {
    messages,
    sessions,
    currentSessionId,
    isChatLoading,
    enableWebSearch,
    inputAttachedScreenshots,
    inputScreenshotDrawingStates,
    sendMessage,
    deleteMessage,
    saveChatHistory,
    loadChatHistory,
    setInputAttachedScreenshots,
    removeInputAttachedScreenshot,
    clearInputAttachedScreenshots,
    setInputScreenshotDrawingStates,
  }
})

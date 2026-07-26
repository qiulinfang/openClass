/**
 * AI 教材/截图聊天 Store (UniApp 适配版)
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AiChatApi } from '@/services/api/aiChatApi'
import { ChatStorageService } from '@/services/chatStorageService'
import type { AttachedScreenshot, ChatBubble } from '@/types/chat'
import type { ChatImageData } from '@/store/utils/chatStoreUtils'
import { createUserMessage, generateUniqueId } from '@/store/utils/chatStoreUtils'
import { useChatPersistence } from '@/composables/useChatPersistence'
import { useChatEngine } from '@/composables/useChatEngine'
import { getApiPaths } from '@/config/env-config'
import { Sender } from '@/types/enums'

export const useAiTextbookChatStore = defineStore('aiTextbookChat', () => {
  const messages = ref<ChatBubble[]>([])
  const lastHistorySignature = ref<string>('')
  const currentSessionId = ref<string | null>(null)
  const isChatLoading = ref(false)
  const enableWebSearch = ref(false)

  const attachedScreenshots = ref<AttachedScreenshot[]>([])
  const screenshotDrawingStates = ref<Record<string, unknown>>({})

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

  const chatEngine = useChatEngine({
    messagesRef: messages,
    lastHistorySignatureRef: lastHistorySignature,
    onAfterHistorySync: () => saveChatHistory(),
  })

  const sendMessage = async (
    content: string,
    resourceId?: string,
    selectedModel: string = 'mate',
    imageData?: ChatImageData,
    imageList?: ChatImageData[],
  ): Promise<void> => {
    if (!currentSessionId.value) {
      currentSessionId.value = `textbook_${resourceId || 'res'}_${Date.now()}`
    }

    const userMessage = createUserMessage(content, imageData, false, currentSessionId.value)
    messages.value.push(userMessage)

    const tempReplyId = generateUniqueId('temp_ai')
    const tempReplyMessage: ChatBubble = {
      id: tempReplyId,
      content: '',
      type: Sender.AI,
      timestamp: new Date().toISOString(),
      sender: Sender.AI,
      isStreaming: false,
      selectedModel,
      sessionId: currentSessionId.value,
    }
    messages.value.push(tempReplyMessage)

    const userId = uni.getStorageSync('xuebanuserid') || 'User'
    const dstUrl = getApiPaths().xueban.ai.previewPictureQA

    const singleBase64 = imageData?.base64DataUrl

    const aiRequestPayload = {
      sessionId: currentSessionId.value,
      newValue: '1',
      coversation: content,
      name: userId,
      reason: 'start',
      bmNo: currentSessionId.value,
      isWebSearch: enableWebSearch.value ? '1' : '0',
      role: selectedModel,
      subject: 'MATH',
      dstUrl,
      explanation: '',
      imageList: singleBase64 ? [{ base64DataUrl: singleBase64 }] : undefined,
    }

    try {
      isChatLoading.value = true
      const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReplyMessage)
      await AiChatApi.sendChatMessage(aiRequestPayload, onComplete, onStream, onHistoryUpdate)
      await saveChatHistory()
    } catch (error) {
      console.error('[aiTextbookChatStore] 发送失败:', error)
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

  return {
    messages,
    currentSessionId,
    isChatLoading,
    enableWebSearch,
    attachedScreenshots,
    screenshotDrawingStates,
    sendMessage,
    deleteMessage,
    saveChatHistory,
    loadChatHistory,
  }
})

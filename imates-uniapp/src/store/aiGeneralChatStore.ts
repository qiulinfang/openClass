/**
 * AI 通用聊天 Store (UniApp 适配版)
 * 职责：管理 AI 通用场景下的聊天消息与多会话
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AiChatApi } from '@/services/api/aiChatApi'
import { ChatStorageService } from '@/services/chatStorageService'
import type { AttachedScreenshot, AiGeneralSession, ChatBubble } from '@/types/chat'
import type { ChatQuotedMessage, ChatImageData } from '@/store/utils/chatStoreUtils'
import { generateUniqueId } from '@/store/utils/chatStoreUtils'
import { useChatPersistence } from '@/composables/useChatPersistence'
import { useChatSessions } from '@/composables/useChatSessions'
import { useChatRetry } from '@/composables/useChatRetry'
import { useChatEngine } from '@/composables/useChatEngine'
import { useHtmlMessageRawMap } from '@/composables/useHtmlMessageRawMap'
import { validateGeneralChatRequest } from '@/store/utils/requestValidator'
import { getApiPaths } from '@/config/env-config'
import { Sender } from '@/types/enums'

const buildAiGeneralMessage = (
  content: string,
  enableWebSearch: boolean,
  chatRole: string = 'mate',
  sessionId?: string | null,
  useScreenshotApi: boolean = false,
  imageList?: { base64DataUrl: string }[],
  focus?: any,
) => {
  const userId = uni.getStorageSync('xuebanuserid') || 'User'
  const finalSessionId = sessionId || `${userId ? userId + '-' : ''}general-session-${Date.now()}`
  const dstUrl = useScreenshotApi ? getApiPaths().xueban.ai.previewPictureQA : getApiPaths().xueban.ai.chats

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
    : undefined

  const request = {
    sessionId: finalSessionId,
    newValue: '1',
    coversation: content,
    question: '',
    answer: '',
    name: userId,
    reason: 'start',
    bmNo: finalSessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    role: chatRole,
    subject: '',
    dstUrl,
    explanation: '',
    imageList: normalizedImageList,
    focus,
  }

  validateGeneralChatRequest(request, finalSessionId)
  return request
}

export const useAiGeneralChatStore = defineStore('aiGeneralChat', () => {
  // ==================== 状态定义 ====================
  const messages = ref<ChatBubble[]>([])
  const lastHistorySignature = ref<string>('')
  const sessions = ref<AiGeneralSession[]>([])
  const currentSession = ref<AiGeneralSession | null>(null)
  const isChatLoading = ref(false)
  const enableWebSearch = ref(false)
  const isCreatingSession = ref(false)

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

  const sessionPersistence = useChatSessions<AiGeneralSession>({
    save: async (data) => {
      ChatStorageService.saveSessions(data)
    },
    load: async () => {
      return ChatStorageService.getSessions()
    },
    deleteSingle: async (sessionId) => {
      ChatStorageService.removeSession(sessionId)
    }
  })

  const retryHelper = useChatRetry({ maxRetries: 3 })

  const chatEngine = useChatEngine({
    messagesRef: messages,
    lastHistorySignatureRef: lastHistorySignature,
    onAfterHistorySync: () => saveChatHistory(),
  })

  const { ensureHtmlRawMapForMessage } = useHtmlMessageRawMap()

  const createUserMessage = (content: string, sessionId?: string, quotedMessage?: ChatQuotedMessage): ChatBubble => {
    return {
      id: Date.now().toString(),
      content,
      type: Sender.USER,
      timestamp: new Date().toISOString(),
      sender: Sender.USER,
      messageType: 'text',
      sessionId,
      quotedMessage,
    }
  }

  const createTempReplyMessage = (selectedModel?: string): { message: ChatBubble; id: string } => {
    const tempReplyId = generateUniqueId('temp_ai')
    const tempReplyMessage: ChatBubble = {
      id: tempReplyId,
      content: '',
      type: Sender.AI,
      timestamp: new Date().toISOString(),
      sender: Sender.AI,
      isStreaming: false,
      selectedModel: selectedModel || 'mate',
    }
    return { message: tempReplyMessage, id: tempReplyId }
  }

  // ==================== 公开方法 ====================

  const sendMessage = async (
    content: string,
    userInfo: any = null,
    subject: string = '',
    selectedModel: string = 'mate',
    skipUserMessage?: boolean,
    quotedMessage?: ChatQuotedMessage,
    imageData?: ChatImageData,
    imageList?: ChatImageData[],
  ): Promise<void> => {
    if (!currentSession.value) {
      await createSession(content)
    }

    if (!skipUserMessage) {
      const userMessage = createUserMessage(content, currentSession.value?.sessionId, quotedMessage)
      messages.value.push(userMessage)
    } else if ((imageList && imageList.length > 0) || (imageData && imageData.base64DataUrl)) {
      const now = Date.now()
      const hasMulti = !!(imageList && imageList.length > 0)

      if (hasMulti) {
        const standardImageList = (imageList || [])
          .filter((img) => !!img.base64DataUrl)
          .slice(0, 3)
          .map((img) => ({
            filePath: img.filePath || '',
            width: img.width || 0,
            height: img.height || 0,
            fileSize: img.fileSize || 0,
            base64DataUrl: img.base64DataUrl!,
            isLargeImage: img.isLargeImage || false,
          }))

        const imageMessage: ChatBubble = {
          id: now.toString(),
          content: '',
          type: Sender.USER,
          timestamp: new Date().toISOString(),
          sender: Sender.USER,
          messageType: 'multi_image',
          imageList: standardImageList,
          sessionId: currentSession.value?.sessionId,
          quotedMessage,
        }
        messages.value.push(imageMessage)
      } else if (imageData && imageData.base64DataUrl) {
        const imageMessage: ChatBubble = {
          id: now.toString(),
          content: '',
          type: Sender.USER,
          timestamp: new Date().toISOString(),
          sender: Sender.USER,
          messageType: 'image',
          imageData: {
            filePath: imageData.filePath || '',
            width: imageData.width || 0,
            height: imageData.height || 0,
            fileSize: imageData.fileSize || 0,
            base64DataUrl: imageData.base64DataUrl,
          },
          sessionId: currentSession.value?.sessionId,
          quotedMessage,
        }
        messages.value.push(imageMessage)
      }

      if (content && content.trim()) {
        const textMessage: ChatBubble = {
          id: (now + 1).toString(),
          content,
          type: Sender.USER,
          timestamp: new Date().toISOString(),
          sender: Sender.USER,
          messageType: 'text',
          sessionId: currentSession.value?.sessionId,
        }
        messages.value.push(textMessage)
      }
    }

    const { message: tempReply, id: tempReplyId } = createTempReplyMessage(selectedModel)
    messages.value.push(tempReply)

    const hasMultiImages = !!(imageList && imageList.length > 0)
    const hasSingleImage = !!(imageData && imageData.base64DataUrl)
    const useScreenshotApi = hasMultiImages || hasSingleImage

    const imageListForRequest = hasMultiImages
      ? (imageList || []).filter((img) => !!img.base64DataUrl).slice(0, 3).map((img) => ({ base64DataUrl: img.base64DataUrl! }))
      : hasSingleImage
        ? [{ base64DataUrl: imageData!.base64DataUrl! }]
        : undefined

    const aiRequest = buildAiGeneralMessage(
      content,
      enableWebSearch.value,
      selectedModel,
      currentSession.value?.sessionId,
      useScreenshotApi,
      imageListForRequest,
    )

    const tempIndex = messages.value.findIndex((m) => m.id === tempReplyId)
    if (tempIndex >= 0) {
      messages.value[tempIndex] = {
        ...messages.value[tempIndex],
        originalDstUrl: aiRequest.dstUrl,
      }
    }

    try {
      isChatLoading.value = true
      const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReply)
      await AiChatApi.sendChatMessage(aiRequest, onComplete, onStream, onHistoryUpdate)

      const aiIndex = messages.value.findIndex((m) => m.id === tempReplyId)
      if (aiIndex >= 0) {
        const msg = messages.value[aiIndex]
        const changed = await ensureHtmlRawMapForMessage(msg)
        if (changed) {
          messages.value[aiIndex] = { ...msg }
          await saveChatHistory()
        }
      }

      await saveChatHistory()

      if (currentSession.value && messages.value.length === 7) {
        checkAutoGenerateTitle()
      }
    } catch (error) {
      console.error('[aiGeneralChatStore] 发送失败:', error)
      const index = messages.value.findIndex((m) => m.id === tempReplyId)
      if (index >= 0) {
        const old = messages.value[index]
        messages.value[index] = {
          ...tempReply,
          content: '发送失败，请重试',
          isStreaming: false,
          isError: true,
          canRetry: true,
          originalMessage: content,
          originalDstUrl: old.originalDstUrl,
        }
      }
      throw error
    } finally {
      isChatLoading.value = false
    }
  }

  const retryMessage = async (
    messageId: string,
    userInfo: any = null,
    subject: string = '',
    selectedModel: string = 'mate'
  ): Promise<void> => {
    await retryHelper.retryByDeleteAndResend({
      ctx: {
        messages,
        deleteMessage,
      },
      messageId,
      selectedModel,
      resend: async ({ originalContent, quotedMessage, selectedModel: model }) => {
        await sendMessage(
          originalContent,
          userInfo,
          subject,
          model || selectedModel,
          false,
          quotedMessage,
        )
      },
    })
  }

  const checkAutoGenerateTitle = () => {
    if (!currentSession.value) return
    const userMsg = messages.value.find((m) => m.sender === Sender.USER)
    if (userMsg && userMsg.content) {
      const newTitle = userMsg.content.substring(0, 15) + (userMsg.content.length > 15 ? '...' : '')
      currentSession.value.sessionName = newTitle
      saveSessions()
    }
  }

  const canCreateSession = computed(() => {
    if (isCreatingSession.value) return false
    if (currentSession.value && currentSession.value.msgCount === 0) return false
    return true
  })

  const createSession = async (firstMessage: string = '新对话'): Promise<void> => {
    if (!canCreateSession.value) return

    try {
      isCreatingSession.value = true
      const userId = uni.getStorageSync('xuebanuserid') || ''
      const newSession: AiGeneralSession = {
        sessionId: `${userId ? userId + '-' : ''}general-session-${Date.now()}`,
        sessionName: firstMessage.length > 20 ? firstMessage.substring(0, 20) + '...' : firstMessage,
        createTime: Date.now(),
        updateTime: Date.now(),
        msgCount: 0,
      }

      sessions.value.unshift(newSession)
      currentSession.value = newSession
      messages.value = []
      await saveSessions()
    } finally {
      setTimeout(() => {
        isCreatingSession.value = false
      }, 500)
    }
  }

  const switchSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.find((s) => s.sessionId === sessionId)
    if (!session) return
    currentSession.value = session
    await loadChatHistory(sessionId)
  }

  const deleteSession = async (sessionId: string): Promise<void> => {
    await sessionPersistence.deleteSingle?.(sessionId)
    sessions.value = sessions.value.filter((s) => s.sessionId !== sessionId)
    if (currentSession.value?.sessionId === sessionId) {
      if (sessions.value.length > 0) {
        await switchSession(sessions.value[0].sessionId)
      } else {
        currentSession.value = null
        messages.value = []
      }
    }
  }

  const togglePinSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.find((s) => s.sessionId === sessionId)
    if (!session) return
    session.pinned = !session.pinned
    await saveSessions()
  }

  const renameSession = async (sessionId: string, newName: string): Promise<void> => {
    const session = sessions.value.find((s) => s.sessionId === sessionId)
    if (!session) return
    session.sessionName = newName.trim() || session.sessionName
    if (currentSession.value?.sessionId === sessionId) {
      currentSession.value.sessionName = session.sessionName
    }
    await saveSessions()
  }

  const deleteMessage = async (messageId: string): Promise<void> => {
    messages.value = messages.value.filter((m) => m.id !== messageId)
    await saveChatHistory()
  }

  const loadSessions = async (): Promise<void> => {
    const list = await sessionPersistence.load()
    sessions.value = list || []
    if (sessions.value.length > 0 && !currentSession.value) {
      await switchSession(sessions.value[0].sessionId)
    }
  }

  const saveSessions = async (): Promise<void> => {
    await sessionPersistence.save(sessions.value)
  }

  const loadChatHistory = async (sessionId: string): Promise<void> => {
    const data = await chatPersistence.load(sessionId)
    messages.value = data?.messages || []
  }

  const saveChatHistory = async (): Promise<void> => {
    if (!currentSession.value?.sessionId) return
    currentSession.value.msgCount = messages.value.length
    currentSession.value.updateTime = Date.now()

    // 补齐 1:1 会话卡片预览快照字段
    const userMsg = messages.value.find((m) => m.sender === Sender.USER)
    const aiMsg = messages.value.find((m) => m.sender === Sender.AI)
    const lastMsg = messages.value[messages.value.length - 1]
    if (userMsg?.content) currentSession.value.userMessage = userMsg.content
    if (aiMsg?.content) currentSession.value.aiMessage = aiMsg.content
    if (lastMsg?.content) currentSession.value.lastMessage = lastMsg.content

    await chatPersistence.save(currentSession.value.sessionId, { messages: messages.value })
    await saveSessions()
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
    currentSession,
    isChatLoading,
    enableWebSearch,
    inputAttachedScreenshots,
    inputScreenshotDrawingStates,
    sendMessage,
    retryMessage,
    deleteMessage,
    createSession,
    switchSession,
    deleteSession,
    togglePinSession,
    renameSession,
    loadSessions,
    saveSessions,
    loadChatHistory,
    saveChatHistory,
    setInputAttachedScreenshots,
    removeInputAttachedScreenshot,
    clearInputAttachedScreenshots,
    setInputScreenshotDrawingStates,
  }
})

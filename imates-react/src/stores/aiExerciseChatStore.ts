import { create } from 'zustand'
import type { ChatBubble, ExerciseItem, UserInfo, AttachedScreenshot, AiChatMessageRequest, HtmlPreviewFocus } from '@/types'
import { Sender } from '@/types/enums'
import { apiService } from '@/services/http/api-service'
import { chatStorage, type ChatHistoryData } from '@/services/storage/chat-storage'
import { 
  createUserMessage, 
  generateUniqueId, 
  createTempAiReplyMessage,
  type ChatImageData, 
  type ChatQuotedMessage 
} from '@/stores/utils/chatStoreUtils'
import { createChatEngine } from '@/stores/utils/chatEngine'
import { createChatPersistence } from '@/stores/utils/chatPersistence'
import { createChatRetry } from '@/stores/utils/chatRetry'
import { validateExerciseChatRequest } from '@/stores/utils/requestValidator'
import { getApiPaths } from '@/config/env-config'
import { getUserId } from '@/services/http/auth-service'
import { normalizeSubject } from '@/constants/subjects'

/**
 * 构建AI题目聊天消息请求
 */
const buildAiExerciseMessage = (
  content: string,
  currentQuestion: ExerciseItem,
  userInfo: UserInfo | null,
  subject: 'MATH' | 'BIOLOGY',
  enableWebSearch: boolean,
  selectedModel: string = 'mate',
  imageData?: ChatImageData,
  imageList?: ChatImageData[],
  sessionId?: string | null,
  focus?: HtmlPreviewFocus,
): AiChatMessageRequest => {

  // 如果内容包含"我们开始吧"，只发送"我们开始吧"给后端
  let conversationContent = content
  if (content.includes('我们开始吧')) {
    conversationContent = '我们开始吧'
  }

  // 获取题目ID
  const questionId = currentQuestion.bmNo || ''

  // 优先使用传入的 sessionId，如果没有则新建（使用题目ID和时间戳）
  const userId = getUserId() || ''
  const finalSessionId = sessionId || `${userId ? userId + '-' : ''}exercise-${questionId}-${Date.now()}`

  // 根据题目学科确定API路径，而不是全局用户学科设置
  const effectiveApiSubject = normalizeSubject((currentQuestion as any).subject)
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

  const request: AiChatMessageRequest = {
    sessionId: finalSessionId,
    newValue: '1',
    coversation: conversationContent,
    question: currentQuestion.question || currentQuestion.title || '',
    answer: currentQuestion.answer || '',
    name: getUserId() || 'User',
    reason: 'start',
    bmNo: questionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    role: selectedModel,
    subject: subject,
    dstUrl: apiUrl,
    explanation: currentQuestion.explanation || '',
    imageList:
      normalizedImageList.length > 0
        ? normalizedImageList
        : singleBase64
          ? [{ base64DataUrl: singleBase64 }]
          : undefined,
    focus,
  }

  // 校验请求参数完整性
  validateExerciseChatRequest(request, currentQuestion.title || currentQuestion.question || '未知题目')

  return request
}

/**
 * 会话信息接口
 */
export interface ExerciseSession {
  id: string                    // 会话ID
  questionBmNo: string          // 关联的题目bmNo
  title: string                 // 会话标题
  messages: ChatBubble[]        // 聊天记录
  chatResponseTimes: number     // AI回复次数
  createdAt: number             // 创建时间
  updatedAt: number             // 更新时间
  // 快照信息
  aiMessage?: string            // AI第一条消息
  userMessage?: string          // 用户第一条消息
  lastMessage?: string          // 最后一条消息
  previewMessagesMarkdown?: string[]
}

interface AiExerciseChatState {
  messages: ChatBubble[]
  lastHistorySignature: string
  currentSessionId: string | null
  sessions: ExerciseSession[]
  chatResponseTimes: number
  isChatLoading: boolean
  enableWebSearch: boolean
  canViewAnswer: boolean
  inputAttachedScreenshots: AttachedScreenshot[]
  inputScreenshotDrawingStates: Record<string, any>
  
  setMessages: (messages: ChatBubble[]) => void
  setLastHistorySignature: (signature: string) => void
  setIsChatLoading: (loading: boolean) => void
  setEnableWebSearch: (enabled: boolean) => void
  setInputAttachedScreenshots: (screenshots: AttachedScreenshot[]) => void
  appendInputAttachedScreenshots: (screenshots: AttachedScreenshot[]) => void
  removeInputAttachedScreenshot: (id: string) => void
  clearInputAttachedScreenshots: () => void
  setInputScreenshotDrawingStates: (states: Record<string, any>) => void
  
  sendMessage: (
    content: string,
    currentQuestion: ExerciseItem | null,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string,
    imageData?: ChatImageData,
    hidePrefix?: boolean,
    skipUserMessage?: boolean,
    quotedMessage?: ChatQuotedMessage,
    imageList?: ChatImageData[],
    focus?: HtmlPreviewFocus,
  ) => Promise<void>
  
  retryMessage: (
    messageId: string,
    currentQuestion: ExerciseItem | null,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string,
    imageData?: ChatImageData,
    quotedMessage?: ChatQuotedMessage,
  ) => Promise<void>
  
  saveChatHistory: (questionBmNo: string) => Promise<void>
  loadChatHistory: (questionBmNo: string) => Promise<void>
  clearChatHistory: (questionBmNo: string) => Promise<void>
  deleteMessage: (messageId: string, questionBmNo?: string) => Promise<void>
  resetState: () => void
  
  // 多会话管理
  switchToSession: (sessionId: string) => Promise<void>
  createNewSession: (questionBmNo: string) => Promise<string>
  saveCurrentSession: (questionBmNo: string) => Promise<void>
  loadSessionsList: (questionBmNo: string) => Promise<void>
}

export const useAiExerciseChatStore = create<AiExerciseChatState>((set, get) => {
  const chatPersistence = createChatPersistence<ChatHistoryData>(
    {
      save: async (key: string, payload: ChatHistoryData) => {
        await chatStorage.saveChatHistory(key.replace('ai-exercise-', ''), payload)
      },
      load: async (key: string) => {
        return await chatStorage.loadChatHistory(key.replace('ai-exercise-', ''))
      },
    },
    { debounceMs: 0 }
  )

  const retryHelper = createChatRetry({ maxRetries: 3 })

  const chatEngine = createChatEngine({
    getMessages: () => get().messages,
    getLastHistorySignature: () => get()?.lastHistorySignature || '',
    setMessages: (messages) => set({ messages }),
    setLastHistorySignature: (signature) => set({ lastHistorySignature: signature }),
  })

  // 辅助函数：提取快照
  const extractSnapshotFromMessages = (msgs: ChatBubble[]) => {
    const aiMessages = msgs.filter(m => m.type === Sender.AI && m.content)
    const userMessages = msgs.filter(m => m.type === Sender.USER && m.content)
    const MAX_PREVIEW = 5
    const previewMessagesMarkdown = msgs
      .slice(0, MAX_PREVIEW)
      .map(m => (typeof m.content === 'string' ? m.content : String(m.content || '')))

    return {
      aiMessage: aiMessages[0]?.content?.substring(0, 100),
      userMessage: userMessages[0]?.content?.substring(0, 100),
      lastMessage: msgs[msgs.length - 1]?.content?.substring(0, 100),
      previewMessagesMarkdown,
    }
  }

  return {
    messages: [],
    lastHistorySignature: '',
    currentSessionId: null,
    sessions: [],
    chatResponseTimes: 0,
    isChatLoading: false,
    enableWebSearch: false,
    canViewAnswer: false,
    inputAttachedScreenshots: [],
    inputScreenshotDrawingStates: {},

    setMessages: (messages) => set({ messages }),
    setLastHistorySignature: (signature) => set({ lastHistorySignature: signature }),
    setIsChatLoading: (loading) => set({ isChatLoading: loading }),
    setEnableWebSearch: (enabled) => set({ enableWebSearch: enabled }),
    
    setInputAttachedScreenshots: (screenshots) => set({ inputAttachedScreenshots: screenshots }),
    appendInputAttachedScreenshots: (shots) => set((state) => ({ 
      inputAttachedScreenshots: [...state.inputAttachedScreenshots, ...shots] 
    })),
    removeInputAttachedScreenshot: (id) => set((state) => {
      const nextShots = state.inputAttachedScreenshots.filter(s => s.id !== id)
      const nextStates = { ...state.inputScreenshotDrawingStates }
      if (nextStates[id]) delete nextStates[id]
      return { 
        inputAttachedScreenshots: nextShots,
        inputScreenshotDrawingStates: nextStates
      }
    }),
    clearInputAttachedScreenshots: () => set({ 
      inputAttachedScreenshots: [], 
      inputScreenshotDrawingStates: {} 
    }),
    setInputScreenshotDrawingStates: (states) => set({ inputScreenshotDrawingStates: states }),

    sendMessage: async (
      content,
      currentQuestion,
      userInfo,
      subject,
      selectedModel = 'mate',
      imageData,
      hidePrefix = false,
      skipUserMessage = false,
      quotedMessage,
      imageList,
      focus,
    ) => {
      if (!currentQuestion) throw new Error('请先选择一道题目')

      if (!get().currentSessionId) {
        const userId = getUserId() || ''
        const newSessionId = `${userId ? userId + '-' : ''}exercise-${currentQuestion.bmNo}-${Date.now()}`
        set({ currentSessionId: newSessionId })
      }

      let aiRequest: AiChatMessageRequest
      try {
        aiRequest = buildAiExerciseMessage(
          content,
          currentQuestion,
          userInfo,
          subject,
          get().enableWebSearch,
          selectedModel,
          imageData,
          imageList,
          get().currentSessionId,
          focus,
        )
      } catch (error) {
        throw error
      }

      if (!skipUserMessage) {
        if (imageList && imageList.length > 0) {
          const now = Date.now()
          const standardImageList = imageList
            .filter((img) => !!img.base64DataUrl)
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
            sessionId: get().currentSessionId || undefined,
            quotedMessage,
          }
          set((state) => ({ messages: [...state.messages, imageMessage] }))

          if (content && content.trim()) {
            const textMessage: ChatBubble = {
              id: (now + 1).toString(),
              content,
              type: Sender.USER,
              timestamp: new Date().toISOString(),
              sender: Sender.USER,
              messageType: 'text',
              sessionId: get().currentSessionId || undefined,
            }
            set((state) => ({ messages: [...state.messages, textMessage] }))
          }
        } else {
          const userMessage = createUserMessage(
            content,
            imageData,
            hidePrefix || content.includes('我们开始吧'),
            get().currentSessionId || undefined,
            quotedMessage,
          )
          set((state) => ({ messages: [...state.messages, userMessage] }))
        }
      }

      const { message: tempReply, id: tempReplyId } = createTempAiReplyMessage(selectedModel, get().currentSessionId || undefined)
      set((state) => ({ messages: [...state.messages, tempReply], isChatLoading: true }))

      try {
        const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReply)
        
        await apiService.sendChatMessage(aiRequest, onComplete, onStream, onHistoryUpdate)

        set((state) => {
          const nextTimes = state.chatResponseTimes + 1
          return {
            chatResponseTimes: nextTimes,
            canViewAnswer: nextTimes >= 3,
            isChatLoading: false
          }
        })

        if (currentQuestion.bmNo) {
          await get().saveCurrentSession(currentQuestion.bmNo)
        }
      } catch (error) {
        const msgs = get().messages
        const idx = msgs.findIndex(m => m.id === tempReplyId)
        if (idx >= 0) {
          const updated = [...msgs]
          updated[idx] = {
            ...tempReply,
            content: '发送失败，请重试',
            isStreaming: false,
            isError: true,
            canRetry: true,
            originalMessage: content,
          }
          set({ messages: updated, isChatLoading: false })
        }
        throw error
      }
    },

    retryMessage: async (
      messageId,
      currentQuestion,
      userInfo,
      subject,
      selectedModel = 'mate',
      imageData,
      quotedMessage,
    ) => {
      if (!currentQuestion) throw new Error('请先选择一道题目')

      const info = retryHelper.prepareRetryInfo(() => get().messages, messageId)
      const { message, retryCount, originalContent } = info

      const updatedMessages = [...get().messages]
      updatedMessages[info.index] = {
        ...message,
        content: '',
        isStreaming: true,
        isError: false,
        canRetry: false,
        retryCount: retryCount + 1,
        selectedModel: selectedModel || message.selectedModel || 'mate'
      }
      set({ messages: updatedMessages })

      let aiRequest: AiChatMessageRequest
      try {
        aiRequest = buildAiExerciseMessage(
          originalContent,
          currentQuestion,
          userInfo,
          subject,
          get().enableWebSearch,
          selectedModel,
          imageData,
          undefined,
          get().currentSessionId,
        )
      } catch (error) {
        throw error
      }

      try {
        const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(messageId, updatedMessages[info.index])
        await apiService.sendChatMessage(aiRequest, onComplete, onStream, onHistoryUpdate)
        
        if (currentQuestion.bmNo) {
          await get().saveChatHistory(currentQuestion.bmNo)
        }
      } catch (error) {
        const msgs = get().messages
        const idx = msgs.findIndex(m => m.id === messageId)
        if (idx >= 0) {
          const updated = [...msgs]
          updated[idx] = {
            ...message,
            content: `重试失败 (${retryCount + 1}/3)，请稍后重试。`,
            isError: true,
            isStreaming: false,
            canRetry: retryCount + 1 < 3,
            retryCount: retryCount + 1
          }
          set({ messages: updated })
        }
        throw error
      }
    },

    saveChatHistory: async (questionBmNo) => {
      if (!get().currentSessionId || get().messages.length === 0) return
      const storageKey = `ai-exercise-${questionBmNo}-${get().currentSessionId}`
      const historyData: ChatHistoryData = {
        questionId: storageKey,
        messages: get().messages,
        chatResponseTimes: get().chatResponseTimes,
        lastUpdated: Date.now()
      }
      await chatPersistence.save(storageKey, historyData)
    },

    loadChatHistory: async (questionBmNo) => {
      set({ isChatLoading: true, currentSessionId: null })
      await get().loadSessionsList(questionBmNo)
      
      const sessions = get().sessions
      if (sessions.length > 0) {
        const recent = sessions.reduce((prev, curr) => (prev.updatedAt > curr.updatedAt ? prev : curr))
        await get().switchToSession(recent.id)
      } else {
        set({ messages: [], chatResponseTimes: 0, canViewAnswer: false, currentSessionId: null })
      }
      set({ isChatLoading: false })
    },

    clearChatHistory: async (questionBmNo) => {
      const key = `ai-exercise-${questionBmNo}`
      await chatStorage.removeChatHistory(key)
      set({ messages: [], chatResponseTimes: 0, currentSessionId: null, canViewAnswer: false })
    },

    deleteMessage: async (messageId, questionBmNo) => {
      const msgs = get().messages
      const index = msgs.findIndex(m => m.id === messageId)
      if (index < 0) throw new Error('消息不存在')

      let startIndex = index
      if (msgs[index].sender === Sender.AI) {
        for (let i = index - 1; i >= 0; i--) {
          if (msgs[i].sender === Sender.USER) {
            startIndex = i
            break
          }
        }
      }

      let startBackendId = msgs[startIndex]?.messageId
      if (!startBackendId) {
        for (let i = startIndex; i < msgs.length; i++) {
          if (msgs[i].messageId) {
            startBackendId = msgs[i].messageId
            break
          }
        }
      }

      const updated = [...msgs]
      updated.splice(startIndex)
      set({ messages: updated })

      if (questionBmNo) {
        await get().saveChatHistory(questionBmNo)
      }

      if (get().currentSessionId && startBackendId) {
        try {
          await apiService.manageConversationMemory({
            command: 'delete_messages',
            thread_id: get().currentSessionId!,
            message_id: startBackendId,
            agent_name: 'solvingbot',
          })
        } catch (e) {
          console.warn('同步后端记忆失败', e)
        }
      }
    },

    resetState: () => set({
      messages: [],
      chatResponseTimes: 0,
      canViewAnswer: false,
      isChatLoading: false,
      currentSessionId: null,
      sessions: []
    }),

    switchToSession: async (sessionId) => {
      const session = get().sessions.find(s => s.id === sessionId)
      if (!session) return

      if (get().currentSessionId && get().messages.length > 0) {
        await get().saveCurrentSession(session.questionBmNo)
      }

      const storageKey = `ai-exercise-${session.questionBmNo}-${sessionId}`
      const history = await chatPersistence.load(storageKey)
      if (history) {
        set({ 
          messages: history.messages || [], 
          chatResponseTimes: history.chatResponseTimes || 0,
          currentSessionId: sessionId,
          canViewAnswer: (history.chatResponseTimes || 0) >= 3
        })
      } else {
        set({ messages: [], chatResponseTimes: 0, currentSessionId: sessionId, canViewAnswer: false })
      }
    },

    createNewSession: async (questionBmNo) => {
      if (get().currentSessionId && get().messages.length > 0) {
        await get().saveCurrentSession(questionBmNo)
      }
      const userId = getUserId() || ''
      const newId = `${userId ? userId + '-' : ''}exercise-${questionBmNo}-${Date.now()}`
      set({ 
        currentSessionId: newId, 
        messages: [], 
        chatResponseTimes: 0, 
        canViewAnswer: false 
      })
      return newId
    },

    saveCurrentSession: async (questionBmNo) => {
      if (!get().currentSessionId || get().messages.length === 0) return
      
      const snapshot = extractSnapshotFromMessages(get().messages)
      const now = Date.now()
      const sessions = [...get().sessions]
      const idx = sessions.findIndex(s => s.id === get().currentSessionId)
      
      const sessionData: ExerciseSession = {
        id: get().currentSessionId!,
        questionBmNo,
        title: idx >= 0 ? sessions[idx].title : (snapshot.userMessage || '新会话'),
        messages: [...get().messages],
        chatResponseTimes: get().chatResponseTimes,
        createdAt: idx >= 0 ? sessions[idx].createdAt : now,
        updatedAt: now,
        ...snapshot
      }

      if (idx >= 0) sessions[idx] = sessionData
      else sessions.push(sessionData)
      
      set({ sessions })

      // 持久化列表
      const metaList = sessions.map(s => ({
        id: s.id,
        questionBmNo: s.questionBmNo,
        title: s.title,
        chatResponseTimes: s.chatResponseTimes,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
        aiMessage: s.aiMessage,
        userMessage: s.userMessage,
        lastMessage: s.lastMessage,
        previewMessagesMarkdown: s.previewMessagesMarkdown,
      }))
      await chatStorage.saveSessionsList(questionBmNo, metaList)
      await get().saveChatHistory(questionBmNo)
    },

    loadSessionsList: async (questionBmNo) => {
      const metaList = await chatStorage.loadSessionsList(questionBmNo)
      const filtered = metaList.filter(m => m.questionBmNo === questionBmNo)
      set({ 
        sessions: filtered.map(m => ({ 
          ...m, 
          messages: [], 
          previewMessagesMarkdown: m.previewMessagesMarkdown || [] 
        })) 
      })
    }
  }
})

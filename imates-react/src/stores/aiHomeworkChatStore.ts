import { create } from 'zustand'
import type { ChatBubble, AiHomeworkSession, UserInfo, AttachedScreenshot, AiChatMessageRequest, HtmlPreviewFocus, ExerciseItem } from '../types'
import { Sender } from '../types/enums'
import { apiService } from '../services/http/api-service'
import { chatStorage, type ChatHistoryData } from '../services/storage/chat-storage'
import { 
  createUserMessage, 
  generateUniqueId, 
  createTempAiReplyMessage,
  type ChatImageData, 
  type ChatQuotedMessage 
} from './utils/chatStoreUtils'
import { createChatEngine } from './utils/chatEngine'
import { createChatPersistence } from './utils/chatPersistence'
import { createChatRetry } from './utils/chatRetry'
import { createChatSessions } from './utils/chatSessions'
import { validateGeneralChatRequest } from './utils/requestValidator'
import { getApiPaths } from '../config/env-config'
import { getUserId } from '../services/http/auth-service'
import { normalizeSubject } from '../constants/subjects'
import localforage from 'localforage'

/**
 * 构建 AI 作业对话消息请求
 */
const buildAiHomeworkMessage = (
  content: string,
  userInfo: UserInfo | null,
  enableWebSearch: boolean,
  chatRole: string = 'mate',
  sessionId?: string | null,
  useScreenshotApi: boolean = false,
  imageList?: { base64DataUrl: string }[],
  focus?: HtmlPreviewFocus,
  question?: ExerciseItem | null,
): AiChatMessageRequest => {
  const createSessionId = (maybeSessionId?: string) => {
    const userId = getUserId() || ''
    const finalSessionId = maybeSessionId || `${userId ? userId + '-' : ''}homework-session-${Date.now()}`
    return {
      sessionId: finalSessionId,
      newValue: '1',
    }
  }
  const { sessionId: finalSessionId, newValue } = createSessionId(sessionId ?? undefined)
  
  // ai-homework 统一使用 ai-exercise 的接口逻辑
  const effectiveApiSubject = normalizeSubject((question as any)?.subject || 'BIOLOGY')
  const apiUrl = effectiveApiSubject === 'math' ? getApiPaths().xueban.ai.chatMath : getApiPaths().xueban.ai.chat
  
  // 构建完整的题目信息（题干 + 选项）
  const fullQuestion = (() => {
    let q = question?.question || question?.title || ''
    if (question?.structuredContent?.options && question.structuredContent.options.length > 0) {
      const optionsStr = question.structuredContent.options
        .map(opt => `${opt.label}. ${opt.text}`)
        .join('\n')
      q += `\n\n选项：\n${optionsStr}`
    }
    return q
  })()

  const request: AiChatMessageRequest = {
    sessionId: finalSessionId,
    newValue,
    coversation: content, 
    question: fullQuestion,
    answer: question?.answer || '',
    name: getUserId() || 'User',
    reason: 'start',
    bmNo: question?.bmNo || finalSessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    role: chatRole,
    subject: '',
    dstUrl: apiUrl,
    explanation: question?.explanation || question?.analysisData || '',
    imageList: imageList && imageList.length > 0 ? imageList : undefined,
    focus,
  }
  
  validateGeneralChatRequest(request, finalSessionId)
  return request
}

interface AiHomeworkChatState {
  messages: ChatBubble[]
  lastHistorySignature: string
  sessions: AiHomeworkSession[]
  currentSession: AiHomeworkSession | null
  isChatLoading: boolean
  enableWebSearch: boolean
  isCreatingSession: boolean
  currentQuestionId: string | null
  inputAttachedScreenshots: AttachedScreenshot[]
  inputScreenshotDrawingStates: Record<string, unknown>
  
  setMessages: (messages: ChatBubble[]) => void
  setLastHistorySignature: (signature: string) => void
  setIsChatLoading: (loading: boolean) => void
  setEnableWebSearch: (enabled: boolean) => void
  setInputAttachedScreenshots: (shots: AttachedScreenshot[]) => void
  clearInputAttachedScreenshots: () => void
  setInputScreenshotDrawingStates: (states: Record<string, unknown>) => void
  removeInputAttachedScreenshot: (id: string) => void
  
  sendMessage: (
    content: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    question: ExerciseItem | null,
    selectedModel?: string,
    skipUserMessage?: boolean,
    quotedMessage?: ChatQuotedMessage,
    imageData?: ChatImageData,
    imageList?: ChatImageData[],
    focus?: HtmlPreviewFocus,
    displayContent?: string,
  ) => Promise<void>
  
  retryMessage: (
    messageId: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    question: ExerciseItem | null,
    selectedModel?: string
  ) => Promise<void>
  
  setQuestionContext: (questionId: string) => Promise<void>
  createSession: (firstMessage: string) => Promise<void>
  switchSession: (sessionId: string) => Promise<void>
  saveChatHistory: () => Promise<void>
  loadChatHistory: (sessionId: string) => Promise<void>
  saveSessions: () => Promise<void>
  loadSessions: () => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  resetState: (resetContext?: boolean) => void
}

export const useAiHomeworkChatStore = create<AiHomeworkChatState>((set, get) => {
  const chatPersistence = createChatPersistence<ChatHistoryData>(
    {
      save: async (key: string, payload: ChatHistoryData) => {
        const sanitizedPayload = JSON.parse(JSON.stringify(payload))
        await chatStorage.saveChatHistory(key.replace('ai-homework-', ''), sanitizedPayload)
      },
      load: async (key: string) => {
        return await chatStorage.loadChatHistory(key.replace('ai-homework-', ''))
      },
    },
    { debounceMs: 0 }
  )

  const sessionPersistence = createChatSessions<AiHomeworkSession>({
    save: async (data) => {
      const sanitizedData = JSON.parse(JSON.stringify(data))
      await localforage.setItem(`ai_homework_sessions_${getUserId()}`, sanitizedData)
    },
    load: async () => {
      const data = await localforage.getItem<AiHomeworkSession[]>(`ai_homework_sessions_${getUserId()}`)
      return data || []
    },
  })

  const retryHelper = createChatRetry({ maxRetries: 3 })

  const chatEngine = createChatEngine({
    getMessages: () => get().messages,
    lastHistorySignature: get().lastHistorySignature || '',
    setMessages: (messages) => set({ messages }),
    setLastHistorySignature: (signature) => set({ lastHistorySignature: signature }),
    onAfterHistorySync: () => get().saveChatHistory(),
  })

  const extractSnapshotFromMessages = (msgs: ChatBubble[]) => {
    const MAX_PREVIEW = 5
    const previewMessagesMarkdown = msgs
      .slice(0, MAX_PREVIEW)
      .map(m => (typeof m.content === 'string' ? m.content : String(m.content || '')))
    return { previewMessagesMarkdown }
  }

  return {
    messages: [],
    lastHistorySignature: '',
    sessions: [],
    currentSession: null,
    isChatLoading: false,
    enableWebSearch: false,
    isCreatingSession: false,
    currentQuestionId: null,
    inputAttachedScreenshots: [],
    inputScreenshotDrawingStates: {},

    setMessages: (messages) => set({ messages }),
    setLastHistorySignature: (signature) => set({ lastHistorySignature: signature }),
    setIsChatLoading: (loading) => set({ isChatLoading: loading }),
    setEnableWebSearch: (enabled) => set({ enableWebSearch: enabled }),
    
    setInputAttachedScreenshots: (shots) => set({ inputAttachedScreenshots: Array.isArray(shots) ? shots : [] }),
    clearInputAttachedScreenshots: () => set({ inputAttachedScreenshots: [] }),
    setInputScreenshotDrawingStates: (states) => set({ inputScreenshotDrawingStates: states || {} }),
    removeInputAttachedScreenshot: (id) => set((state) => {
      const nextShots = state.inputAttachedScreenshots.filter(s => s.id !== id)
      const nextStates = { ...state.inputScreenshotDrawingStates }
      if (id && id in nextStates) delete nextStates[id]
      return { 
        inputAttachedScreenshots: nextShots,
        inputScreenshotDrawingStates: nextStates
      }
    }),

    sendMessage: async (
      content,
      userInfo,
      subject,
      question,
      selectedModel = 'mate',
      skipUserMessage = false,
      quotedMessage,
      imageData,
      imageList,
      focus,
      displayContent,
    ) => {
      if (!get().currentSession) {
        await get().createSession(displayContent || content)
      }
      
      const session = get().currentSession!

      if (!skipUserMessage) {
        const userMessage = createUserMessage(displayContent || content, undefined, false, session.sessionId, quotedMessage)
        set((state) => ({ messages: [...state.messages, userMessage] }))
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
            sessionId: session.sessionId,
            quotedMessage,
          }
          set((state) => ({ messages: [...state.messages, imageMessage] }))
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
            sessionId: session.sessionId,
            quotedMessage,
          }
          set((state) => ({ messages: [...state.messages, imageMessage] }))
        }

        if (content && content.trim()) {
          const textMessage: ChatBubble = {
            id: (now + 1).toString(),
            content,
            type: Sender.USER,
            timestamp: new Date().toISOString(),
            sender: Sender.USER,
            messageType: 'text',
            sessionId: session.sessionId,
          }
          set((state) => ({ messages: [...state.messages, textMessage] }))
        }
      }

      const { message: tempReply, id: tempReplyId } = createTempAiReplyMessage(selectedModel, session.sessionId)
      set((state) => ({ messages: [...state.messages, tempReply] }))

      const hasMultiImages = !!(imageList && imageList.length > 0)
      const hasSingleImage = !!(imageData && imageData.base64DataUrl)
      const useScreenshotApi = hasMultiImages || hasSingleImage

      const imageListForRequest = imageList?.map(img => ({ base64DataUrl: img.base64DataUrl! })) 
        || (imageData ? [{ base64DataUrl: imageData.base64DataUrl! }] : undefined)

      const aiRequest = buildAiHomeworkMessage(
        content,
        userInfo,
        get().enableWebSearch,
        selectedModel,
        session.sessionId,
        useScreenshotApi,
        imageListForRequest,
        focus,
        question
      )

      try {
        const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReply)
        await apiService.sendChatMessage(aiRequest, onComplete, onStream, onHistoryUpdate)
        await get().saveChatHistory()
      } catch (error) {
        const index = get().messages.findIndex(m => m.id === tempReplyId)
        if (index >= 0) {
          const updated = [...get().messages]
          updated[index] = {
            ...tempReply,
            content: '发送失败，请重试',
            isStreaming: false,
            isError: true,
            canRetry: true,
            originalMessage: content,
          }
          set({ messages: updated })
        }
        throw error
      }
    },

    retryMessage: async (messageId, userInfo, subject, question, selectedModel = 'mate') => {
      await retryHelper.retryByDeleteAndResend({
        ctx: {
          getMessages: () => get().messages,
          setMessages: (messages) => set({ messages }),
          deleteMessage: get().deleteMessage,
        },
        messageId,
        selectedModel,
        resend: async ({ originalContent, quotedMessage, selectedModel: model }) => {
          await get().sendMessage(
            originalContent,
            userInfo,
            subject,
            question,
            model || selectedModel,
            false,
            quotedMessage,
          )
        },
      })
    },

    setQuestionContext: async (questionId) => {
      if (get().sessions.length === 0) {
        await get().loadSessions()
      }
      
      set({ currentQuestionId: questionId })
      
      const mySessions = get().sessions
        .filter(s => s.metadata?.questionBmNo === questionId)
        .sort((a, b) => (b.updateTime || 0) - (a.updateTime || 0))
      
      if (mySessions.length > 0) {
        const targetSessionId = mySessions[0].sessionId
        if (get().currentSession?.sessionId !== targetSessionId) {
          await get().switchSession(targetSessionId)
        }
      } else {
        set({ messages: [], currentSession: null })
      }
    },

    createSession: async (firstMessage) => {
      if (!get().currentQuestionId) return
      set({ isCreatingSession: true })
      try {
        const userId = getUserId() || ''
        const newSession: AiHomeworkSession = {
          sessionId: `${userId ? userId + '-' : ''}homework-session-${Date.now()}`,
          sessionName: firstMessage.substring(0, 20),
          createTime: Date.now(),
          updateTime: Date.now(),
          msgCount: 0,
          metadata: { questionBmNo: get().currentQuestionId! }
        }
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          currentSession: newSession,
          messages: []
        }))
        await get().saveSessions()
      } finally {
        set({ isCreatingSession: false })
      }
    },

    switchSession: async (sessionId) => {
      const session = get().sessions.find(s => s.sessionId === sessionId)
      if (!session) return
      set({ currentSession: session })
      await get().loadChatHistory(sessionId)
    },

    saveChatHistory: async () => {
      const { currentSession, messages } = get()
      if (!currentSession || messages.length === 0) return
      
      const snapshot = extractSnapshotFromMessages(messages)
      currentSession.msgCount = messages.length
      currentSession.updateTime = Date.now()
      ;(currentSession as any).previewMessagesMarkdown = snapshot.previewMessagesMarkdown
      
      const historyData: ChatHistoryData = {
        questionId: currentSession.sessionId,
        messages,
        chatResponseTimes: 0,
        lastUpdated: Date.now()
      }
      await chatPersistence.save(`ai-homework-${currentSession.sessionId}`, historyData)
      await get().saveSessions()
    },

    loadChatHistory: async (sessionId) => {
      set({ isChatLoading: true })
      const historyData = await chatPersistence.load(`ai-homework-${sessionId}`)
      set({ 
        messages: historyData?.messages || [],
        isChatLoading: false
      })
    },

    saveSessions: async () => {
      await sessionPersistence.save(get().sessions)
    },

    loadSessions: async () => {
      const sessions = await sessionPersistence.load()
      set({ sessions })
    },

    deleteSession: async (sessionId) => {
      const sessions = get().sessions.filter(s => s.sessionId !== sessionId)
      let currentSession = get().currentSession
      let messages = get().messages
      if (currentSession?.sessionId === sessionId) {
        currentSession = null
        messages = []
      }
      set({ sessions, currentSession, messages })
      await localforage.removeItem(`chat_history_session_${sessionId}`)
      await get().saveSessions()
    },

    deleteMessage: async (messageId) => {
      const msgs = [...get().messages]
      const index = msgs.findIndex(m => m.id === messageId)
      if (index === -1) return

      if (msgs[index].sender === Sender.USER) {
        set({ messages: msgs.slice(0, index) })
      } else {
        let lastUserIndex = -1
        for (let i = index - 1; i >= 0; i--) {
          if (msgs[i].sender === Sender.USER) {
            lastUserIndex = i
            break
          }
        }
        set({ messages: lastUserIndex !== -1 ? msgs.slice(0, lastUserIndex) : msgs.slice(0, index) })
      }
      await get().saveChatHistory()
    },

    resetState: (resetContext = true) => set({
      messages: [],
      currentSession: null,
      currentQuestionId: resetContext ? null : get().currentQuestionId
    })
  }
})

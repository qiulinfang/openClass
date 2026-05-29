import { create } from 'zustand'
import type { ChatBubble, AiGeneralSession, UserInfo, AttachedScreenshot, AiChatMessageRequest, HtmlPreviewFocus } from '../types'
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
import localforage from 'localforage'

/**
 * 构建 AI 通用聊天消息请求
 */
const buildAiGeneralMessage = (
  content: string,
  userInfo: UserInfo | null,
  enableWebSearch: boolean,
  chatRole: string = 'mate',
  sessionId?: string | null,
  useScreenshotApi: boolean = false,
  imageList?: { base64DataUrl: string }[],
  focus?: HtmlPreviewFocus,
): AiChatMessageRequest => {
  const createSessionId = (maybeSessionId?: string) => {
    const userId = getUserId() || ''
    const finalSessionId = maybeSessionId || `${userId ? userId + '-' : ''}general-session-${Date.now()}`
    return {
      sessionId: finalSessionId,
      newValue: '1',
    }
  }
  const { sessionId: finalSessionId, newValue } = createSessionId(sessionId ?? undefined)
  const dstUrl = useScreenshotApi ? getApiPaths().xueban.ai.previewPictureQA : getApiPaths().xueban.ai.chats
  
  const request: AiChatMessageRequest = {
    sessionId: finalSessionId,
    newValue,
    coversation: content,
    question: '',
    answer: '',
    name: getUserId() || 'User',
    reason: 'start',
    bmNo: finalSessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    role: chatRole,
    subject: '',
    dstUrl,
    explanation: '',
    imageList: imageList && imageList.length > 0 ? imageList : undefined,
    focus,
  }
  
  validateGeneralChatRequest(request, finalSessionId)
  
  return request
}

interface AiGeneralChatState {
  messages: ChatBubble[]
  lastHistorySignature: string
  sessions: AiGeneralSession[]
  currentSession: AiGeneralSession | null
  isChatLoading: boolean
  enableWebSearch: boolean
  isCreatingSession: boolean
  inputAttachedScreenshots: AttachedScreenshot[]
  inputScreenshotDrawingStates: Record<string, unknown>
  
  setMessages: (messages: ChatBubble[]) => void
  setLastHistorySignature: (signature: string) => void
  setIsChatLoading: (loading: boolean) => void
  setEnableWebSearch: (enabled: boolean) => void
  setInputAttachedScreenshots: (screenshots: AttachedScreenshot[]) => void
  clearInputAttachedScreenshots: () => void
  setInputScreenshotDrawingStates: (states: Record<string, unknown>) => void
  removeInputAttachedScreenshot: (id: string) => void
  
  sendMessage: (
    content: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string,
    skipUserMessage?: boolean,
    quotedMessage?: ChatQuotedMessage,
    imageData?: ChatImageData,
    imageList?: ChatImageData[],
    focus?: HtmlPreviewFocus,
  ) => Promise<void>
  
  retryMessage: (
    messageId: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string
  ) => Promise<void>
  
  createSession: (firstMessage: string) => Promise<void>
  switchSession: (sessionId: string) => Promise<void>
  saveChatHistory: () => Promise<void>
  loadChatHistory: (sessionId: string) => Promise<void>
  saveSessions: () => Promise<void>
  loadSessions: () => Promise<void>
  renameSession: (sessionId: string, newName: string) => Promise<void>
  togglePin: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  clearMessages: () => void
  resetState: () => void
  toggleWebSearch: () => void
  reloadHtmlImage: (messageId: string, url: string) => Promise<void>
}

export const useAiGeneralChatStore = create<AiGeneralChatState>((set, get) => {
  const chatPersistence = createChatPersistence<ChatHistoryData>(
    {
      save: async (key: string, payload: ChatHistoryData) => {
        await chatStorage.saveChatHistory(key.replace('ai-general-', ''), payload)
      },
      load: async (key: string) => {
        return await chatStorage.loadChatHistory(key.replace('ai-general-', ''))
      },
    },
    { debounceMs: 0 }
  )

  const sessionPersistence = createChatSessions<AiGeneralSession>({
    save: async (data) => {
      await chatStorage.saveGeneralSessions(data)
    },
    load: async () => {
      return await chatStorage.loadGeneralSessions()
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

  return {
    messages: [],
    lastHistorySignature: '',
    sessions: [],
    currentSession: null,
    isChatLoading: false,
    enableWebSearch: false,
    isCreatingSession: false,
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
      selectedModel = 'mate',
      skipUserMessage = false,
      quotedMessage,
      imageData,
      imageList,
      focus,
    ) => {
      if (!get().currentSession) {
        await get().createSession(content)
      }
      
      const session = get().currentSession!

      if (!skipUserMessage) {
        const userMessage = createUserMessage(content, undefined, false, session.sessionId, quotedMessage)
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

      const imageListForRequest = hasMultiImages
        ? (imageList || [])
            .filter((img) => !!img.base64DataUrl)
            .slice(0, 3)
            .map((img) => ({ base64DataUrl: img.base64DataUrl! }))
        : hasSingleImage
          ? [{ base64DataUrl: imageData!.base64DataUrl! }]
          : undefined

      const aiRequest = buildAiGeneralMessage(
        content,
        userInfo,
        get().enableWebSearch,
        selectedModel,
        session.sessionId,
        useScreenshotApi,
        imageListForRequest,
        focus,
      )

      const tempIndex = get().messages.findIndex((m) => m.id === tempReplyId)
      if (tempIndex >= 0) {
        const updated = [...get().messages]
        updated[tempIndex] = { ...updated[tempIndex], originalDstUrl: aiRequest.dstUrl }
        set({ messages: updated })
      }

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
            originalDstUrl: updated[index].originalDstUrl,
          }
          set({ messages: updated })
        }
        throw error
      }
    },

    retryMessage: async (messageId, userInfo, subject, selectedModel = 'mate') => {
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
            model || selectedModel,
            false,
            quotedMessage,
          )
        },
      })
    },

    createSession: async (firstMessage) => {
      if (get().isCreatingSession) return
      if (get().currentSession && get().messages.length === 0) return

      try {
        set({ isCreatingSession: true })
        const userId = getUserId() || ''
        const newSession: AiGeneralSession = {
          sessionId: `${userId ? userId + '-' : ''}general-session-${Date.now()}`,
          sessionName: firstMessage.length > 20 ? firstMessage.substring(0, 20) + '...' : firstMessage,
          createTime: Date.now(),
          updateTime: Date.now(),
          msgCount: 0
        }
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          currentSession: newSession,
          messages: []
        }))
        await get().saveSessions()
      } finally {
        setTimeout(() => set({ isCreatingSession: false }), 500)
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
      
      currentSession.msgCount = messages.length
      currentSession.updateTime = Date.now()
      
      const historyData: ChatHistoryData = {
        questionId: currentSession.sessionId,
        messages,
        chatResponseTimes: 0,
        lastUpdated: Date.now()
      }
      
      await chatPersistence.save(`ai-general-${currentSession.sessionId}`, historyData)
      await get().saveSessions()
    },

    loadChatHistory: async (sessionId) => {
      set({ isChatLoading: true })
      const historyData = await chatPersistence.load(`ai-general-${sessionId}`)
      set({ 
        messages: historyData?.messages || [],
        isChatLoading: false
      })
    },

    saveSessions: async () => {
      await sessionPersistence.save(get().sessions)
    },

    loadSessions: async () => {
      const userId = getUserId()
      const legacyKey = `${userId}_ai-general-sessions`
      const sessions = await sessionPersistence.loadWithLegacy({
        read: () => {
          const data = localStorage.getItem(legacyKey)
          return data ? JSON.parse(data) : null
        },
        clear: () => localStorage.removeItem(legacyKey),
      })
      set({ sessions })
    },

    renameSession: async (sessionId, newName) => {
      const sessions = [...get().sessions]
      const idx = sessions.findIndex(s => s.sessionId === sessionId)
      if (idx >= 0) {
        sessions[idx].sessionName = newName
        sessions[idx].updateTime = Date.now()
        set({ sessions })
        await get().saveSessions()
      }
    },

    togglePin: async (sessionId) => {
      const sessions = [...get().sessions]
      const idx = sessions.findIndex(s => s.sessionId === sessionId)
      if (idx >= 0) {
        sessions[idx].pinned = !sessions[idx].pinned
        sessions[idx].updateTime = Date.now()
        sessions.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          return b.updateTime - a.updateTime
        })
        set({ sessions })
        await get().saveSessions()
      }
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
      msgs.splice(startIndex)
      set({ messages: msgs })
      await get().saveChatHistory()
    },

    clearMessages: () => set({ messages: [] }),

    resetState: () => set({
      messages: [],
      currentSession: null,
      isChatLoading: false
    }),

    toggleWebSearch: () => set((state) => ({ enableWebSearch: !state.enableWebSearch })),

    reloadHtmlImage: async (messageId, url) => {
      console.warn('reloadHtmlImage not fully implemented in react version yet')
    }
  }
})

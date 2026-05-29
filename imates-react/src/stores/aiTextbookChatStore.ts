import { create } from 'zustand'
import type { ChatBubble, UserInfo, AttachedScreenshot, AiChatMessageRequest, HtmlPreviewFocus } from '@/types'
import { Sender } from '@/types/enums'
import { apiService } from '@/services/http/api-service'
import { chatStorage, type ChatHistoryData } from '@/services/storage/chat-storage'
import { 
  createUserMessage, 
  generateUniqueId, 
  createTempAiReplyMessage,
  updateMessageError,
  isResponseSuccess,
  type ChatImageData, 
  type ChatQuotedMessage 
} from '@/stores/utils/chatStoreUtils'
import { createChatEngine } from '@/stores/utils/chatEngine'
import { createChatPersistence } from '@/stores/utils/chatPersistence'
import { createChatRetry } from '@/stores/utils/chatRetry'
import { validateTextbookChatRequest } from '@/stores/utils/requestValidator'
import { getApiPaths } from '@/config/env-config'
import { getUserInfo, getSubject, getUserId } from '@/services/http/auth-service'
import { normalizeSubject } from '@/constants/subjects'

export interface ScreenshotDrawingState {
  objects: unknown
  history: unknown
  historyIndex: number
}

interface BuildTextbookMessageParams {
  content: string
  userInfo: UserInfo | null
  subject: string
  chatRole: string
  sessionId: string
  resourceId?: string | null
  sectionName?: string | null
  chapterInfo?: {
    grade: string
    subject: string
    textbook: string
    chapter_title: string
  } | null
  imageData?: { base64DataUrl: string }
  useScreenshotApi?: boolean
  isNewSession?: boolean
  imageList?: { base64DataUrl: string }[]
  focus?: HtmlPreviewFocus
}

const buildAiTextbookMessage = ({
  sessionId,
  content,
  userInfo,
  subject,
  chatRole = 'mate',
  sectionName,
  chapterInfo,
  imageData,
  useScreenshotApi = false,
  isNewSession = true,
  imageList,
  focus,
}: BuildTextbookMessageParams): AiChatMessageRequest => {
  const userId = getUserId() || 'User'

  const dstUrl = useScreenshotApi || imageData?.base64DataUrl ? getApiPaths().xueban.ai.previewPictureQA : getApiPaths().xueban.ai.chats

  const request: AiChatMessageRequest = {
    sessionId,
    newValue: isNewSession ? '1' : '0',
    coversation: content,
    question: '',
    answer: sectionName || '',
    name: userId,
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: '0',
    role: chatRole,
    subject,
    sectionName: sectionName || undefined,
    dstUrl,
    explanation: '', 
    imageList: imageList || (imageData ? [{ base64DataUrl: imageData.base64DataUrl }] : undefined),
    focus,
  }
  
  validateTextbookChatRequest(request, sessionId)
  
  return request
}

interface AiTextbookChatState {
  messages: ChatBubble[]
  lastHistorySignature: string
  isChatLoading: boolean
  chatResponseTimes: number
  enableWebSearch: boolean
  resourceId: string | null
  sectionName: string | null
  chapterInfo: {
    grade: string
    subject: string
    textbook: string
    chapter_title: string
  } | null
  useScreenshotApi: boolean
  currentSessionId: string | null
  isNewSession: boolean
  backendSessionId: string | null
  inputAttachedScreenshots: AttachedScreenshot[]
  inputScreenshotDrawingStates: Record<string, ScreenshotDrawingState>
  
  setMessages: (messages: ChatBubble[]) => void
  setLastHistorySignature: (signature: string) => void
  setIsChatLoading: (loading: boolean) => void
  setChapterInfo: (info: any) => void
  setResourceId: (id: string) => void
  setSectionName: (name: string | null) => void
  
  setInputAttachedScreenshots: (shots: AttachedScreenshot[]) => void
  appendInputAttachedScreenshots: (shots: AttachedScreenshot[]) => void
  removeInputAttachedScreenshot: (id: string) => void
  clearInputAttachedScreenshots: () => void
  setInputScreenshotDrawingStates: (states: Record<string, ScreenshotDrawingState>) => void
  removeInputScreenshotDrawingState: (id: string) => void
  clearInputScreenshotDrawingStates: () => void
  
  sendMessage: (
    content: string,
    selectedModel?: string,
    imageData?: ChatImageData,
    hidePrefix?: boolean,
    skipUserMessage?: boolean,
    quotedMessage?: ChatQuotedMessage,
    imageList?: ChatImageData[],
    focus?: HtmlPreviewFocus,
  ) => Promise<void>
  
  retryAiMessage: (
    messageId: string,
    chatRole?: string,
    imageData?: ChatImageData
  ) => Promise<void>
  
  saveChatHistory: () => Promise<void>
  loadChatHistory: (resourceIdOrStorageKey?: string) => Promise<void>
  clearChatHistory: () => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  clearMessages: () => void
  resetState: () => void
  reloadHtmlImage: (messageId: string, url: string) => Promise<void>
}

export const useAiTextbookChatStore = create<AiTextbookChatState>((set, get) => {
  const chatPersistence = createChatPersistence<ChatHistoryData>(
    {
      save: async (key: string, payload: ChatHistoryData) => {
        await chatStorage.saveChatHistory(key.replace('ai-textbook-', ''), payload)
      },
      load: async (key: string) => {
        return await chatStorage.loadChatHistory(key.replace('ai-textbook-', ''))
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
    onAfterHistorySync: () => get().saveChatHistory(),
  })

  const _initSessionContext = () => {
    let { currentSessionId, backendSessionId, isNewSession } = get()
    if (!currentSessionId) {
      const userId = getUserId() || ''
      currentSessionId = `${userId ? userId + '-' : ''}textbook-session-${Date.now()}`
      isNewSession = true
    }
    if (isNewSession || !backendSessionId) {
      const userId = getUserId() || ''
      backendSessionId = `${userId ? userId + '-' : ''}textbook-backend-${Date.now()}`
    }
    set({ currentSessionId, backendSessionId, isNewSession })
    return { frontendId: currentSessionId, backendId: backendSessionId, isBackendNew: isNewSession }
  }

  return {
    messages: [],
    lastHistorySignature: '',
    isChatLoading: false,
    chatResponseTimes: 0,
    enableWebSearch: false,
    resourceId: null,
    sectionName: null,
    chapterInfo: null,
    useScreenshotApi: false,
    currentSessionId: null,
    isNewSession: true,
    backendSessionId: null,
    inputAttachedScreenshots: [],
    inputScreenshotDrawingStates: {},

    setMessages: (messages) => set({ messages }),
    setLastHistorySignature: (signature) => set({ lastHistorySignature: signature }),
    setIsChatLoading: (loading) => set({ isChatLoading: loading }),
    setChapterInfo: (info) => set({ chapterInfo: info }),
    setResourceId: (id) => {
      const changed = get().resourceId !== id
      if (changed) {
        set({ 
          resourceId: id, 
          currentSessionId: null, 
          backendSessionId: null, 
          isNewSession: true 
        })
      }
    },
    setSectionName: (name) => set({ sectionName: name }),

    setInputAttachedScreenshots: (shots) => set({ inputAttachedScreenshots: shots }),
    appendInputAttachedScreenshots: (shots) => set((state) => ({ 
      inputAttachedScreenshots: state.inputAttachedScreenshots.concat(shots) 
    })),
    removeInputAttachedScreenshot: (id) => set((state) => ({ 
      inputAttachedScreenshots: state.inputAttachedScreenshots.filter(s => s.id !== id) 
    })),
    clearInputAttachedScreenshots: () => set({ inputAttachedScreenshots: [] }),
    
    setInputScreenshotDrawingStates: (states) => set((state) => ({ 
      inputScreenshotDrawingStates: { ...state.inputScreenshotDrawingStates, ...states } 
    })),
    removeInputScreenshotDrawingState: (id) => set((state) => {
      const copy = { ...state.inputScreenshotDrawingStates }
      delete copy[id]
      return { inputScreenshotDrawingStates: copy }
    }),
    clearInputScreenshotDrawingStates: () => set({ inputScreenshotDrawingStates: {} }),

    sendMessage: async (
      content,
      selectedModel = 'mate',
      imageData,
      hidePrefix = false,
      skipUserMessage = false,
      quotedMessage,
      imageList,
      focus,
    ) => {
      const hasImages = !!imageData || !!(imageList && imageList.length > 0)
      if (hasImages && !skipUserMessage) {
        set({ isNewSession: true, currentSessionId: null })
      }

      const { backendId, isBackendNew } = _initSessionContext()

      if (!skipUserMessage) {
        if (imageList && imageList.length > 0) {
          const standardImageList = imageList
            .filter((img) => !!img.base64DataUrl)
            .map((img) => ({
              filePath: img.filePath || '',
              width: img.width || 0,
              height: img.height || 0,
              fileSize: img.fileSize || 0,
              base64DataUrl: img.base64DataUrl,
              isLargeImage: img.isLargeImage || false,
            }))
          const now = Date.now()
          const imgMsg: ChatBubble = {
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
          set((state) => ({ messages: [...state.messages, imgMsg] }))
          if (content && content.trim()) {
            const txtMsg: ChatBubble = {
              id: (now + 1).toString(),
              content,
              type: Sender.USER,
              timestamp: new Date().toISOString(),
              sender: Sender.USER,
              messageType: 'text',
              sessionId: get().currentSessionId || undefined,
            }
            set((state) => ({ messages: [...state.messages, txtMsg] }))
          }
        } else {
          const userMsg = createUserMessage(content, imageData, hidePrefix, get().currentSessionId || undefined, quotedMessage)
          set((state) => ({ messages: [...state.messages, userMsg] }))
        }
        await get().saveChatHistory()
      }

      const { message: tempReply, id: tempReplyId } = createTempAiReplyMessage(selectedModel, get().currentSessionId || undefined)
      set((state) => ({ messages: [...state.messages, tempReply] }))

      try {
        const builderImageData = imageData?.base64DataUrl ? { base64DataUrl: imageData.base64DataUrl } : undefined
        const builderImageList = imageList?.filter((img) => !!img.base64DataUrl).map((img) => ({ base64DataUrl: img.base64DataUrl! }))
        const shouldUseScreenshotApi = !!builderImageData || !!(builderImageList && builderImageList.length > 0)

        const aiMessage = buildAiTextbookMessage({
          content,
          userInfo: getUserInfo(),
          subject: getSubject(),
          chatRole: selectedModel,
          sessionId: backendId,
          resourceId: get().resourceId,
          sectionName: get().sectionName,
          chapterInfo: get().chapterInfo,
          imageData: builderImageData,
          useScreenshotApi: shouldUseScreenshotApi,
          isNewSession: isBackendNew,
          imageList: builderImageList,
          focus,
        })

        set((state) => {
          const updated = [...state.messages]
          const idx = updated.findIndex(m => m.id === tempReplyId)
          if (idx >= 0) updated[idx] = { ...updated[idx], originalDstUrl: aiMessage.dstUrl }
          return { messages: updated, useScreenshotApi: shouldUseScreenshotApi, isNewSession: false }
        })

        const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReply)
        
        const wrappedOnComplete = async (finalResponse: any) => {
          await onComplete(finalResponse)
          if (isResponseSuccess(finalResponse)) {
            set((state) => ({ chatResponseTimes: state.chatResponseTimes + 1 }))
            await get().saveChatHistory()
          }
        }

        await apiService.sendChatMessage(aiMessage, wrappedOnComplete, onStream, onHistoryUpdate)
      } catch (error) {
        set((state) => {
          const updated = [...state.messages]
          const idx = updated.findIndex(m => m.id === tempReplyId)
          if (idx >= 0) {
            updated[idx] = updateMessageError(tempReply, '发送失败，请检查网络连接后重试。', content, imageData)
          }
          return { messages: updated }
        })
      }
    },

    retryAiMessage: async (messageId, chatRole = 'mate', imageData) => {
      await retryHelper.retryByDeleteAndResend({
        ctx: {
          getMessages: () => get().messages,
          setMessages: (messages) => set({ messages }),
          deleteMessage: get().deleteMessage,
        },
        messageId,
        selectedModel: chatRole,
        resend: async ({ originalContent, quotedMessage, selectedModel: model }) => {
          await get().sendMessage(
            originalContent,
            model || chatRole,
            imageData,
            false,
            false,
            quotedMessage,
          )
        },
      })
    },

    saveChatHistory: async () => {
      if (!get().resourceId) return
      const storageKey = `ai-textbook-${get().resourceId}`
      const payload: ChatHistoryData = {
        questionId: storageKey,
        messages: get().messages,
        lastUpdated: Date.now(),
        chatResponseTimes: get().chatResponseTimes,
      }
      await chatPersistence.save(storageKey, payload)
    },

    loadChatHistory: async (resourceIdOrStorageKey) => {
      const targetId = resourceIdOrStorageKey || get().resourceId
      if (!targetId) return
      set({ isChatLoading: true })
      const storageKey = `ai-textbook-${targetId}`
      const data = await chatPersistence.load(storageKey)
      set({ 
        messages: data?.messages || [],
        chatResponseTimes: data?.chatResponseTimes || 0,
        isChatLoading: false
      })
    },

    clearChatHistory: async () => {
      if (get().resourceId) {
        await chatStorage.removeChatHistory(`ai-textbook-${get().resourceId}`)
      }
      get().clearMessages()
    },

    deleteMessage: async (messageId) => {
      const msgs = [...get().messages]
      const index = msgs.findIndex(m => m.id === messageId)
      if (index < 0) return

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
      if (get().resourceId) await get().saveChatHistory()
    },

    clearMessages: () => set({
      messages: [],
      chatResponseTimes: 0,
      useScreenshotApi: false,
      currentSessionId: null,
      backendSessionId: null,
      isNewSession: true
    }),

    resetState: () => set({
      messages: [],
      chatResponseTimes: 0,
      resourceId: null,
      sectionName: null,
      chapterInfo: null,
      currentSessionId: null,
      backendSessionId: null,
      isNewSession: true,
      inputAttachedScreenshots: [],
      inputScreenshotDrawingStates: {}
    }),

    reloadHtmlImage: async (messageId, url) => {
      console.warn('reloadHtmlImage not implemented')
    }
  }
})

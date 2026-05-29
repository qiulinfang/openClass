import { create } from 'zustand'
import { apiService } from '@/services/http/api-service'
import { getApiPaths } from '@/config/env-config'
import { Sender } from '@/types/enums'
import type { ChatBubble, AiChatMessageRequest, UserInfo, HtmlPreviewFocus, AttachedScreenshot } from '@/types'
import { createChatEngine } from '@/stores/utils/chatEngine'
import { createChatRetry } from '@/stores/utils/chatRetry'
import { generateUniqueId, type ChatQuotedMessage, type ChatImageData } from '@/stores/utils/chatStoreUtils'
import { getUserId } from '@/services/http/auth-service'

interface HtmlPreviewChatState {
  messages: ChatBubble[]
  lastHistorySignature: string
  isChatLoading: boolean
  disableHistorySave: boolean
  sessionId: string | null
  enableWebSearch: boolean
  inputAttachedScreenshots: AttachedScreenshot[]
  
  // Actions
  setMessages: (messages: ChatBubble[]) => void
  setLastHistorySignature: (signature: string) => void
  setIsChatLoading: (loading: boolean) => void
  setSessionId: (id: string | null) => void
  setEnableWebSearch: (enabled: boolean) => void
  setInputAttachedScreenshots: (shots: AttachedScreenshot[]) => void
  
  sendMessage: (
    content: string,
    userInfo: UserInfo | null,
    options?: {
      selectedModel?: string
      skipUserMessage?: boolean
      quotedMessage?: ChatQuotedMessage
      imageData?: ChatImageData
      imageList?: ChatImageData[]
      focus?: HtmlPreviewFocus
    }
  ) => Promise<void>
  
  retryMessage: (
    messageId: string,
    userInfo: UserInfo | null,
    selectedModel?: string
  ) => Promise<void>
  
  deleteMessage: (messageId: string) => Promise<void>
  editMessage: (
    messageId: string,
    newContent: string,
    userInfo: UserInfo | null,
    options?: { selectedModel?: string; focus?: HtmlPreviewFocus }
  ) => Promise<void>
  
  clearMessages: () => void
  toggleWebSearch: () => void
  resetState: () => void
}

export const useHtmlPreviewChatStore = create<HtmlPreviewChatState>((set, get) => {
  const chatEngine = createChatEngine({
    getMessages: () => get().messages,
    getLastHistorySignature: () => get()?.lastHistorySignature || '',
    setMessages: (messages) => set({ messages }),
    setLastHistorySignature: (signature) => set({ lastHistorySignature: signature }),
    onAfterHistorySync: () => {}, // HTML 预览不同步历史
  })

  const retryHelper = createChatRetry({ maxRetries: 3 })

  const buildRequest = (
    content: string,
    userInfo: UserInfo | null,
    options: {
      selectedModel?: string
      enableWebSearch?: boolean
      imageList?: { base64DataUrl: string }[]
      focus?: HtmlPreviewFocus
    }
  ): AiChatMessageRequest => {
    const finalSessionId = get().sessionId || `preview-${Date.now()}`
    const useScreenshotApi = !!(options.imageList && options.imageList.length > 0)
    const dstUrl = useScreenshotApi ? getApiPaths().xueban.ai.previewPictureQA : getApiPaths().xueban.ai.chats

    return {
      sessionId: finalSessionId,
      newValue: '1',
      coversation: content,
      question: '',
      answer: '',
      name: userInfo?.userName || getUserId() || 'User',
      reason: 'start',
      bmNo: finalSessionId,
      isWebSearch: options.enableWebSearch ? '1' : '0',
      role: options.selectedModel || 'mate',
      subject: '',
      dstUrl,
      explanation: '',
      imageList: options.imageList,
      focus: options.focus,
    }
  }

  return {
    messages: [],
    lastHistorySignature: '',
    isChatLoading: false,
    disableHistorySave: true,
    sessionId: null,
    enableWebSearch: false,
    inputAttachedScreenshots: [],

    setMessages: (messages) => set({ messages }),
    setLastHistorySignature: (signature) => set({ lastHistorySignature: signature }),
    setIsChatLoading: (loading) => set({ isChatLoading: loading }),
    setSessionId: (id) => set({ sessionId: id }),
    setEnableWebSearch: (enabled) => set({ enableWebSearch: enabled }),
    setInputAttachedScreenshots: (shots) => set({ inputAttachedScreenshots: Array.isArray(shots) ? shots : [] }),

    sendMessage: async (content, userInfo, options = {}) => {
      const { selectedModel = 'mate', skipUserMessage = false, quotedMessage, imageData, imageList, focus } = options

      if (!skipUserMessage) {
        if ((imageList && imageList.length > 0) || (imageData && imageData.base64DataUrl)) {
          const now = Date.now()
          const hasMulti = !!(imageList && imageList.length > 0)

          if (hasMulti) {
            const standardImageList = (imageList || [])
              .filter((img) => !!img.base64DataUrl)
              .map((img) => ({
                filePath: img.filePath || '',
                width: img.width || 0,
                height: img.height || 0,
                fileSize: img.fileSize || 0,
                base64DataUrl: img.base64DataUrl!,
              }))

            set((state) => ({
              messages: [...state.messages, {
                id: now.toString(),
                content: '',
                type: Sender.USER,
                timestamp: new Date().toISOString(),
                sender: Sender.USER,
                messageType: 'multi_image',
                imageList: standardImageList,
                quotedMessage,
              }]
            }))
          } else if (imageData && imageData.base64DataUrl) {
            set((state) => ({
              messages: [...state.messages, {
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
                quotedMessage,
              }]
            }))
          }

          if (content && content.trim()) {
            set((state) => ({
              messages: [...state.messages, {
                id: (now + 1).toString(),
                content,
                type: Sender.USER,
                timestamp: new Date().toISOString(),
                sender: Sender.USER,
                messageType: 'text',
              }]
            }))
          }
        } else {
          set((state) => ({
            messages: [...state.messages, {
              id: Date.now().toString(),
              content,
              type: Sender.USER,
              timestamp: new Date().toISOString(),
              sender: Sender.USER,
              messageType: 'text',
              quotedMessage,
            }]
          }))
        }
      }

      const tempReplyId = generateUniqueId('temp_ai_preview')
      const tempReply: ChatBubble = {
        id: tempReplyId,
        content: '',
        type: Sender.AI,
        timestamp: new Date().toISOString(),
        sender: Sender.AI,
        isStreaming: false,
        selectedModel: selectedModel || 'mate'
      }
      set((state) => ({ messages: [...state.messages, tempReply] }))

      const hasMultiImages = !!(imageList && imageList.length > 0)
      const hasSingleImage = !!(imageData && imageData.base64DataUrl)
      const imageListForRequest = hasMultiImages
        ? (imageList || []).filter(img => !!img.base64DataUrl).map(img => ({ base64DataUrl: img.base64DataUrl! }))
        : hasSingleImage
          ? [{ base64DataUrl: imageData!.base64DataUrl! }]
          : undefined

      const request = buildRequest(content, userInfo, {
        selectedModel,
        enableWebSearch: get().enableWebSearch,
        imageList: imageListForRequest,
        focus,
      })

      try {
        set({ isChatLoading: true })
        const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReply)
        await apiService.sendChatMessage(request, onComplete, onStream, onHistoryUpdate)
      } catch (error) {
        console.error('[HtmlPreviewStore] 发送失败:', error)
        set((state) => {
          const updated = [...state.messages]
          const idx = updated.findIndex(m => m.id === tempReplyId)
          if (idx >= 0) {
            updated[idx] = {
              ...tempReply,
              content: '发送失败，请检查网络后重试',
              isStreaming: false,
              isError: true,
              canRetry: true,
              originalMessage: content,
            }
          }
          return { messages: updated }
        })
        throw error
      } finally {
        set({ isChatLoading: false })
      }
    },

    retryMessage: async (messageId, userInfo, selectedModel = 'mate') => {
      await retryHelper.retryByDeleteAndResend({
        ctx: { 
          getMessages: () => get().messages, 
          setMessages: (messages) => set({ messages }),
          deleteMessage: get().deleteMessage 
        },
        messageId,
        selectedModel,
        resend: async ({ originalContent, quotedMessage, selectedModel: model }) => {
          await get().sendMessage(originalContent, userInfo, {
            selectedModel: model || selectedModel,
            quotedMessage,
          })
        },
      })
    },

    deleteMessage: async (messageId) => {
      const msgs = [...get().messages]
      const index = msgs.findIndex(m => m.id === messageId)
      if (index < 0) return

      let startIndex = index
      const target = msgs[index]
      if (target.sender === Sender.AI) {
        for (let i = index - 1; i >= 0; i--) {
          if (msgs[i].sender === Sender.USER) {
            startIndex = i
            break
          }
        }
      }
      msgs.splice(startIndex)
      set({ messages: msgs })
    },

    editMessage: async (messageId, newContent, userInfo, options = {}) => {
      const msgs = [...get().messages]
      const index = msgs.findIndex((msg) => msg.id === messageId)
      if (index === -1) {
        throw new Error('消息不存在')
      }

      msgs[index].content = newContent
      msgs.splice(index + 1)
      set({ messages: msgs })

      await get().sendMessage(newContent, userInfo, {
        ...options,
        skipUserMessage: true,
      })
    },

    clearMessages: () => set({ messages: [] }),

    toggleWebSearch: () => set((state) => ({ enableWebSearch: !state.enableWebSearch })),

    resetState: () => set({
      messages: [],
      sessionId: null,
      isChatLoading: false,
      enableWebSearch: false,
      inputAttachedScreenshots: []
    })
  }
})

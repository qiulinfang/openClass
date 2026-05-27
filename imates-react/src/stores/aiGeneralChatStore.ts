import { create } from 'zustand'
import type { ChatBubble } from '../types'
import type { ChatImageData } from './utils/chatStoreUtils'
import { Sender } from '../types/enums'
import { sendChatMessage } from '../services/aiChatApi'

const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

interface AiGeneralChatState {
  messages: ChatBubble[]
  isChatLoading: boolean
  inputAttachedScreenshots: any[]
  inputScreenshotDrawingStates: Record<string, unknown>
  currentSessionId: string | null
  
  // Actions
  setMessages: (messages: ChatBubble[]) => void
  addMessage: (message: ChatBubble) => void
  clearMessages: () => void
  setIsChatLoading: (loading: boolean) => void
  setInputAttachedScreenshots: (screenshots: any[]) => void
  removeInputAttachedScreenshot: (id: string) => void
  clearInputAttachedScreenshots: () => void
  setInputScreenshotDrawingStates: (states: Record<string, unknown>) => void
  setCurrentSessionId: (sessionId: string | null) => void
  
  // Async actions (to be implemented)
  sendMessage: (
    content: string,
    selectedModel?: string,
    skipUserMessage?: boolean,
    quotedMessage?: any,
    imageData?: ChatImageData,
    imageList?: ChatImageData[],
    focus?: any
  ) => Promise<void>
  saveChatHistory: () => Promise<void>
}

export const useAiGeneralChatStore = create<AiGeneralChatState>((set, get) => ({
  messages: [],
  isChatLoading: false,
  inputAttachedScreenshots: [],
  inputScreenshotDrawingStates: {},
  currentSessionId: null,

  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  
  clearMessages: () => set({ messages: [] }),
  
  setIsChatLoading: (loading) => set({ isChatLoading: loading }),
  
  setInputAttachedScreenshots: (screenshots) => set({ 
    inputAttachedScreenshots: Array.isArray(screenshots) ? screenshots : [] 
  }),
  
  removeInputAttachedScreenshot: (id) => set((state) => ({
    inputAttachedScreenshots: state.inputAttachedScreenshots.filter(s => s.id !== id)
  })),
  
  clearInputAttachedScreenshots: () => set({ 
    inputAttachedScreenshots: [],
    inputScreenshotDrawingStates: {}
  }),
  
  setInputScreenshotDrawingStates: (states) => set({ 
    inputScreenshotDrawingStates: states || {} 
  }),
  
  setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
  
  sendMessage: async (content: string, selectedModel?: string, skipUserMessage?: boolean) => {
    const state = get()
    const currentSessionId = state.currentSessionId
    
    // 添加用户消息
    if (!skipUserMessage && content) {
      const userMessage: ChatBubble = {
        id: generateId(),
        content,
        sender: Sender.USER,
        type: Sender.USER,
        timestamp: new Date().toISOString()
      }
      set({ messages: [...state.messages, userMessage] })
    }
    
    // 创建临时 AI 消息
    const tempAiId = generateId()
    const tempAiMessage: ChatBubble = {
      id: tempAiId,
      content: '',
      sender: Sender.AI,
      type: Sender.AI,
      timestamp: new Date().toISOString(),
      isStreaming: true,
    }
    set({ messages: [...get().messages, tempAiMessage], isChatLoading: true })
    
    // 调用真实 API
    try {
      const response = await sendChatMessage(
        content,
        currentSessionId || undefined,
        selectedModel || 'mate',
        false,
        (chunk, isComplete) => {
          console.log('[Store] onStream:', { chunk: chunk?.substring(0, 30), isComplete })
          // 流式更新
          const msgs = get().messages
          const idx = msgs.findIndex(m => m.id === tempAiId)
          console.log('[Store] 流式更新 idx:', idx, 'current content:', msgs[idx]?.content?.substring(0, 30))
          if (idx >= 0) {
            const updated = [...msgs]
            updated[idx] = {
              ...updated[idx],
              content: updated[idx].content + chunk,
              isStreaming: !isComplete,
            }
            console.log('[Store] 更新后 content:', updated[idx].content?.substring(0, 50))
            set({ messages: updated })
          }
        },
        (result) => {
          console.log('[Store] onComplete 回调:', result)
          // 完成
          const msgs = get().messages
          const idx = msgs.findIndex(m => m.id === tempAiId)
          console.log('[Store] 查找消息 idx:', idx, 'messages count:', msgs.length)
          if (idx >= 0) {
            const updated = [...msgs]
            updated[idx] = {
              ...updated[idx],
              content: result.reply || '无回复',
              isStreaming: false,
              isError: !result.success,
            }
            console.log('[Store] 设置完成，content:', result.reply?.substring(0, 50))
            set({ messages: updated, isChatLoading: false })
            
            // 更新 sessionId
            if (result.sessionId && !currentSessionId) {
              set({ currentSessionId: result.sessionId })
            }
          }
        }
      )
    } catch (error) {
      // 错误处理
      const msgs = get().messages
      const idx = msgs.findIndex(m => m.id === tempAiId)
      if (idx >= 0) {
        const updated = [...msgs]
        updated[idx] = {
          ...updated[idx],
          content: '发送失败，请重试',
          isStreaming: false,
          isError: true,
        }
        set({ messages: updated, isChatLoading: false })
      }
    }
  },
  
  saveChatHistory: async () => {
    // TODO: 实现保存历史逻辑
    console.warn('saveChatHistory not implemented')
  }
}))

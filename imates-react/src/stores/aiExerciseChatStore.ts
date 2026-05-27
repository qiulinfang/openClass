import { create } from 'zustand'
import type { ChatBubble } from '../types'
import { Sender } from '../types/enums'
import { sendExerciseChatMessage } from '../services/aiChatApi'

const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

interface AiExerciseChatState {
  messages: ChatBubble[]
  isChatLoading: boolean
  currentQuestionId: string | null
  inputAttachedScreenshots: any[]
  inputScreenshotDrawingStates: Record<string, unknown>
  
  setMessages: (messages: ChatBubble[]) => void
  addMessage: (message: ChatBubble) => void
  clearMessages: () => void
  setIsChatLoading: (loading: boolean) => void
  setCurrentQuestionId: (id: string | null) => void
  setInputAttachedScreenshots: (screenshots: any[]) => void
  removeInputAttachedScreenshot: (id: string) => void
  clearInputAttachedScreenshots: () => void
  setInputScreenshotDrawingStates: (states: Record<string, unknown>) => void
  
  sendMessage: (content: string, selectedModel?: string, skipUserMessage?: boolean) => Promise<void>
  saveChatHistory: () => Promise<void>
}

export const useAiExerciseChatStore = create<AiExerciseChatState>((set, get) => ({
  messages: [],
  isChatLoading: false,
  currentQuestionId: null,
  inputAttachedScreenshots: [],
  inputScreenshotDrawingStates: {},

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  setIsChatLoading: (loading) => set({ isChatLoading: loading }),
  setCurrentQuestionId: (id) => set({ currentQuestionId: id }),
  setInputAttachedScreenshots: (screenshots) => set({ inputAttachedScreenshots: Array.isArray(screenshots) ? screenshots : [] }),
  removeInputAttachedScreenshot: (id) => set((state) => ({
    inputAttachedScreenshots: state.inputAttachedScreenshots.filter(s => s.id !== id)
  })),
  clearInputAttachedScreenshots: () => set({ inputAttachedScreenshots: [], inputScreenshotDrawingStates: {} }),
  setInputScreenshotDrawingStates: (states) => set({ inputScreenshotDrawingStates: states || {} }),
  
  sendMessage: async (content: string) => {
    const state = get()
    const questionId = state.currentQuestionId
    
    if (content) {
      const userMsg: ChatBubble = { id: generateId(), content, sender: Sender.USER, type: Sender.USER, timestamp: new Date().toISOString() }
      set({ messages: [...state.messages, userMsg] })
    }
    
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
    
    try {
      await sendExerciseChatMessage(
        content,
        questionId || '',
        undefined,
        'BIOLOGY',
        (chunk, isComplete) => {
          const msgs = get().messages
          const idx = msgs.findIndex(m => m.id === tempAiId)
          if (idx >= 0) {
            const updated = [...msgs]
            updated[idx] = { ...updated[idx], content: updated[idx].content + chunk, isStreaming: !isComplete }
            set({ messages: updated })
          }
        },
        (result) => {
          const msgs = get().messages
          const idx = msgs.findIndex(m => m.id === tempAiId)
          if (idx >= 0) {
            const updated = [...msgs]
            updated[idx] = { ...updated[idx], content: result.reply || '无回复', isStreaming: false, isError: !result.success }
            set({ messages: updated, isChatLoading: false })
          }
        }
      )
    } catch (error) {
      const msgs = get().messages
      const idx = msgs.findIndex(m => m.id === tempAiId)
      if (idx >= 0) {
        const updated = [...msgs]
        updated[idx] = { ...updated[idx], content: '发送失败', isStreaming: false, isError: true }
        set({ messages: updated, isChatLoading: false })
      }
    }
  },
  saveChatHistory: async () => { console.warn('saveChatHistory not implemented') }
}))

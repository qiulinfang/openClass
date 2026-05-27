import { create } from 'zustand'
import type { ChatBubble } from '../types'
import { Sender } from '../types/enums'

const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

interface AiTextbookChatState {
  messages: ChatBubble[]
  isChatLoading: boolean
  currentResourceId: string | null
  attachedScreenshots: any[]
  
  setMessages: (messages: ChatBubble[]) => void
  addMessage: (message: ChatBubble) => void
  clearMessages: () => void
  setIsChatLoading: (loading: boolean) => void
  setCurrentResourceId: (id: string | null) => void
  setAttachedScreenshots: (screenshots: any[]) => void
  
  sendMessage: (content: string) => Promise<void>
  saveChatHistory: () => Promise<void>
}

export const useAiTextbookChatStore = create<AiTextbookChatState>((set, get) => ({
  messages: [],
  isChatLoading: false,
  currentResourceId: null,
  attachedScreenshots: [],

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  setIsChatLoading: (loading) => set({ isChatLoading: loading }),
  setCurrentResourceId: (id) => set({ currentResourceId: id }),
  setAttachedScreenshots: (screenshots) => set({ attachedScreenshots: Array.isArray(screenshots) ? screenshots : [] }),
  
  sendMessage: async (content: string) => {
    const state = get()
    if (content) {
      const userMsg: ChatBubble = { id: generateId(), content, sender: Sender.USER, type: Sender.USER, timestamp: new Date().toISOString() }
      set({ messages: [...state.messages, userMsg] })
    }
    set({ isChatLoading: true })
    setTimeout(() => {
      const aiMsg: ChatBubble = { id: generateId(), content: `教材讲解: ${content}`, sender: Sender.AI, type: Sender.AI, timestamp: new Date().toISOString() }
      set({ messages: [...get().messages, aiMsg], isChatLoading: false })
    }, 1000)
  },
  saveChatHistory: async () => {}
}))

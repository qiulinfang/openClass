import { create } from 'zustand'
import type { ChatBubble } from '../types'
import { Sender } from '../types/enums'

const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

interface AiHomeworkChatState {
  messages: ChatBubble[]
  isChatLoading: boolean
  currentHomeworkId: string | null
  
  setMessages: (messages: ChatBubble[]) => void
  addMessage: (message: ChatBubble) => void
  clearMessages: () => void
  setIsChatLoading: (loading: boolean) => void
  setCurrentHomeworkId: (id: string | null) => void
  
  sendMessage: (content: string) => Promise<void>
  saveChatHistory: () => Promise<void>
}

export const useAiHomeworkChatStore = create<AiHomeworkChatState>((set, get) => ({
  messages: [],
  isChatLoading: false,
  currentHomeworkId: null,

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  setIsChatLoading: (loading) => set({ isChatLoading: loading }),
  setCurrentHomeworkId: (id) => set({ currentHomeworkId: id }),
  
  sendMessage: async (content: string) => {
    const state = get()
    if (content) {
      const userMsg: ChatBubble = { id: generateId(), content, sender: Sender.USER, type: Sender.USER, timestamp: new Date().toISOString() }
      set({ messages: [...state.messages, userMsg] })
    }
    set({ isChatLoading: true })
    setTimeout(() => {
      const aiMsg: ChatBubble = { id: generateId(), content: `作业辅导: ${content}`, sender: Sender.AI, type: Sender.AI, timestamp: new Date().toISOString() }
      set({ messages: [...get().messages, aiMsg], isChatLoading: false })
    }, 1000)
  },
  saveChatHistory: async () => {}
}))

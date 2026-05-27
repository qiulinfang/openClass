import { create } from 'zustand'
import type { ChatBubble } from '../types'
import { Sender } from '../types/enums'

const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

interface HtmlPreviewChatState {
  messages: ChatBubble[]
  isChatLoading: boolean
  
  setMessages: (messages: ChatBubble[]) => void
  addMessage: (message: ChatBubble) => void
  clearMessages: () => void
  setIsChatLoading: (loading: boolean) => void
  
  sendMessage: (content: string) => Promise<void>
}

export const useHtmlPreviewChatStore = create<HtmlPreviewChatState>((set, get) => ({
  messages: [],
  isChatLoading: false,

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  setIsChatLoading: (loading) => set({ isChatLoading: loading }),
  
  sendMessage: async (content: string) => {
    const state = get()
    if (content) {
      const userMsg: ChatBubble = { id: generateId(), content, sender: Sender.USER, type: Sender.USER, timestamp: new Date().toISOString() }
      set({ messages: [...state.messages, userMsg] })
    }
    set({ isChatLoading: true })
    setTimeout(() => {
      const aiMsg: ChatBubble = { id: generateId(), content: `HTML预览: ${content}`, sender: Sender.AI, type: Sender.AI, timestamp: new Date().toISOString() }
      set({ messages: [...get().messages, aiMsg], isChatLoading: false })
    }, 1000)
  }
}))

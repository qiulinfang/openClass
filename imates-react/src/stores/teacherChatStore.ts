import { create } from 'zustand'
import type { ChatBubble } from '../types'
import { Sender } from '../types/enums'

const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

interface TeacherChatState {
  messages: ChatBubble[]
  isChatLoading: boolean
  currentSessionId: string | null
  sessions: any[]
  
  setMessages: (messages: ChatBubble[]) => void
  addMessage: (message: ChatBubble) => void
  clearMessages: () => void
  setIsChatLoading: (loading: boolean) => void
  setCurrentSessionId: (id: string | null) => void
  setSessions: (sessions: any[]) => void
  
  sendMessage: (content: string) => Promise<void>
  saveChatHistory: () => Promise<void>
}

export const useTeacherChatStore = create<TeacherChatState>((set, get) => ({
  messages: [],
  isChatLoading: false,
  currentSessionId: null,
  sessions: [],

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  setIsChatLoading: (loading) => set({ isChatLoading: loading }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setSessions: (sessions) => set({ sessions }),
  
  sendMessage: async (content: string) => {
    const state = get()
    if (content) {
      const userMsg: ChatBubble = { id: generateId(), content, sender: Sender.USER, type: Sender.USER, timestamp: new Date().toISOString() }
      set({ messages: [...state.messages, userMsg] })
    }
    set({ isChatLoading: true })
    setTimeout(() => {
      const teacherMsg: ChatBubble = { id: generateId(), content: `老师回复: ${content}`, sender: Sender.TEACHER, type: Sender.TEACHER, timestamp: new Date().toISOString() }
      set({ messages: [...get().messages, teacherMsg], isChatLoading: false })
    }, 1000)
  },
  saveChatHistory: async () => { console.warn('saveChatHistory not implemented') }
}))

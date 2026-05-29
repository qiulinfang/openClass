import { create } from 'zustand'

interface UIState {
  showAIChatDialog: boolean
  showTeacherChatDialog: boolean
  showMiniClassDialog: boolean
  miniClassUrl: string
  miniClassQuestionTitle: string
  
  openAIChatDialog: () => void
  closeAIChatDialog: () => void
  openTeacherChatDialog: () => void
  closeTeacherChatDialog: () => void
  openMiniClassDialog: (url: string, questionTitle?: string) => void
  closeMiniClassDialog: () => void
}

export const useUIStore = create<UIState>((set) => ({
  showAIChatDialog: false,
  showTeacherChatDialog: false,
  showMiniClassDialog: false,
  miniClassUrl: '',
  miniClassQuestionTitle: '',
  
  openAIChatDialog: () => set({ showAIChatDialog: true }),
  closeAIChatDialog: () => set({ showAIChatDialog: false }),
  openTeacherChatDialog: () => set({ showTeacherChatDialog: true }),
  closeTeacherChatDialog: () => set({ showTeacherChatDialog: false }),
  openMiniClassDialog: (url, questionTitle) => set({
    showMiniClassDialog: true,
    miniClassUrl: url,
    miniClassQuestionTitle: questionTitle || ''
  }),
  closeMiniClassDialog: () => set({
    showMiniClassDialog: false,
    miniClassUrl: '',
    miniClassQuestionTitle: ''
  })
}))

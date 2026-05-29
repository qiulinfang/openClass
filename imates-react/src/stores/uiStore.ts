import { create } from 'zustand'

interface UIState {
  showAIChatDialog: boolean
  showTeacherChatDialog: boolean
  showMiniClassDialog: boolean
  miniClassUrl: string
  miniClassQuestionTitle: string
  
  isExerciseChatPanelVisible: boolean
  isMainChatPanelVisible: boolean
  isImagePickerVisible: boolean
  isStorageDebugPanelVisible: boolean

  openAIChatDialog: () => void
  closeAIChatDialog: () => void
  openTeacherChatDialog: () => void
  closeTeacherChatDialog: () => void
  openMiniClassDialog: (url: string, questionTitle?: string) => void
  closeMiniClassDialog: () => void

  setExerciseChatPanelVisible: (visible: boolean) => void
  setMainChatPanelVisible: (visible: boolean) => void
  setImagePickerVisible: (visible: boolean) => void
  setStorageDebugPanelVisible: (visible: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  showAIChatDialog: false,
  showTeacherChatDialog: false,
  showMiniClassDialog: false,
  miniClassUrl: '',
  miniClassQuestionTitle: '',
  isExerciseChatPanelVisible: false,
  isMainChatPanelVisible: false,
  isImagePickerVisible: false,
  isStorageDebugPanelVisible: false,
  
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
  }),
  setExerciseChatPanelVisible: (visible) => set({ isExerciseChatPanelVisible: visible }),
  setMainChatPanelVisible: (visible) => set({ isMainChatPanelVisible: visible }),
  setImagePickerVisible: (visible) => set({ isImagePickerVisible: visible }),
  setStorageDebugPanelVisible: (visible) => set({ isStorageDebugPanelVisible: visible })
}))

import { create } from 'zustand'
import {
  initDraftStorage,
  saveDraftToIndexedDB,
  loadDraftFromIndexedDB,
  deleteDraftFromIndexedDB,
  deleteDraftsFromIndexedDB,
  clearAllDraftsFromIndexedDB,
  getDraftCountFromIndexedDB,
  hasDraftInIndexedDB,
  cleanupExpiredDrafts,
  getDraftStorageInfo
} from '../services/storage/draft-storage'

/**
 * 题目草稿数据类型
 */
export interface QuestionDraft {
  questionId: string // 题目唯一标识
  objects: any[] // 画布对象数据
  history: any[][] // 历史记录
  historyIndex: number // 当前历史位置
  updatedAt: number // 最后更新时间
}

interface DraftState {
  drafts: Map<string, QuestionDraft>
  isStorageReady: boolean
  chatPanelVisible: boolean
  
  // Actions
  initStorage: () => Promise<void>
  getDraft: (questionId: string) => Promise<QuestionDraft | null>
  saveDraft: (questionId: string, data: Omit<QuestionDraft, 'questionId' | 'updatedAt'>) => Promise<void>
  deleteDraft: (questionId: string) => Promise<void>
  deleteDrafts: (questionIds: string[]) => Promise<void>
  clearAllDrafts: () => Promise<void>
  getDraftCount: () => Promise<number>
  hasDraft: (questionId: string) => Promise<boolean>
  getStorageInfo: () => Promise<{ count: number; estimatedSize: number }>
  openChatPanel: () => void
  closeChatPanel: () => void
}

export const useDraftStore = create<DraftState>((set, get) => ({
  drafts: new Map(),
  isStorageReady: false,
  chatPanelVisible: false,

  initStorage: async () => {
    if (get().isStorageReady) return

    try {
      await initDraftStorage()
      set({ isStorageReady: true })
      console.log('[DRAFT_STORE] ✅ 草稿存储初始化完成')
      cleanupExpiredDrafts(7 * 24 * 60 * 60 * 1000)
    } catch (error) {
      console.error('[DRAFT_STORE] ❌ 草稿存储初始化失败:', error)
    }
  },

  getDraft: async (questionId) => {
    const { drafts } = get()
    if (drafts.has(questionId)) {
      return drafts.get(questionId)!
    }

    const draft = await loadDraftFromIndexedDB(questionId)
    if (draft) {
      set((state) => {
        const nextDrafts = new Map(state.drafts)
        nextDrafts.set(questionId, draft)
        return { drafts: nextDrafts }
      })
    }
    return draft
  },

  saveDraft: async (questionId, data) => {
    const draft: QuestionDraft = {
      questionId,
      ...data,
      updatedAt: Date.now()
    }

    set((state) => {
      const nextDrafts = new Map(state.drafts)
      nextDrafts.set(questionId, draft)
      return { drafts: nextDrafts }
    })

    await saveDraftToIndexedDB(questionId, data)
  },

  deleteDraft: async (questionId) => {
    set((state) => {
      const nextDrafts = new Map(state.drafts)
      nextDrafts.delete(questionId)
      return { drafts: nextDrafts }
    })

    await deleteDraftFromIndexedDB(questionId)
  },

  deleteDrafts: async (questionIds) => {
    set((state) => {
      const nextDrafts = new Map(state.drafts)
      questionIds.forEach(id => nextDrafts.delete(id))
      return { drafts: nextDrafts }
    })

    await deleteDraftsFromIndexedDB(questionIds)
  },

  clearAllDrafts: async () => {
    set({ drafts: new Map() })
    await clearAllDraftsFromIndexedDB()
  },

  getDraftCount: async () => {
    return await getDraftCountFromIndexedDB()
  },

  hasDraft: async (questionId) => {
    if (get().drafts.has(questionId)) {
      return true
    }
    return await hasDraftInIndexedDB(questionId)
  },

  getStorageInfo: async () => {
    return await getDraftStorageInfo()
  },

  openChatPanel: () => set({ chatPanelVisible: true }),
  closeChatPanel: () => set({ chatPanelVisible: false }),
}))

// 自动初始化
useDraftStore.getState().initStorage()

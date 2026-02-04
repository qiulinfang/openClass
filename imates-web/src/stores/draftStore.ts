import { defineStore } from 'pinia'
import { ref } from 'vue'
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
} from '@/services/storage/draft-storage'

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

/**
 * 草稿数据存储
 * 使用 IndexedDB 替代 localStorage，支持更大的存储容量
 */
export const useDraftStore = defineStore('draft', () => {
  // 草稿数据缓存（内存中的热数据）
  const drafts = ref<Map<string, QuestionDraft>>(new Map())

  // 存储是否已初始化
  const isStorageReady = ref(false)

  // 初始化存储
  const initStorage = async () => {
    if (isStorageReady.value) return

    try {
      // 初始化 IndexedDB
      await initDraftStorage()

      // 加载所有草稿到内存缓存
      await loadAllDraftsToCache()

      isStorageReady.value = true
      console.log('[DRAFT_STORE] ✅ 草稿存储初始化完成')

      // 清理过期草稿（7天前的）
      cleanupExpiredDrafts(7 * 24 * 60 * 60 * 1000)
    } catch (error) {
      console.error('[DRAFT_STORE] ❌ 草稿存储初始化失败:', error)
    }
  }

  // 加载所有草稿到内存缓存
  const loadAllDraftsToCache = async () => {
    // 这里可以实现批量加载，但目前按需加载即可
  }

  /**
   * 获取题目的草稿数据
   */
  const getDraft = async (questionId: string): Promise<QuestionDraft | null> => {
    // 先检查内存缓存
    if (drafts.value.has(questionId)) {
      return drafts.value.get(questionId)!
    }

    // 从 IndexedDB 加载
    const draft = await loadDraftFromIndexedDB(questionId)
    if (draft) {
      drafts.value.set(questionId, draft)
    }

    return draft
  }

  /**
   * 保存题目的草稿数据
   */
  const saveDraft = async (
    questionId: string,
    data: Omit<QuestionDraft, 'questionId' | 'updatedAt'>
  ): Promise<void> => {
    const draft: QuestionDraft = {
      questionId,
      ...data,
      updatedAt: Date.now()
    }

    // 更新内存缓存
    drafts.value.set(questionId, draft)

    // 保存到 IndexedDB
    await saveDraftToIndexedDB(questionId, data)
  }

  /**
   * 删除题目的草稿数据
   */
  const deleteDraft = async (questionId: string): Promise<void> => {
    // 删除内存缓存
    drafts.value.delete(questionId)

    // 删除 IndexedDB 数据
    await deleteDraftFromIndexedDB(questionId)
  }

  /**
   * 删除多个题目的草稿数据
   */
  const deleteDrafts = async (questionIds: string[]): Promise<void> => {
    // 删除内存缓存
    questionIds.forEach(id => drafts.value.delete(id))

    // 批量删除 IndexedDB 数据
    await deleteDraftsFromIndexedDB(questionIds)
  }

  /**
   * 清空所有草稿数据
   */
  const clearAllDrafts = async (): Promise<void> => {
    // 清空内存缓存
    drafts.value.clear()

    // 清空 IndexedDB
    await clearAllDraftsFromIndexedDB()
  }

  /**
   * 获取所有草稿数量
   */
  const getDraftCount = async (): Promise<number> => {
    return await getDraftCountFromIndexedDB()
  }

  /**
   * 检查题目是否有草稿
   */
  const hasDraft = async (questionId: string): Promise<boolean> => {
    // 先检查内存缓存
    if (drafts.value.has(questionId)) {
      return true
    }

    // 检查 IndexedDB
    return await hasDraftInIndexedDB(questionId)
  }

  /**
   * 获取存储使用情况（调试用）
   */
  const getStorageInfo = async (): Promise<{ count: number; estimatedSize: number }> => {
    return await getDraftStorageInfo()
  }

  // 启动时初始化存储
  initStorage()

  return {
    drafts,
    isStorageReady,
    getDraft,
    saveDraft,
    deleteDraft,
    deleteDrafts,
    clearAllDrafts,
    getDraftCount,
    hasDraft,
    getStorageInfo,
    initStorage
  }
})

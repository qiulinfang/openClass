/**
 * 草稿数据 IndexedDB 存储服务
 * 使用 IndexedDB 替代 localStorage，支持更大的存储容量
 */

import { IndexedDBService } from './indexeddb-service'
import { STORE_NAMES, IDB_CONFIGS } from './db-config'
import type { QuestionDraft } from '@/stores/draftStore'

interface DraftStorageData {
  questionId: string
  objects: unknown[]
  history: unknown[][]
  historyIndex: number
  updatedAt: number
}

/**
 * 获取草稿存储专用的 IndexedDB 服务实例
 */
function getDraftStorage(): IndexedDBService {
  return IndexedDBService.getInstance(IDB_CONFIGS.DRAFTS_STORAGE())
}

/**
 * 初始化草稿存储数据库
 */
export async function initDraftStorage(): Promise<void> {
  const draftStorage = getDraftStorage()
  if (!draftStorage.isInitialized) {
    await draftStorage.init()
  }
}

/**
 * 保存草稿数据到 IndexedDB
 */
export async function saveDraftToIndexedDB(
  questionId: string,
  draft: Omit<QuestionDraft, 'questionId' | 'updatedAt'>
): Promise<void> {
  try {
    const draftStorage = getDraftStorage()

    const data: DraftStorageData = {
      questionId,
      objects: draft.objects,
      history: draft.history,
      historyIndex: draft.historyIndex,
      updatedAt: Date.now()
    }

    await draftStorage.put(STORE_NAMES.QUESTION_DRAFTS, data)
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 保存草稿失败:', error)
    throw error
  }
}

/**
 * 从 IndexedDB 加载草稿数据
 */
export async function loadDraftFromIndexedDB(
  questionId: string
): Promise<QuestionDraft | null> {
  try {
    const draftStorage = getDraftStorage()
    const data = await draftStorage.get<DraftStorageData>(STORE_NAMES.QUESTION_DRAFTS, questionId)

    if (!data) return null

    return {
      questionId: data.questionId,
      objects: data.objects,
      history: data.history,
      historyIndex: data.historyIndex,
      updatedAt: data.updatedAt
    }
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 加载草稿失败:', error)
    return null
  }
}

/**
 * 检查指定题目的草稿是否存在
 */
export async function hasDraftInIndexedDB(questionId: string): Promise<boolean> {
  try {
    const draftStorage = getDraftStorage()
    return await draftStorage.exists(STORE_NAMES.QUESTION_DRAFTS, questionId)
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 检查草稿是否存在失败:', error)
    return false
  }
}

/**
 * 删除指定题目的草稿
 */
export async function deleteDraftFromIndexedDB(questionId: string): Promise<void> {
  try {
    const draftStorage = getDraftStorage()
    await draftStorage.delete(STORE_NAMES.QUESTION_DRAFTS, questionId)
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 删除草稿失败:', error)
    throw error
  }
}

/**
 * 删除多个题目的草稿
 */
export async function deleteDraftsFromIndexedDB(questionIds: string[]): Promise<void> {
  try {
    const draftStorage = getDraftStorage()
    for (const questionId of questionIds) {
      await draftStorage.delete(STORE_NAMES.QUESTION_DRAFTS, questionId)
    }
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 批量删除草稿失败:', error)
    throw error
  }
}

/**
 * 清空所有草稿
 */
export async function clearAllDraftsFromIndexedDB(): Promise<void> {
  try {
    const draftStorage = getDraftStorage()
    await draftStorage.clear(STORE_NAMES.QUESTION_DRAFTS)
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 清空所有草稿失败:', error)
    throw error
  }
}

/**
 * 获取所有草稿数量
 */
export async function getDraftCountFromIndexedDB(): Promise<number> {
  try {
    const draftStorage = getDraftStorage()
    return await draftStorage.count(STORE_NAMES.QUESTION_DRAFTS)
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 获取草稿数量失败:', error)
    return 0
  }
}

/**
 * 获取所有草稿的题目ID列表
 */
export async function getAllDraftIdsFromIndexedDB(): Promise<string[]> {
  try {
    const draftStorage = getDraftStorage()
    const allDrafts = await draftStorage.getAll<DraftStorageData>(STORE_NAMES.QUESTION_DRAFTS)
    return allDrafts.map(draft => draft.questionId)
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 获取所有草稿ID失败:', error)
    return []
  }
}

/**
 * 清理过期草稿
 */
export async function cleanupExpiredDrafts(
  maxAge: number = 7 * 24 * 60 * 60 * 1000
): Promise<number> {
  try {
    const draftStorage = getDraftStorage()
    const allDrafts = await draftStorage.getAll<DraftStorageData>(STORE_NAMES.QUESTION_DRAFTS)
    const now = Date.now()
    let deletedCount = 0

    for (const draft of allDrafts) {
      if (now - draft.updatedAt > maxAge) {
        await draftStorage.delete(STORE_NAMES.QUESTION_DRAFTS, draft.questionId)
        deletedCount++
      }
    }

    return deletedCount
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 清理过期草稿失败:', error)
    return 0
  }
}

/**
 * 获取存储使用情况
 */
export async function getDraftStorageInfo(): Promise<{
  count: number
  estimatedSize: number
}> {
  try {
    const draftStorage = getDraftStorage()
    const allDrafts = await draftStorage.getAll<DraftStorageData>(STORE_NAMES.QUESTION_DRAFTS)
    let estimatedSize = 0
    for (const draft of allDrafts) {
      estimatedSize += JSON.stringify(draft).length
    }
    return { count: allDrafts.length, estimatedSize }
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 获取存储信息失败:', error)
    return { count: 0, estimatedSize: 0 }
  }
}

/**
 * 从 localStorage 迁移数据到 IndexedDB
 */
export async function migrateDraftsFromLocalStorage(): Promise<number> {
  const STORAGE_KEY = 'exercise_drafts'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return 0

    const draftsMap: Record<string, DraftStorageData> = JSON.parse(saved)
    if (!draftsMap || Object.keys(draftsMap).length === 0) return 0

    const draftStorage = getDraftStorage()
    let migratedCount = 0
    for (const [questionId, draftData] of Object.entries(draftsMap)) {
      try {
        const normalizedDraft: DraftStorageData = {
          questionId: draftData.questionId || questionId,
          objects: draftData.objects || [],
          history: draftData.history || [],
          historyIndex: draftData.historyIndex ?? -1,
          updatedAt: draftData.updatedAt || Date.now()
        }
        await draftStorage.put(STORE_NAMES.QUESTION_DRAFTS, normalizedDraft)
        migratedCount++
      } catch (error) {
        console.error(`[DRAFT_STORAGE] ❌ 迁移草稿失败: ${questionId}`, error)
      }
    }
    localStorage.removeItem(STORAGE_KEY)
    return migratedCount
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 迁移草稿失败:', error)
    return 0
  }
}

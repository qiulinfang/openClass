/**
 * 草稿数据 IndexedDB 存储服务
 * 使用 IndexedDB 替代 localStorage，支持更大的存储容量
 */

import { IndexedDBService } from './indexeddb-service'
import { getUserId } from '../http/auth-service'
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
 * 使用用户ID作为数据库名前缀，实现账号隔离
 */
function getDraftStorage(): IndexedDBService {
  const userId = getUserId()
  const dbName = `ExerciseDraftsDB_${userId}`
  return IndexedDBService.getInstance({
    dbName: dbName,
    version: 1,
    stores: [
      {
        name: 'question_drafts',
        keyPath: 'questionId',
        indexes: [
          { name: 'updatedAt', keyPath: 'updatedAt' }
        ]
      }
    ]
  })
}

// 初始化 Promise 缓存，避免重复初始化
const initPromises: Map<string, Promise<void>> = new Map()

/**
 * 初始化草稿存储数据库
 */
export async function initDraftStorage(): Promise<void> {
  const userId = getUserId()
  const draftStorage = getDraftStorage()

  // 如果已经初始化，直接返回
  if (draftStorage.isInitialized) {
    return
  }

  // 如果正在初始化，返回同一个 Promise
  const existingPromise = initPromises.get(userId)
  if (existingPromise) {
    return existingPromise
  }

  // 开始初始化
  const initPromise = (async () => {
    try {
      await draftStorage.init()
    } catch (error) {
      console.error(`[DRAFT_STORAGE] ❌ IndexedDB 初始化失败 (用户: ${userId}):`, error)
      throw error
    } finally {
      initPromises.delete(userId)
    }
  })()

  initPromises.set(userId, initPromise)
  return initPromise
}

/**
 * 保存草稿数据到 IndexedDB
 * @param questionId 题目ID
 * @param draft 草稿数据
 */
export async function saveDraftToIndexedDB(
  questionId: string,
  draft: Omit<QuestionDraft, 'questionId' | 'updatedAt'>
): Promise<void> {
  try {
    await initDraftStorage()
    const draftStorage = getDraftStorage()

    const data: DraftStorageData = {
      questionId,
      objects: draft.objects,
      history: draft.history,
      historyIndex: draft.historyIndex,
      updatedAt: Date.now()
    }

    await draftStorage.put('question_drafts', data)
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 保存草稿到 IndexedDB 失败:', error)
    throw error
  }
}

/**
 * 从 IndexedDB 加载草稿数据
 * @param questionId 题目ID
 * @returns 草稿数据，如果没有数据则返回 null
 */
export async function loadDraftFromIndexedDB(
  questionId: string
): Promise<QuestionDraft | null> {
  try {
    await initDraftStorage()
    const draftStorage = getDraftStorage()

    const data = await draftStorage.get<DraftStorageData>('question_drafts', questionId)

    if (!data) {
      return null
    }

    return {
      questionId: data.questionId,
      objects: data.objects,
      history: data.history,
      historyIndex: data.historyIndex,
      updatedAt: data.updatedAt
    }
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 从 IndexedDB 加载草稿失败:', error)
    return null
  }
}

/**
 * 检查指定题目的草稿是否存在
 * @param questionId 题目ID
 * @returns 是否存在
 */
export async function hasDraftInIndexedDB(questionId: string): Promise<boolean> {
  try {
    await initDraftStorage()
    const draftStorage = getDraftStorage()
    return await draftStorage.exists('question_drafts', questionId)
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 检查草稿是否存在失败:', error)
    return false
  }
}

/**
 * 删除指定题目的草稿
 * @param questionId 题目ID
 */
export async function deleteDraftFromIndexedDB(questionId: string): Promise<void> {
  try {
    await initDraftStorage()
    const draftStorage = getDraftStorage()
    await draftStorage.delete('question_drafts', questionId)
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 删除草稿失败:', error)
    throw error
  }
}

/**
 * 删除多个题目的草稿
 * @param questionIds 题目ID数组
 */
export async function deleteDraftsFromIndexedDB(questionIds: string[]): Promise<void> {
  try {
    await initDraftStorage()
    const draftStorage = getDraftStorage()

    for (const questionId of questionIds) {
      await draftStorage.delete('question_drafts', questionId)
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
    await initDraftStorage()
    const draftStorage = getDraftStorage()
    await draftStorage.clear('question_drafts')
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 清空所有草稿失败:', error)
    throw error
  }
}

/**
 * 获取所有草稿数量
 * @returns 草稿数量
 */
export async function getDraftCountFromIndexedDB(): Promise<number> {
  try {
    await initDraftStorage()
    const draftStorage = getDraftStorage()
    return await draftStorage.count('question_drafts')
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 获取草稿数量失败:', error)
    return 0
  }
}

/**
 * 获取所有草稿的题目ID列表
 * @returns 题目ID列表
 */
export async function getAllDraftIdsFromIndexedDB(): Promise<string[]> {
  try {
    await initDraftStorage()
    const draftStorage = getDraftStorage()
    const allDrafts = await draftStorage.getAll<DraftStorageData>('question_drafts')
    return allDrafts.map(draft => draft.questionId)
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 获取所有草稿ID失败:', error)
    return []
  }
}

/**
 * 清理过期草稿
 * @param maxAge 最大保存时间（毫秒），默认7天
 * @return 删除的草稿数量
 */
export async function cleanupExpiredDrafts(
  maxAge: number = 7 * 24 * 60 * 60 * 1000
): Promise<number> {
  try {
    await initDraftStorage()
    const draftStorage = getDraftStorage()

    const allDrafts = await draftStorage.getAll<DraftStorageData>('question_drafts')
    const now = Date.now()
    let deletedCount = 0

    for (const draft of allDrafts) {
      if (now - draft.updatedAt > maxAge) {
        await draftStorage.delete('question_drafts', draft.questionId)
        deletedCount++
      }
    }

    if (deletedCount > 0) {
      console.log(`[DRAFT_STORAGE] 🧹 清理了 ${deletedCount} 个过期草稿`)
    }

    return deletedCount
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 清理过期草稿失败:', error)
    return 0
  }
}

/**
 * 获取存储使用情况
 * @returns 存储信息
 */
export async function getDraftStorageInfo(): Promise<{
  count: number
  estimatedSize: number
}> {
  try {
    await initDraftStorage()
    const draftStorage = getDraftStorage()

    const allDrafts = await draftStorage.getAll<DraftStorageData>('question_drafts')

    // 估算存储大小
    let estimatedSize = 0
    for (const draft of allDrafts) {
      estimatedSize += JSON.stringify(draft).length
    }

    return {
      count: allDrafts.length,
      estimatedSize
    }
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 获取存储信息失败:', error)
    return { count: 0, estimatedSize: 0 }
  }
}

/**
 * 从 localStorage 迁移数据到 IndexedDB
 * 迁移后清除 localStorage 中的数据
 * @returns 迁移的草稿数量
 */
export async function migrateDraftsFromLocalStorage(): Promise<number> {
  const STORAGE_KEY = 'exercise_drafts'

  try {
    // 读取 localStorage 数据
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      console.log('[DRAFT_STORAGE] 📦 无需迁移，localStorage 中没有草稿数据')
      return 0
    }

    const data = JSON.parse(saved)
    const draftsMap: Record<string, DraftStorageData> = data

    if (!draftsMap || Object.keys(draftsMap).length === 0) {
      console.log('[DRAFT_STORAGE] 📦 无需迁移，草稿数据为空')
      return 0
    }

    // 确保 IndexedDB 已初始化
    await initDraftStorage()
    const draftStorage = getDraftStorage()

    // 逐条迁移数据
    let migratedCount = 0
    for (const [questionId, draftData] of Object.entries(draftsMap)) {
      try {
        // 确保数据结构正确
        const normalizedDraft: DraftStorageData = {
          questionId: draftData.questionId || questionId,
          objects: draftData.objects || [],
          history: draftData.history || [],
          historyIndex: draftData.historyIndex ?? -1,
          updatedAt: draftData.updatedAt || Date.now()
        }

        await draftStorage.put('question_drafts', normalizedDraft)
        migratedCount++
      } catch (error) {
        console.error(`[DRAFT_STORAGE] ❌ 迁移草稿失败: ${questionId}`, error)
      }
    }

    // 迁移完成后清除 localStorage
    localStorage.removeItem(STORAGE_KEY)
    console.log(`[DRAFT_STORAGE] ✅ 成功迁移 ${migratedCount} 个草稿到 IndexedDB`)

    return migratedCount
  } catch (error) {
    console.error('[DRAFT_STORAGE] ❌ 迁移草稿数据失败:', error)
    return 0
  }
}

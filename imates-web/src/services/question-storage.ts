/**
 * 题目列表 IndexedDB 存储服务
 * 使用 IndexedDB 替代 localStorage，支持更大的存储容量
 */

import { IndexedDBService } from './indexeddb-service'
import { getCurrentUserIdOrDefault } from '../utils/user/userId'
import type { ExerciseItem } from '../types'

interface QuestionListData {
  subject: string
  questions: ExerciseItem[]
  timestamp: number
}

/**
 * 获取题目列表专用的 IndexedDB 服务实例
 * 使用用户ID作为数据库名前缀，实现账号隔离
 */
function getQuestionStorage(): IndexedDBService {
  const userId = getCurrentUserIdOrDefault()
  const dbName = `ExerciseQuestionsDB_${userId}`
  return IndexedDBService.getInstance({
    dbName: dbName,
    version: 1,
    stores: [
      {
        name: 'question_lists',
        keyPath: 'subject', // 使用 subject 作为主键，每个科目一条记录
        indexes: [
          { name: 'timestamp', keyPath: 'timestamp' },
          { name: 'subject', keyPath: 'subject', unique: true }
        ]
      }
    ]
  })
}

/**
 * 初始化数据库（带缓存，避免重复初始化）
 * 注意：每次调用都会获取当前用户的存储实例，确保账号隔离
 */
const initPromises: Map<string, Promise<void>> = new Map()
export async function initQuestionStorage(): Promise<void> {
  const userId = getCurrentUserIdOrDefault()
  const questionStorage = getQuestionStorage()
  
  // 如果已经初始化，直接返回
  if (questionStorage.isInitialized) {
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
      await questionStorage.init()
    } catch (error) {
      console.error(`[QUESTION_STORAGE] ❌ IndexedDB 初始化失败 (用户: ${userId}):`, error)
      throw error
    } finally {
      initPromises.delete(userId)
    }
  })()
  
  initPromises.set(userId, initPromise)
  return initPromise
}

/**
 * 保存题目列表到 IndexedDB
 * @param subject 科目类型（math 或 biology）
 * @param questions 题目列表
 */
export async function saveQuestionsToIndexedDB(
  subject: string,
  questions: ExerciseItem[]
): Promise<void> {
  try {
    await initQuestionStorage()
    const questionStorage = getQuestionStorage()
    
    const data: QuestionListData = {
      subject,
      questions,
      timestamp: Date.now()
    }
    
    await questionStorage.put('question_lists', data)
  } catch (error) {
    console.error('[QUESTION_STORAGE] ❌ 保存题目列表到 IndexedDB 失败:', error)
    throw error
  }
}

/**
 * 从 IndexedDB 加载题目列表
 * @param subject 科目类型（math 或 biology）
 * @returns 题目列表，如果没有数据则返回 null
 */
export async function loadQuestionsFromIndexedDB(
  subject: string
): Promise<ExerciseItem[] | null> {
  const loadStartTime = performance.now()
  try {
    await initQuestionStorage()
    const questionStorage = getQuestionStorage()
    
    const data = await questionStorage.get<QuestionListData>('question_lists', subject)
    
    if (!data || !data.questions || !Array.isArray(data.questions)) {
      return null
    }
    
    // 检查科目是否匹配
    if (data.subject !== subject) {
      const loadDuration = performance.now() - loadStartTime
      console.warn(`[QUESTION_STORAGE] ⚠️ 科目不匹配 (耗时: ${loadDuration.toFixed(2)}ms):`, {
        stored: data.subject,
        requested: subject
      })
      return null
    }
    
    return data.questions
  } catch (error) {
    const loadDuration = performance.now() - loadStartTime
    console.error(`[QUESTION_STORAGE] ❌ 从 IndexedDB 加载题目列表失败 (耗时: ${loadDuration.toFixed(2)}ms):`, error)
    return null
  }
}

/**
 * 检查指定科目的题目列表是否存在
 * @param subject 科目类型
 * @returns 是否存在
 */
export async function hasQuestionsInIndexedDB(subject: string): Promise<boolean> {
  try {
    await initQuestionStorage()
    const questionStorage = getQuestionStorage()
    const data = await questionStorage.get<QuestionListData>('question_lists', subject)
    return data !== undefined && data !== null
  } catch (error) {
    console.error('[QUESTION_STORAGE] ❌ 检查题目列表是否存在失败:', error)
    return false
  }
}

/**
 * 删除指定科目的题目列表
 * @param subject 科目类型
 */
export async function deleteQuestionsFromIndexedDB(subject: string): Promise<void> {
  try {
    await initQuestionStorage()
    const questionStorage = getQuestionStorage()
    await questionStorage.delete('question_lists', subject)
  } catch (error) {
    console.error('[QUESTION_STORAGE] ❌ 删除题目列表失败:', error)
    throw error
  }
}

/**
 * 清空所有题目列表
 */
export async function clearAllQuestionsFromIndexedDB(): Promise<void> {
  try {
    await initQuestionStorage()
    const questionStorage = getQuestionStorage()
    await questionStorage.clear('question_lists')
  } catch (error) {
    console.error('[QUESTION_STORAGE] ❌ 清空题目列表失败:', error)
    throw error
  }
}


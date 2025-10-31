/**
 * 题目列表 IndexedDB 存储服务
 * 使用 IndexedDB 替代 localStorage，支持更大的存储容量
 */

import { IndexedDBService } from './indexeddb-service'
import type { ExerciseItem } from '../types'

interface QuestionListData {
  subject: string
  questions: ExerciseItem[]
  timestamp: number
}

// 创建题目列表专用的 IndexedDB 服务实例
const questionStorage = IndexedDBService.getInstance({
  dbName: 'ExerciseQuestionsDB',
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

/**
 * 初始化数据库（带缓存，避免重复初始化）
 */
let initPromise: Promise<void> | null = null
export async function initQuestionStorage(): Promise<void> {
  // 如果已经初始化，直接返回
  if (questionStorage.isInitialized) {
    return
  }
  
  // 如果正在初始化，返回同一个 Promise
  if (initPromise) {
    return initPromise
  }
  
  // 开始初始化
  initPromise = (async () => {
    const initStartTime = performance.now()
    try {
      await questionStorage.init()
      const initDuration = performance.now() - initStartTime
      console.log(`[QUESTION_STORAGE] ✅ IndexedDB 初始化成功 (耗时: ${initDuration.toFixed(2)}ms)`)
    } catch (error) {
      console.error('[QUESTION_STORAGE] ❌ IndexedDB 初始化失败:', error)
      throw error
    } finally {
      initPromise = null
    }
  })()
  
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
    
    const data: QuestionListData = {
      subject,
      questions,
      timestamp: Date.now()
    }
    
    await questionStorage.put('question_lists', data)
    console.log('[QUESTION_STORAGE] ✅ 题目列表已保存到 IndexedDB:', {
      subject,
      count: questions.length
    })
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
    
    const getStartTime = performance.now()
    const data = await questionStorage.get<QuestionListData>('question_lists', subject)
    const getDuration = performance.now() - getStartTime
    
    if (!data || !data.questions || !Array.isArray(data.questions)) {
      const loadDuration = performance.now() - loadStartTime
      console.log(`[QUESTION_STORAGE] 📭 IndexedDB 中没有题目列表: ${subject} (耗时: ${loadDuration.toFixed(2)}ms)`)
      return null
    }
    
    // 检查科目是否匹配
    if (data.subject !== subject) {
      const loadDuration = performance.now() - loadStartTime
      console.log(`[QUESTION_STORAGE] 📭 IndexedDB 中的科目不匹配 (耗时: ${loadDuration.toFixed(2)}ms):`, {
        stored: data.subject,
        requested: subject
      })
      return null
    }
    
    const loadDuration = performance.now() - loadStartTime
    console.log(`[QUESTION_STORAGE] ✅ 从 IndexedDB 加载题目列表 (耗时: ${loadDuration.toFixed(2)}ms, get: ${getDuration.toFixed(2)}ms):`, {
      subject,
      count: data.questions.length,
      timestamp: new Date(data.timestamp).toLocaleString()
    })
    
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
    await questionStorage.delete('question_lists', subject)
    console.log('[QUESTION_STORAGE] ✅ 已删除题目列表:', subject)
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
    await questionStorage.clear('question_lists')
    console.log('[QUESTION_STORAGE] ✅ 已清空所有题目列表')
  } catch (error) {
    console.error('[QUESTION_STORAGE] ❌ 清空题目列表失败:', error)
    throw error
  }
}


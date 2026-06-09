/**
 * 题目列表 IndexedDB 存储服务
 * 使用 IndexedDB 替代 localStorage，支持更大的存储容量
 */

import { IndexedDBService } from './indexeddb-service'
import type { ExerciseItem } from '@/types'
import { STORE_NAMES, IDB_CONFIGS } from './db-config'

interface QuestionListData {
  subject: string
  questions: ExerciseItem[]
  timestamp: number
}

/**
 * 获取题目列表专用的 IndexedDB 服务实例
 */
function getQuestionStorage(): IndexedDBService {
  return IndexedDBService.getInstance(IDB_CONFIGS.QUESTION_LISTS())
}

/**
 * 初始化数据库
 */
export async function initQuestionStorage(): Promise<void> {
  const questionStorage = getQuestionStorage()
  if (!questionStorage.isInitialized) {
    await questionStorage.init()
  }
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
    const questionStorage = getQuestionStorage()
    
    const data: QuestionListData = {
      subject,
      questions,
      timestamp: Date.now()
    }
    
    await questionStorage.put(STORE_NAMES.QUESTION_LISTS, data)
  } catch (error) {
    console.error('[QUESTION_STORAGE] ❌ 保存题目列表失败:', error)
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
  try {
    const questionStorage = getQuestionStorage()
    const data = await questionStorage.get<QuestionListData>(STORE_NAMES.QUESTION_LISTS, subject)
    
    if (!data || !data.questions || !Array.isArray(data.questions)) {
      return null
    }
    
    return data.questions
  } catch (error) {
    console.error(`[QUESTION_STORAGE] ❌ 加载题目列表失败:`, error)
    return null
  }
}

/**
 * 检查指定科目的题目列表是否存在
 */
export async function hasQuestionsInIndexedDB(subject: string): Promise<boolean> {
  try {
    const questionStorage = getQuestionStorage()
    const data = await questionStorage.get<QuestionListData>(STORE_NAMES.QUESTION_LISTS, subject)
    return !!data
  } catch (error) {
    console.error('[QUESTION_STORAGE] ❌ 检查题目列表是否存在失败:', error)
    return false
  }
}

/**
 * 删除指定科目的题目列表
 */
export async function deleteQuestionsFromIndexedDB(subject: string): Promise<void> {
  try {
    const questionStorage = getQuestionStorage()
    await questionStorage.delete(STORE_NAMES.QUESTION_LISTS, subject)
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
    const questionStorage = getQuestionStorage()
    await questionStorage.clear(STORE_NAMES.QUESTION_LISTS)
  } catch (error) {
    console.error('[QUESTION_STORAGE] ❌ 清空题目列表失败:', error)
    throw error
  }
}


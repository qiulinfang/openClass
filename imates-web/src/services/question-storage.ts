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
 * 初始化数据库
 */
export async function initQuestionStorage(): Promise<void> {
  try {
    await questionStorage.init()
    console.log('[QUESTION_STORAGE] ✅ IndexedDB 初始化成功')
  } catch (error) {
    console.error('[QUESTION_STORAGE] ❌ IndexedDB 初始化失败:', error)
    throw error
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
  try {
    await initQuestionStorage()
    
    const data = await questionStorage.get<QuestionListData>('question_lists', subject)
    
    if (!data || !data.questions || !Array.isArray(data.questions)) {
      console.log('[QUESTION_STORAGE] 📭 IndexedDB 中没有题目列表:', subject)
      return null
    }
    
    // 检查科目是否匹配
    if (data.subject !== subject) {
      console.log('[QUESTION_STORAGE] 📭 IndexedDB 中的科目不匹配:', {
        stored: data.subject,
        requested: subject
      })
      return null
    }
    
    console.log('[QUESTION_STORAGE] ✅ 从 IndexedDB 加载题目列表:', {
      subject,
      count: data.questions.length,
      timestamp: new Date(data.timestamp).toLocaleString()
    })
    
    return data.questions
  } catch (error) {
    console.error('[QUESTION_STORAGE] ❌ 从 IndexedDB 加载题目列表失败:', error)
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


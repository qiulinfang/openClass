/**
 * 作业作答数据 IndexedDB 存储服务
 * 用于存储已提交作业的作答内容、画板数据和提交状态
 */

import { IndexedDBService } from './indexeddb-service'
import { STORE_NAMES, IDB_CONFIGS } from './db-config'

/** 
 * 单个作业的存储数据结构 
 */
export interface HomeworkSubmissionData {
  homeworkId: string
  homeworkName: string
  isSubmitted: boolean
  answerDataCache: Record<string, unknown> // key 是题目 ID，value 是作答数据
  questions: unknown[] // 作业包含的所有题目详情
  timestamp: number
}

/**
 * 获取作业存储专用的 IndexedDB 服务实例
 */
function getHomeworkStorage(): IndexedDBService {
  return IndexedDBService.getInstance(IDB_CONFIGS.HOMEWORK_SUBMISSION())
}

/**
 * 初始化作业存储
 */
export async function initHomeworkStorage(): Promise<void> {
  const homeworkStorage = getHomeworkStorage()
  if (!homeworkStorage.isInitialized) {
    await homeworkStorage.init()
  }
}

/**
 * 保存作业作答/提交数据到 IndexedDB
 */
export async function saveHomeworkSubmission(data: Omit<HomeworkSubmissionData, 'timestamp'>): Promise<void> {
  try {
    const homeworkStorage = getHomeworkStorage()
    
    const submission: HomeworkSubmissionData = {
      ...data,
      timestamp: Date.now()
    }
    
    await homeworkStorage.put(STORE_NAMES.SUBMISSIONS, submission)
  } catch (error) {
    console.error(`[HOMEWORK_STORAGE] ❌ 保存作业数据失败: ${data.homeworkId}`, error)
    throw error
  }
}

/**
 * 从 IndexedDB 加载作业作答/提交数据
 */
export async function loadHomeworkSubmission(homeworkId: string): Promise<HomeworkSubmissionData | null> {
  try {
    const homeworkStorage = getHomeworkStorage()
    const data = await homeworkStorage.get<HomeworkSubmissionData>(STORE_NAMES.SUBMISSIONS, homeworkId)
    return data || null
  } catch (error) {
    console.error(`[HOMEWORK_STORAGE] ❌ 加载作业数据失败 (ID: ${homeworkId}):`, error)
    return null
  }
}

/**
 * 删除指定作业的数据
 */
export async function deleteHomeworkSubmission(homeworkId: string): Promise<void> {
  try {
    const homeworkStorage = getHomeworkStorage()
    await homeworkStorage.delete(STORE_NAMES.SUBMISSIONS, homeworkId)
  } catch (error) {
    console.error(`[HOMEWORK_STORAGE] ❌ 删除作业数据失败 (ID: ${homeworkId}):`, error)
    throw error
  }
}

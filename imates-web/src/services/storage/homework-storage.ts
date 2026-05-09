/**
 * 作业作答数据 IndexedDB 存储服务
 * 用于存储已提交作业的作答内容、画板数据和提交状态
 */

import { IndexedDBService } from './indexeddb-service'
import { getUserId } from '../http/auth-service'

/** 
 * 单个作业的存储数据结构 
 */
export interface HomeworkSubmissionData {
  homeworkId: string
  homeworkName: string
  isSubmitted: boolean
  answerDataCache: Record<string, any> // key 是题目 ID，value 是作答数据
  questions: any[] // 作业包含的所有题目详情
  timestamp: number
}

/**
 * 获取作业存储专用的 IndexedDB 服务实例
 */
function getHomeworkStorage(): IndexedDBService {
  const userId = getUserId()
  const dbName = `HomeworkStorageDB_${userId}`
  return IndexedDBService.getInstance({
    dbName: dbName,
    version: 1,
    stores: [
      {
        name: 'submissions',
        keyPath: 'homeworkId',
        indexes: [
          { name: 'homeworkId', keyPath: 'homeworkId', unique: true },
          { name: 'timestamp', keyPath: 'timestamp' }
        ]
      }
    ]
  })
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
    await initHomeworkStorage()
    const homeworkStorage = getHomeworkStorage()
    
    const submission: HomeworkSubmissionData = {
      ...data,
      timestamp: Date.now()
    }
    
    // 使用 put 操作，如果存在则更新，不存在则创建
    await homeworkStorage.put('submissions', submission)
    console.log(`[HOMEWORK_STORAGE] ✅ 已保存作业数据: ${data.homeworkId}`)
  } catch (error) {
    console.error('[HOMEWORK_STORAGE] ❌ 保存作业数据失败:', error)
    throw error
  }
}

/**
 * 从 IndexedDB 加载作业作答/提交数据
 */
export async function loadHomeworkSubmission(homeworkId: string): Promise<HomeworkSubmissionData | null> {
  try {
    await initHomeworkStorage()
    const homeworkStorage = getHomeworkStorage()
    
    const data = await homeworkStorage.get<HomeworkSubmissionData>('submissions', homeworkId)
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
    await initHomeworkStorage()
    const homeworkStorage = getHomeworkStorage()
    await homeworkStorage.delete('submissions', homeworkId)
  } catch (error) {
    console.error(`[HOMEWORK_STORAGE] ❌ 删除作业数据失败 (ID: ${homeworkId}):`, error)
    throw error
  }
}

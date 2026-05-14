/**
 * 错题本 IndexedDB 存储服务
 * 用于存储学生收藏的错题，包含原始作答和题目详情
 */

import { IndexedDBService } from './indexeddb-service'
import { getUserId } from '../http/auth-service'
import type { ExerciseItem } from '@/types'

/** 
 * 单个错题的存储数据结构 
 */
export interface MistakeItem {
  id: string // 唯一标识，通常是 bmNo 或 bmNo + homeworkId
  bmNo: string
  homeworkId?: string
  homeworkName?: string
  originalAnswer?: any // 原始作答数据 (chooseList, judgmentValue, boardData 等)
  questionData: ExerciseItem // 题目详情 (题干、标准答案、解析等)
  timestamp: number
}

/**
 * 获取错题存储专用的 IndexedDB 服务实例
 */
function getMistakeStorage(): IndexedDBService {
  const userId = getUserId()
  const dbName = `MistakeStorageDB_${userId}`
  return IndexedDBService.getInstance({
    dbName: dbName,
    version: 1,
    stores: [
      {
        name: 'mistakes',
        keyPath: 'id',
        indexes: [
          { name: 'bmNo', keyPath: 'bmNo' },
          { name: 'homeworkId', keyPath: 'homeworkId' },
          { name: 'timestamp', keyPath: 'timestamp' }
        ]
      }
    ]
  })
}

/**
 * 初始化错题存储
 */
export async function initMistakeStorage(): Promise<void> {
  const mistakeStorage = getMistakeStorage()
  if (!mistakeStorage.isInitialized) {
    await mistakeStorage.init()
  }
}

/**
 * 添加错题到错题本
 */
export async function addMistake(item: Omit<MistakeItem, 'timestamp'>): Promise<void> {
  try {
    await initMistakeStorage()
    const mistakeStorage = getMistakeStorage()
    
    const mistake: MistakeItem = {
      ...item,
      timestamp: Date.now()
    }
    
    await mistakeStorage.put('mistakes', mistake)
    console.log(`[MISTAKE_STORAGE] ✅ 已添加错题: ${item.bmNo}`)
  } catch (error) {
    console.error('[MISTAKE_STORAGE] ❌ 添加错题失败:', error)
    throw error
  }
}

/**
 * 获取所有错题
 */
export async function getAllMistakes(): Promise<MistakeItem[]> {
  try {
    await initMistakeStorage()
    const mistakeStorage = getMistakeStorage()
    const mistakes = await mistakeStorage.getAll<MistakeItem>('mistakes')
    // 按时间倒序排序
    return mistakes.sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.error('[MISTAKE_STORAGE] ❌ 获取错题列表失败:', error)
    return []
  }
}

/**
 * 根据 bmNo 检查题目是否为错题
 */
export async function isMistake(bmNo: string): Promise<boolean> {
  try {
    await initMistakeStorage()
    const mistakeStorage = getMistakeStorage()
    const result = await mistakeStorage.get('mistakes', bmNo)
    return !!result
  } catch (error) {
    console.error(`[MISTAKE_STORAGE] ❌ 检查错题状态失败 (bmNo: ${bmNo}):`, error)
    return false
  }
}

/**
 * 删除错题
 */
export async function deleteMistake(id: string): Promise<void> {
  try {
    await initMistakeStorage()
    const mistakeStorage = getMistakeStorage()
    await mistakeStorage.delete('mistakes', id)
  } catch (error) {
    console.error(`[MISTAKE_STORAGE] ❌ 删除错题失败 (ID: ${id}):`, error)
    throw error
  }
}

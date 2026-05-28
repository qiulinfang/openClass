/**
 * 错题本 IndexedDB 存储服务
 * 用于存储学生收藏的错题，包含原始作答和题目详情
 */

import { IndexedDBService } from './indexeddb-service'
import { getUserId } from '../http/auth-service'
import type { ExerciseItem } from '@/types'

/** 
 * 单个练习记录
 */
export interface PracticeRecord {
  timestamp: number
  originalAnswer: any
  homeworkId?: string
  homeworkName?: string
}

/** 
 * 单个错题的存储数据结构 
 */
export interface MistakeItem {
  id: string // 唯一标识，通常是 bmNo
  bmNo: string
  questionData: ExerciseItem // 题目详情 (题干、标准答案、解析等)
  timestamp: number // 第一次加入的时间
  lastPracticeTime: number // 最后一次练习的时间
  practiceHistory: PracticeRecord[] // 练习历史
}

/**
 * 获取错题存储专用的 IndexedDB 服务实例
 */
function getMistakeStorage(): IndexedDBService {
  const userId = getUserId()
  const dbName = `MistakeStorageDB_${userId}`
  return IndexedDBService.getInstance({
    dbName: dbName,
    version: 2, // 升级版本以支持新结构
    stores: [
      {
        name: 'mistakes',
        keyPath: 'bmNo', // 使用 bmNo 作为主键，方便更新
        indexes: [
          { name: 'timestamp', keyPath: 'timestamp' },
          { name: 'lastPracticeTime', keyPath: 'lastPracticeTime' }
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
 * 添加或更新错题记录
 */
export async function addMistake(params: {
  bmNo: string
  questionData: ExerciseItem
  originalAnswer?: any
  homeworkId?: string
  homeworkName?: string
}): Promise<void> {
  try {
    await initMistakeStorage()
    const mistakeStorage = getMistakeStorage()
    
    // 1. 尝试获取现有记录
    const existing = await mistakeStorage.get<MistakeItem>('mistakes', params.bmNo)
    
    const newRecord: PracticeRecord = {
      timestamp: Date.now(),
      originalAnswer: params.originalAnswer,
      homeworkId: params.homeworkId,
      homeworkName: params.homeworkName
    }
    
    if (existing) {
      // 2. 如果已存在，追加练习历史
      const updated: MistakeItem = {
        ...existing,
        questionData: params.questionData, // 更新题目信息
        lastPracticeTime: Date.now(),
        practiceHistory: [newRecord, ...existing.practiceHistory].slice(0, 10) // 保留最近10次
      }
      await mistakeStorage.put('mistakes', updated)
    } else {
      // 3. 如果不存在，创建新记录
      const newItem: MistakeItem = {
        id: params.bmNo,
        bmNo: params.bmNo,
        questionData: params.questionData,
        timestamp: Date.now(),
        lastPracticeTime: Date.now(),
        practiceHistory: [newRecord]
      }
      await mistakeStorage.put('mistakes', newItem)
    }
    
    console.log(`[MISTAKE_STORAGE] ✅ 已记录错题: ${params.bmNo}`)
  } catch (error) {
    console.error('[MISTAKE_STORAGE] ❌ 记录错题失败:', error)
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

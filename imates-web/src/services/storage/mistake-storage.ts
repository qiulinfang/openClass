/**
 * 错题本 IndexedDB 存储服务
 * 用于存储学生收藏的错题，包含原始作答和题目详情
 */

import { IndexedDBService } from './indexeddb-service'
import type { ExerciseItem } from '@/types'
import { STORE_NAMES, IDB_CONFIGS } from './db-config'

/** 
 * 单个练习记录
 */
export interface PracticeRecord {
  timestamp: number
  originalAnswer: unknown
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
  return IndexedDBService.getInstance(IDB_CONFIGS.MISTAKE_STORAGE())
}

/**
 * 初始化错题存储，并自动检测/迁移旧版 IndexedDB 错题数据
 */
export async function initMistakeStorage(): Promise<void> {
  const mistakeStorage = getMistakeStorage()
  if (!mistakeStorage.isInitialized) {
    await mistakeStorage.init()
  }

  // 执行自动数据无缝迁移
  await migrateOldMistakeDataIfNeeded()
}

/**
 * 尝试检测并无缝迁移旧库 (MistakeStorageDB) 的数据至新库 (MistakeVaultDB)
 */
async function migrateOldMistakeDataIfNeeded(): Promise<void> {
  const oldDbName = DB_NAMES.OLD_MISTAKE_STORAGE()
  const migrationFlagKey = `MISTAKE_MIGRATED_${oldDbName}`

  try {
    // 检查是否已经完成过迁移
    if (localStorage.getItem(migrationFlagKey) === 'true') {
      return
    }

    // 先安全检测旧数据库在浏览器中是否存在，若不存在则跳过，避免盲目打开空库
    const exists = await IndexedDBService.exists(oldDbName)
    if (!exists) {
      localStorage.setItem(migrationFlagKey, 'true')
      return
    }

    // 1. 初始化旧数据库服务 (带 3 秒超时容错保护)
    const oldStorage = IndexedDBService.getInstance({
      dbName: oldDbName,
      version: 11,
      stores: [{ name: STORE_NAMES.MISTAKES, keyPath: 'id' }],
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Old DB init timeout')), 3000)
    )

    await Promise.race([oldStorage.init(), timeoutPromise])

    // 2. 读取旧库中的所有错题记录
    const oldMistakes = await oldStorage.getAll<MistakeItem>(STORE_NAMES.MISTAKES)

    if (oldMistakes && oldMistakes.length > 0) {
      console.log(`[MISTAKE_MIGRATION] 🚚 检测到旧数据库数据 ${oldMistakes.length} 条，开始迁移至新库...`)
      const newStorage = getMistakeStorage()

      // 3. 逐条无缝导入新库（防止主键冲突，保留原有历史）
      for (const item of oldMistakes) {
        if (!item.id && !item.bmNo) continue
        const id = item.id || item.bmNo
        const existing = await newStorage.get<MistakeItem>(STORE_NAMES.MISTAKES, id)
        if (!existing) {
          await newStorage.put(STORE_NAMES.MISTAKES, item)
        }
      }
      console.log('[MISTAKE_MIGRATION] ✅ 旧错题数据成功迁移完毕！')
    }

    // 4. 标记迁移已处理
    localStorage.setItem(migrationFlagKey, 'true')

    // 5. 迁移完成后清理旧数据库，释放资源
    oldStorage.deleteDatabase().catch(() => {})
  } catch (error) {
    // 绝对安全降级：捕获所有异常（包括打不开旧库、权限拦截、损坏、超时），不中断页面渲染与新库使用
    console.warn('[MISTAKE_MIGRATION] ⚠️ 迁移旧错题数据静默跳过 (旧库不存在或损坏):', error)
    localStorage.setItem(migrationFlagKey, 'true')
  }
}

/**
 * 添加或更新错题记录
 */
export async function addMistake(params: {
  bmNo: string
  questionData: ExerciseItem
  originalAnswer?: unknown
  homeworkId?: string
  homeworkName?: string
}): Promise<void> {
  try {
    const mistakeStorage = getMistakeStorage()
    
    // 1. 尝试获取现有记录
    const existing = await mistakeStorage.get<MistakeItem>(STORE_NAMES.MISTAKES, params.bmNo)
    
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
      await mistakeStorage.put(STORE_NAMES.MISTAKES, updated)
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
      await mistakeStorage.put(STORE_NAMES.MISTAKES, newItem)
    }
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
    const mistakeStorage = getMistakeStorage()
    const mistakes = await mistakeStorage.getAll<MistakeItem>(STORE_NAMES.MISTAKES)
    console.log(`[MISTAKE_STORAGE] ✅ 加载错题列表成功: ${mistakes.length} 条`)
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
    const mistakeStorage = getMistakeStorage()
    const result = await mistakeStorage.get(STORE_NAMES.MISTAKES, bmNo)
    if (result) {
      console.log(`[MISTAKE_STORAGE] ✅ 题目已在错题本中: ${bmNo}`)
    }
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
    const mistakeStorage = getMistakeStorage()
    await mistakeStorage.delete(STORE_NAMES.MISTAKES, id)

    // 记录被删除的错题 ID，用于云同步删除对齐
    try {
      const deletedStr = localStorage.getItem('IMATES_MISTAKES_DELETED') || '[]'
      const deletedList: string[] = JSON.parse(deletedStr)
      if (!deletedList.includes(id)) {
        deletedList.push(id)
        localStorage.setItem('IMATES_MISTAKES_DELETED', JSON.stringify(deletedList))
      }
    } catch (e) {}
  } catch (error) {
    console.error(`[MISTAKE_STORAGE] ❌ 删除错题失败 (ID: ${id}):`, error)
    throw error
  }
}

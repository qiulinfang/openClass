import type { LearningPackage } from '@/types'
import { getUserId } from '@/services/http/auth-service'
import { resourceManager } from '@/services/storage/resource-storage'

// 与 TextbookStorage 共用同一个 IndexedDB，单独建一个 learning_packages 表
const STORE_NAME = 'learning_packages'

export interface LearningPackageCacheRecord {
  id: string              // 主键：`${userId}_${packageId}`
  userId: string
  packageId: string
  textbookId?: string
  data: LearningPackage[] // 缓存的学习包列表
  timestamp: number       // 缓存时间戳
}

function buildRecordId(userId: string, id: string): string {
  return `${userId}_${id}`
}

async function ensureStoreInitialized() {
  const db = resourceManager.indexedDB
  if (!db.isInitialized) {
    await db.init()
  }
}

/**
 * 将学习包缓存写入 IndexedDB
 */
export async function saveLearningPackagesToDB(
  id: string,
  packages: LearningPackage[],
  textbookId?: string,
): Promise<boolean> {
  try {
    await ensureStoreInitialized()
    const db = resourceManager.indexedDB
    const userId = getUserId()
    const record: LearningPackageCacheRecord = {
      id: buildRecordId(userId, id),
      userId,
      packageId: id,
      textbookId,
      data: packages,
      timestamp: Date.now(),
    }
    await db.put<LearningPackageCacheRecord>(STORE_NAME, record)
    return true
  } catch (error) {
    console.warn('[LearningPackagesStorage] 保存学习包缓存到 IndexedDB 失败', error)
    return false
  }
}

/**
 * 从 IndexedDB 读取学习包缓存（带 24 小时过期判断）
 */
export async function loadLearningPackagesFromDB(
  id: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): Promise<LearningPackage[] | null> {
  try {
    await ensureStoreInitialized()
    const db = resourceManager.indexedDB
    const userId = getUserId()
    const record = await db.get<LearningPackageCacheRecord>(
      STORE_NAME,
      buildRecordId(userId, id),
    )

    if (!record) {
      return null
    }

    if (Date.now() - record.timestamp > maxAgeMs) {
      return null
    }

    return record.data || null
  } catch (error) {
    console.warn('[LearningPackagesStorage] 读取学习包缓存失败', error)
    return null
  }
}

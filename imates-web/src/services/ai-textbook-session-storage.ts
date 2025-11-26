import type { AiTextbookSession } from '@/types'
import { resourceManager } from '@/services/resource-storage'

// 与 TextbookStorage 共用同一个 IndexedDB，单独建一个 ai_textbook_sessions 表
const STORE_NAME = 'ai_textbook_sessions'

// 确保表已创建（依赖 IndexedDBService 的动态 store 支持）
async function ensureStore() {
  const db = resourceManager.indexedDB
  // IndexedDBService 内部会在需要时创建缺失的 store / index（若有该能力），
  // 这里调用一次 init 以确保数据库已打开
  if (!db.isInitialized) {
    await db.init()
  }
}

export async function getScreenshotSessionsFromDB(resourceId?: string): Promise<AiTextbookSession[]> {
  await ensureStore()
  const db = resourceManager.indexedDB

  if (resourceId) {
    // 按 resourceId 索引查询
    try {
      const list = await db.getAllByIndex<AiTextbookSession>(STORE_NAME, 'resourceId', resourceId)
      return list || []
    } catch {
      // 如果索引不存在，降级为 getAll 过滤
      const all = await db.getAll<AiTextbookSession>(STORE_NAME)
      return (all || []).filter((s) => s.resourceId === resourceId)
    }
  }

  const all = await db.getAll<AiTextbookSession>(STORE_NAME)
  return all || []
}

export async function getScreenshotSessionsByResourceIdFromDB(resourceId: string): Promise<AiTextbookSession[]> {
  return await getScreenshotSessionsFromDB(resourceId)
}

export async function addScreenshotSessionToDB(session: AiTextbookSession): Promise<boolean> {
  await ensureStore()
  const db = resourceManager.indexedDB

  if (!session.sessionId && session.id) {
    session.sessionId = session.id
  }

  try {
    await db.update<AiTextbookSession>(STORE_NAME, session)
    return true
  } catch {
    return false
  }
}

export async function deleteScreenshotSessionFromDB(id: string): Promise<boolean> {
  await ensureStore()
  const db = resourceManager.indexedDB
  try {
    await db.delete(STORE_NAME, id)
    return true
  } catch {
    return false
  }
}

export async function batchDeleteScreenshotSessionsFromDB(ids: string[]): Promise<boolean> {
  await ensureStore()
  const db = resourceManager.indexedDB
  try {
    const tasks = ids.map((id) => db.delete(STORE_NAME, id))
    await Promise.all(tasks)
    return true
  } catch {
    return false
  }
}

export async function updateScreenshotSessionInDB(session: AiTextbookSession): Promise<boolean> {
  await ensureStore()
  const db = resourceManager.indexedDB

  if (!session.sessionId && session.id) {
    session.sessionId = session.id
  }

  try {
    await db.update<AiTextbookSession>(STORE_NAME, session)
    return true
  } catch {
    return false
  }
}

// 截图会话存储管理（IndexedDB 版）
import type { AiTextbookSession } from '@/types'
import {
  getScreenshotSessionsFromDB,
  getScreenshotSessionsByResourceIdFromDB,
  addScreenshotSessionToDB,
  deleteScreenshotSessionFromDB,
  batchDeleteScreenshotSessionsFromDB,
  updateScreenshotSessionInDB,
} from '@/services/ai-textbook-session-storage'

// 辅助函数：获取会话ID（兼容 id 和 sessionId）
const getSessionId = (session: AiTextbookSession): string => {
  return session.sessionId || session.id || ''
}

// 获取所有会话
export async function getScreenshotSessions(): Promise<AiTextbookSession[]> {
  try {
    const sessions = await getScreenshotSessionsFromDB()
    // 这里仍保留一次兼容处理，防止旧数据未完全迁移时结构不一致
    return sessions.map((session: any) => {
      if (session.sessionId) {
        return session as AiTextbookSession
      }
      return {
        sessionId: session.id || session.sessionId,
        sessionName: session.question || session.sessionName || '',
        createTime: session.timestamp || session.createTime || Date.now(),
        updateTime: session.timestamp || session.updateTime || Date.now(),
        msgCount: session.msgCount || 0,
        pinned: session.pinned,
        resourceId: session.resourceId,
        thumbnailImage: session.thumbnailImage,
        hasImage: session.hasImage,
        id: session.id,
        question: session.question,
        answer: session.answer,
        timestamp: session.timestamp,
      }
    })
  } catch (error) {
    console.error('Failed to load screenshot sessions from IndexedDB:', error)
    return []
  }
}

// 按 resourceId 获取会话列表
export async function getScreenshotSessionsByResourceId(resourceId: string): Promise<AiTextbookSession[]> {
  try {
    const sessions = await getScreenshotSessionsByResourceIdFromDB(resourceId)
    return sessions.map((session: any) => {
      if (session.sessionId) {
        return session as AiTextbookSession
      }
      return {
        sessionId: session.id || session.sessionId,
        sessionName: session.question || session.sessionName || '',
        createTime: session.timestamp || session.createTime || Date.now(),
        updateTime: session.timestamp || session.updateTime || Date.now(),
        msgCount: session.msgCount || 0,
        pinned: session.pinned,
        resourceId: session.resourceId,
        thumbnailImage: session.thumbnailImage,
        storageKey: session.storageKey,
        hasImage: session.hasImage,
        id: session.id,
        question: session.question,
        answer: session.answer,
        timestamp: session.timestamp,
      }
    })
  } catch (error) {
    console.error('Failed to load screenshot sessions by resourceId from IndexedDB:', error)
    return []
  }
}

// 添加新会话
export async function addScreenshotSession(session: AiTextbookSession): Promise<boolean> {
  try {
    console.log('[会话] 添加', { session })
    // 确保 sessionId 存在
    if (!session.sessionId && session.id) {
      session.sessionId = session.id
    }
    const ok = await addScreenshotSessionToDB(session)
    console.log('[会话] 添加', { session })
    if (ok) {
      const sessionId = getSessionId(session)
      console.log('[会话] 创建', { id: sessionId, resourceId: session.resourceId, hasImage: session.hasImage })
    }
    return ok
  } catch (error) {
    console.error('Failed to add screenshot session into IndexedDB:', error)
    return false
  }
}

// 删除会话
export async function deleteScreenshotSession(id: string): Promise<boolean> {
  try {
    return await deleteScreenshotSessionFromDB(id)
  } catch (error) {
    console.error('Failed to delete screenshot session from IndexedDB:', error)
    return false
  }
}

// 批量删除会话
export async function batchDeleteScreenshotSessions(ids: string[]): Promise<boolean> {
  try {
    return await batchDeleteScreenshotSessionsFromDB(ids)
  } catch (error) {
    console.error('Failed to batch delete screenshot sessions from IndexedDB:', error)
    return false
  }
}

// 更新会话
export async function updateScreenshotSession(session: AiTextbookSession): Promise<boolean> {
  try {
    const sessionId = getSessionId(session)
    const ok = await updateScreenshotSessionInDB(session)
    if (ok) {
      console.log('[会话] 更新', { id: sessionId, hasAnswer: !!session.answer })
    }
    return ok
  } catch (error) {
    console.error('Failed to update screenshot session in IndexedDB:', error)
    return false
  }
}
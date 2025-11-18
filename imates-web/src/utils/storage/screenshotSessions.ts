// 截图会话存储管理
import type { AiTextbookSession } from '@/types'
import { authStorageService } from '@/services/auth-storage-service'

const STORAGE_SUFFIX = 'ai-textbook-sessions'

const getStorageKey = (): string => authStorageService.getStorageKeyWithUserId(STORAGE_SUFFIX)

// 辅助函数：获取会话ID（兼容 id 和 sessionId）
const getSessionId = (session: AiTextbookSession): string => {
  return session.sessionId || session.id || ''
}

// 获取所有会话
export function getScreenshotSessions(): AiTextbookSession[] {
  try {
    const data = localStorage.getItem(getStorageKey())
    const sessions = data ? JSON.parse(data) : []
    // 兼容旧数据：将 QuestionRecord 转换为 AiTextbookSession
    return sessions.map((session: any) => {
      if (session.sessionId) {
        // 已经是 AiTextbookSession 格式
        return session
      }
      // 兼容旧格式 QuestionRecord
      return {
        sessionId: session.id || session.sessionId,
        sessionName: session.question || session.sessionName || '',
        createTime: session.timestamp || session.createTime || Date.now(),
        updateTime: session.timestamp || session.updateTime || Date.now(),
        msgCount: session.msgCount || 0,
        pinned: session.pinned,
        resourceId: session.resourceId,
        thumbnailImage: session.thumbnailImage, // 保留缩略图字段
        storageKey: session.storageKey,
        hasImage: session.hasImage,
        // 保留兼容字段
        id: session.id,
        question: session.question,
        answer: session.answer,
        timestamp: session.timestamp,
      }
    })
  } catch (error) {
    console.error('Failed to load screenshot sessions:', error)
    return []
  }
}

// 添加新会话
export function addScreenshotSession(session: AiTextbookSession): boolean {
  try {
    const sessions = getScreenshotSessions()
    // 确保 sessionId 存在
    if (!session.sessionId && session.id) {
      session.sessionId = session.id
    }
    sessions.unshift(session) // 添加到开头
    localStorage.setItem(getStorageKey(), JSON.stringify(sessions))
    console.log('[会话] 添加', getStorageKey(), JSON.stringify(sessions))
    const sessionId = getSessionId(session)
    console.log('[会话] 创建', { id: sessionId, resourceId: session.resourceId, hasImage: session.hasImage })
    return true
  } catch (error) {
    console.error('Failed to add screenshot session:', error)
    return false
  }
}

// 删除会话
export function deleteScreenshotSession(id: string): boolean {
  try {
    const sessions = getScreenshotSessions()
    const filteredSessions = sessions.filter(session => getSessionId(session) !== id)
    localStorage.setItem(getStorageKey(), JSON.stringify(filteredSessions))
    return true
  } catch (error) {
    console.error('Failed to delete screenshot session:', error)
    return false
  }
}

// 批量删除会话
export function batchDeleteScreenshotSessions(ids: string[]): boolean {
  try {
    const sessions = getScreenshotSessions()
    const filteredSessions = sessions.filter(session => !ids.includes(getSessionId(session)))
    localStorage.setItem(getStorageKey(), JSON.stringify(filteredSessions))
    return true
  } catch (error) {
    console.error('Failed to batch delete screenshot sessions:', error)
    return false
  }
}

// 更新会话
export function updateScreenshotSession(session: AiTextbookSession): boolean {
  try {
    const sessions = getScreenshotSessions()
    const sessionId = getSessionId(session)
    const index = sessions.findIndex(s => getSessionId(s) === sessionId)
    if (index !== -1) {
      sessions[index] = session
    localStorage.setItem(getStorageKey(), JSON.stringify(sessions))
      console.log('[会话] 更新', { id: sessionId, hasAnswer: !!session.answer })
      return true
    }
    return false
  } catch (error) {
    console.error('Failed to update screenshot session:', error)
    return false
  }
}
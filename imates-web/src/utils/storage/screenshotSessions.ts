// 截图会话存储管理
import type { QuestionRecord } from '@/types'
import { getStorageKeyWithUserId } from '@/utils/user/userId'

const STORAGE_SUFFIX = 'ai-textbook-sessions'

const getStorageKey = (): string => getStorageKeyWithUserId(STORAGE_SUFFIX)

// 获取所有会话
export function getScreenshotSessions(): QuestionRecord[] {
  try {
    const data = localStorage.getItem(getStorageKey())
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Failed to load screenshot sessions:', error)
    return []
  }
}

// 添加新会话
export function addScreenshotSession(session: QuestionRecord): boolean {
  try {
    const sessions = getScreenshotSessions()
    sessions.unshift(session) // 添加到开头
    localStorage.setItem(getStorageKey(), JSON.stringify(sessions))
    console.log('[会话] 创建', { id: session.id, resourceId: session.resourceId, hasImage: session.hasImage })
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
    const filteredSessions = sessions.filter(session => session.id !== id)
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
    const filteredSessions = sessions.filter(session => !ids.includes(session.id))
    localStorage.setItem(getStorageKey(), JSON.stringify(filteredSessions))
    return true
  } catch (error) {
    console.error('Failed to batch delete screenshot sessions:', error)
    return false
  }
}

// 更新会话
export function updateScreenshotSession(session: QuestionRecord): boolean {
  try {
    const sessions = getScreenshotSessions()
    const index = sessions.findIndex(s => s.id === session.id)
    if (index !== -1) {
      sessions[index] = session
    localStorage.setItem(getStorageKey(), JSON.stringify(sessions))
      console.log('[会话] 更新', { id: session.id, hasAnswer: !!session.answer })
      return true
    }
    return false
  } catch (error) {
    console.error('Failed to update screenshot session:', error)
    return false
  }
}
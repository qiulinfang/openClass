/**
 * 收藏功能工具函数
 * 使用 localStorage 存储收藏的会话和题目
 */

import type { QuestionRecord, AiGeneralSession, AiTextbookSession } from '@/types/chat'
import type { ExerciseItem } from '@/types/exercise'
import { getCurrentUserIdOrDefault } from '../../services'

// localStorage key 常量（带用户ID前缀）
const getFavoritesStorageKey = (): string => {
  const userId = getCurrentUserIdOrDefault()
  return `${userId}_favorites`
}
const QA_FAVORITES_PREFIX = 'favorite_qa_'  
const EXERCISE_FAVORITES_PREFIX = 'favorite_exercise_'

// 辅助函数：获取会话ID（兼容 id 和 sessionId）
const getSessionId = (record: QuestionRecord | AiTextbookSession): string => {
  if ('sessionId' in record && record.sessionId) {
    return record.sessionId
  }
  if ('id' in record && record.id) {
    return record.id
  }
  return ''
}

// 收藏数据类型
export interface FavoriteQa {
  id: string
  type: 'qa'
  record: QuestionRecord | AiTextbookSession  // 支持 QuestionRecord 和 AiTextbookSession
  timestamp: number
}

export interface FavoriteExercise {
  id: string
  type: 'exercise'
  item: ExerciseItem
  timestamp: number
}

export interface FavoriteSession {
  id: string
  type: 'session'
  session: AiGeneralSession
  timestamp: number
}

export type Favorite = FavoriteQa | FavoriteExercise | FavoriteSession

/**
 * 获取所有收藏的会话
 */
export function getFavoriteQas(): FavoriteQa[] {
  try {
    const favorites: Favorite[] = getAllFavorites()
    return favorites.filter((f): f is FavoriteQa => f.type === 'qa')
  } catch (error) {
    console.error('获取收藏会话失败:', error)
    return []
  }
}

/**
 * 获取所有收藏的题目
 */
export function getFavoriteExercises(): FavoriteExercise[] {
  try {
    const favorites: Favorite[] = getAllFavorites()
    return favorites.filter((f): f is FavoriteExercise => f.type === 'exercise')
  } catch (error) {
    console.error('获取收藏题目失败:', error)
    return []
  }
}

/**
 * 获取所有收藏的会话
 */
export function getFavoriteSessions(): FavoriteSession[] {
  try {
    const favorites: Favorite[] = getAllFavorites()
    return favorites.filter((f): f is FavoriteSession => f.type === 'session')
  } catch (error) {
    console.error('获取收藏会话失败:', error)
    return []
  }
}

/**
 * 获取所有收藏
 */
export function getAllFavorites(): Favorite[] {
  try {
    const key = getFavoritesStorageKey()
    const data = localStorage.getItem(key)
    if (!data) return []
    return JSON.parse(data) as Favorite[]
  } catch (error) {
    console.error('获取收藏列表失败:', error)
    return []
  }
}

/**
 * 检查会话是否已收藏
 */
export function isQaFavorite(recordId: string): boolean {
  const favorites = getFavoriteQas()
  return favorites.some(f => getSessionId(f.record) === recordId)
}

/**
 * 检查题目是否已收藏
 */
export function isExerciseFavorite(itemId: string): boolean {
  const favorites = getFavoriteExercises()
  return favorites.some(f => (f.item.id === itemId) || (f.item.bmNo === itemId))
}

/**
 * 检查会话是否已收藏
 */
export function isSessionFavorite(sessionId: string): boolean {
  const favorites = getFavoriteSessions()
  return favorites.some(f => f.session.sessionId === sessionId)
}

/**
 * 收藏会话
 */
export function addQaFavorite(record: QuestionRecord | AiTextbookSession): boolean {
  try {
    const recordId = getSessionId(record)
    if (isQaFavorite(recordId)) {
      return false // 已收藏
    }

    const favorite: FavoriteQa = {
      id: `qa_${recordId}_${Date.now()}`,
      type: 'qa',
      record,
      timestamp: Date.now()
    }

    const favorites = getAllFavorites()
    favorites.push(favorite)
    const key = getFavoritesStorageKey()
    localStorage.setItem(key, JSON.stringify(favorites))
    return true
  } catch (error) {
    console.error('收藏会话失败:', error)
    return false
  }
}

/**
 * 收藏题目
 */
export function addExerciseFavorite(item: ExerciseItem): boolean {
  try {
    if (isExerciseFavorite(item.id || item.bmNo)) {
      return false // 已收藏
    }

    const favorite: FavoriteExercise = {
      id: `exercise_${item.id || item.bmNo}_${Date.now()}`,
      type: 'exercise',
      item,
      timestamp: Date.now()
    }

    const favorites = getAllFavorites()
    favorites.push(favorite)
    const key = getFavoritesStorageKey()
    localStorage.setItem(key, JSON.stringify(favorites))
    return true
  } catch (error) {
    console.error('收藏题目失败:', error)
    return false
  }
}

/**
 * 取消收藏会话
 */
export function removeQaFavorite(recordId: string): boolean {
  try {
    const favorites = getAllFavorites()
    const filtered = favorites.filter(f => {
      if (f.type === 'qa') {
        return getSessionId(f.record) !== recordId
      }
      return true
    })
    const key = getFavoritesStorageKey()
    localStorage.setItem(key, JSON.stringify(filtered))
    return favorites.length !== filtered.length
  } catch (error) {
    console.error('取消收藏会话失败:', error)
    return false
  }
}

/**
 * 取消收藏题目
 */
export function removeExerciseFavorite(itemId: string): boolean {
  try {
    const favorites = getAllFavorites()
    const filtered = favorites.filter(f => {
      if (f.type === 'exercise') {
        // 同时检查 id 和 bmNo
        return (f.item.id !== itemId) && (f.item.bmNo !== itemId)
      }
      return true
    })
    const key = getFavoritesStorageKey()
    localStorage.setItem(key, JSON.stringify(filtered))
    return favorites.length !== filtered.length
  } catch (error) {
    console.error('取消收藏题目失败:', error)
    return false
  }
}

/**
 * 切换会话收藏状态
 */
export function toggleQaFavorite(record: QuestionRecord | AiTextbookSession): boolean {
  const recordId = getSessionId(record)
  if (isQaFavorite(recordId)) {
    return removeQaFavorite(recordId)
  } else {
    return addQaFavorite(record)
  }
}

/**
 * 收藏会话
 */
export function addSessionFavorite(session: AiGeneralSession): boolean {
  try {
    if (isSessionFavorite(session.sessionId)) {
      return false // 已收藏
    }

    const favorite: FavoriteSession = {
      id: `session_${session.sessionId}_${Date.now()}`,
      type: 'session',
      session,
      timestamp: Date.now()
    }

    const favorites = getAllFavorites()
    favorites.push(favorite)
    const key = getFavoritesStorageKey()
    localStorage.setItem(key, JSON.stringify(favorites))
    return true
  } catch (error) {
    console.error('收藏会话失败:', error)
    return false
  }
}

/**
 * 取消收藏会话
 */
export function removeSessionFavorite(sessionId: string): boolean {
  try {
    const favorites = getAllFavorites()
    const filtered = favorites.filter(f => {
      if (f.type === 'session') {
        return f.session.sessionId !== sessionId
      }
      return true
    })
    const key = getFavoritesStorageKey()
    localStorage.setItem(key, JSON.stringify(filtered))
    return favorites.length !== filtered.length
  } catch (error) {
    console.error('取消收藏会话失败:', error)
    return false
  }
}

/**
 * 切换会话收藏状态
 */
export function toggleSessionFavorite(session: AiGeneralSession): boolean {
  if (isSessionFavorite(session.sessionId)) {
    return removeSessionFavorite(session.sessionId)
  } else {
    return addSessionFavorite(session)
  }
}

/**
 * 切换题目收藏状态
 */
export function toggleExerciseFavorite(item: ExerciseItem): boolean {
  if (isExerciseFavorite(item.id || item.bmNo)) {
    return removeExerciseFavorite(item.id || item.bmNo)
  } else {
    return addExerciseFavorite(item)
  }
}

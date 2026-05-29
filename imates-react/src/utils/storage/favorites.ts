/**
 * 收藏功能工具函数
 * 使用 localStorage 存储收藏的会话和题目
 */

import type { QuestionRecord, AiGeneralSession, AiTextbookSession } from '@/types/chat'
import type { ExerciseItem } from '@/types/exercise'
import { getUserId } from '@/services'

// 收藏数据类型
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

export type Favorite = FavoriteExercise | FavoriteSession

// localStorage key 常量（带用户ID前缀）
const getFavoritesStorageKey = (): string => {
  const userId = getUserId()
  return `${userId}_favorites`
}

// 题目收藏ID归一化（兼容新旧格式）
const normalizeExerciseId = (id: string): string => {
  if (!id) return ''
  // 旧格式：exercise_{itemId}_{timestamp}
  if (id.startsWith('exercise_')) {
    const parts = id.split('_')
    return parts.length >= 2 ? parts[1] : id
  }
  // 新格式：直接是bmNo或id
  return id
}

// 会话收藏ID归一化（兼容新旧格式）
const normalizeSessionId = (id: string): string => {
  if (!id) return ''
  // 旧格式：session_{sessionId}_{timestamp}
  if (id.startsWith('session_')) {
    const parts = id.split('_')
    return parts.length >= 2 ? parts[1] : id
  }
  // 新格式：直接是sessionId
  return id
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
 * 过滤有效的收藏记录（移除无效类型）
 */
function filterValidFavorites(raw: any[]): { cleaned: Favorite[], removedCount: number } {
  const cleaned = raw.filter((f) => {
    if (!f || typeof f !== 'object') return false
    if (f.type === 'exercise' || f.type === 'session') return true
    return false
  }) as Favorite[]
  
  return {
    cleaned,
    removedCount: raw.length - cleaned.length
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
    const raw = JSON.parse(data) as any[]
    if (!Array.isArray(raw)) return []
    
    const { cleaned } = filterValidFavorites(raw)
    
    if (cleaned.length !== raw.length) {
      localStorage.setItem(key, JSON.stringify(cleaned))
    }
    return cleaned
  } catch (error) {
    console.error('获取收藏列表失败:', error)
    return []
  }
}


/**
 * 检查题目是否已收藏
 */
export function isExerciseFavorite(itemId: string): boolean {
  const favorites = getFavoriteExercises()
  const normalized = normalizeExerciseId(itemId)
  return favorites.some(f => normalizeExerciseId(f.id) === normalized)
}

/**
 * 检查会话是否已收藏
 */
export function isSessionFavorite(sessionId: string): boolean {
  const favorites = getFavoriteSessions()
  const normalized = normalizeSessionId(sessionId)
  return favorites.some(f => normalizeSessionId(f.id) === normalized || normalizeSessionId(f.session.sessionId) === normalized)
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
      id: item.bmNo || item.id, // 优先使用bmNo，其次使用id
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
 * 取消收藏题目
 */
export function removeExerciseFavorite(itemId: string): boolean {
  try {
    const favorites = getAllFavorites()
    const normalized = normalizeExerciseId(itemId)
    const filtered = favorites.filter(f => {
      if (f.type === 'exercise') {
        return normalizeExerciseId(f.id) !== normalized
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
 * 收藏会话
 */
export function addSessionFavorite(session: AiGeneralSession): boolean {
  try {
    const normalized = normalizeSessionId(session.sessionId)
    if (isSessionFavorite(normalized)) {
      return false // 已收藏
    }

    const favorite: FavoriteSession = {
      id: normalized,
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
    const normalized = normalizeSessionId(sessionId)
    const filtered = favorites.filter(f => {
      if (f.type === 'session') {
        const favSessionId = normalizeSessionId(f.session.sessionId)
        const favId = normalizeSessionId(f.id)
        return favSessionId !== normalized && favId !== normalized
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
  const itemId = item.bmNo || item.id
  if (isExerciseFavorite(itemId)) {
    return removeExerciseFavorite(itemId)
  } else {
    return addExerciseFavorite(item)
  }
}

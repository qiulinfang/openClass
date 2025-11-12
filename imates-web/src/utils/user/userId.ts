/**
 * 用户ID工具函数
 * 统一管理用户ID的存储和获取，支持学班管理员和研伴学生两种登录方式
 */

/**
 * 用户类型枚举
 */
export enum UserType {
  /** 学班管理员 */
  XUEBAN = 'XUEBAN',
  /** 研伴学生 */
  YANBAN = 'YANBAN'
}

/**
 * 统一的用户ID存储键
 */
const CURRENT_USER_ID_KEY = 'CURRENT_USER_ID'
const CURRENT_USER_TYPE_KEY = 'CURRENT_USER_TYPE'

/**
 * 清理字符串值，过滤无效值
 */
const sanitize = (value: string | null | undefined): string | null => {
  if (!value || value === 'undefined' || value.trim() === '') {
    return null
  }
  return value
}

/**
 * 设置当前登录用户ID和类型
 * @param userId 用户ID
 * @param userType 用户类型
 */
export function setCurrentUserId(userId: string, userType: UserType): void {
  if (userId && userId !== 'undefined' && userId.trim() !== '') {
    const oldUserId = getCurrentUserId()
    const oldUserType = getCurrentUserType()
    
    localStorage.setItem(CURRENT_USER_ID_KEY, userId)
    localStorage.setItem(CURRENT_USER_TYPE_KEY, userType)
    
    // 记录日志
    if (oldUserId !== userId || oldUserType !== userType) {
      console.log('[USER_ID] 📝 设置当前用户ID (兼容存储):', {
        oldUserId,
        newUserId: userId,
        oldUserType,
        newUserType: userType,
        storageKeys: {
          userIdKey: CURRENT_USER_ID_KEY,
          userTypeKey: CURRENT_USER_TYPE_KEY
        },
        timestamp: new Date().toISOString()
      })
    }
  } else {
    console.warn('[USER_ID] ⚠️ 尝试设置无效的userId:', {
      userId,
      userType,
      reason: !userId ? 'userId为空' : userId === 'undefined' ? 'userId为undefined字符串' : 'userId为空字符串'
    })
  }
}

/**
 * 获取当前登录用户ID
 * @returns 用户ID，如果未登录则返回null
 */
export function getCurrentUserId(): string | null {
  return sanitize(localStorage.getItem(CURRENT_USER_ID_KEY))
}

/**
 * 获取当前用户类型
 * @returns 用户类型，如果未登录则返回null
 */
export function getCurrentUserType(): UserType | null {
  const userType = localStorage.getItem(CURRENT_USER_TYPE_KEY)
  if (userType === UserType.XUEBAN || userType === UserType.YANBAN) {
    return userType as UserType
  }
  return null
}

/**
 * 获取当前用户ID，如果未登录则返回默认值
 * @param defaultValue 默认值，默认为'default'
 * @returns 用户ID或默认值
 */
export function getCurrentUserIdOrDefault(defaultValue: string = 'default'): string {
  return getCurrentUserId() || defaultValue
}

/**
 * 清除当前用户ID和类型
 */
export function clearCurrentUserId(): void {
  const oldUserId = getCurrentUserId()
  const oldUserType = getCurrentUserType()
  
  if (oldUserId || oldUserType) {
    console.log('[USER_ID] 🗑️ 清除当前用户ID (兼容存储):', {
      oldUserId,
      oldUserType,
      storageKeys: {
        userIdKey: CURRENT_USER_ID_KEY,
        userTypeKey: CURRENT_USER_TYPE_KEY
      },
      timestamp: new Date().toISOString()
    })
  }
  
  localStorage.removeItem(CURRENT_USER_ID_KEY)
  localStorage.removeItem(CURRENT_USER_TYPE_KEY)
  
  console.log('[USER_ID] ✅ 用户ID已清除')
}

/**
 * 获取带用户分区前缀的localStorage key
 * 用于存储用户相关的业务数据（如聊天记录、会话等）
 * @param suffix 后缀
 * @returns 带用户ID前缀的key
 */
export function getScopedStorageKey(suffix: string): string {
  const userId = getCurrentUserId()
  return userId ? `${userId}_${suffix}` : suffix
}

/**
 * 获取带用户分区的localStorage值
 * @param suffix 后缀
 * @returns 存储的值，如果不存在则返回null
 */
export function getScopedStorageValue(suffix: string): string | null {
  const scopedKey = getScopedStorageKey(suffix)
  return sanitize(localStorage.getItem(scopedKey))
}

/**
 * 设置带用户分区的localStorage值
 * @param suffix 后缀
 * @param value 值
 */
export function setScopedStorageValue(suffix: string, value: string): void {
  const scopedKey = getScopedStorageKey(suffix)
  if (value) {
    localStorage.setItem(scopedKey, value)
  } else {
    localStorage.removeItem(scopedKey)
  }
}

/**
 * 为存储key添加用户ID前缀
 * @param key 原始key
 * @returns 带用户ID前缀的key
 */
export function getStorageKeyWithUserId(key: string): string {
  const userId = getCurrentUserIdOrDefault()
  return `${userId}_${key}`
}

/**
 * 获取当前用户分区Key（用于向后兼容）
 * @deprecated 使用 getCurrentUserId() 替代
 */
export function getCurrentUserStorageKey(): string | null {
  return getCurrentUserId()
}

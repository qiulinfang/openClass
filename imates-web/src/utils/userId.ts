/**
 * 用户ID工具函数
 * 用于获取当前登录用户的ID，支持学班管理员和研伴学生两种登录方式
 */

/**
 * 获取当前登录用户的ID
 * 优先级：userId（学班管理员） > studentUserId（研伴学生）
 * @returns 用户ID，如果未登录则返回null
 */
export function getCurrentUserId(): string | null {
  // 优先获取学班管理员的userId
  const userId = localStorage.getItem('userId')
  if (userId && userId !== 'undefined' && userId.trim() !== '') {
    return userId
  }
  
  // 如果没有学班管理员ID，尝试获取研伴学生的studentUserId
  const studentUserId = localStorage.getItem('studentUserId')
  if (studentUserId && studentUserId !== 'undefined' && studentUserId.trim() !== '') {
    return studentUserId
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
 * 为存储key添加用户ID前缀
 * @param key 原始key
 * @returns 带用户ID前缀的key
 */
export function getStorageKeyWithUserId(key: string): string {
  const userId = getCurrentUserIdOrDefault()
  return `${userId}_${key}`
}


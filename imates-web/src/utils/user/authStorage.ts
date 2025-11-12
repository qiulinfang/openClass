/**
 * 用户认证信息存储工具
 * 提供用户信息的读取和保存功能
 */

import type { UserInfo } from '../../types'

const STORAGE_KEY = 'userInfo'

/**
 * 获取用户信息
 * @returns UserInfo | null 用户信息，如果不存在则返回 null
 */
export function getUserInfo(): UserInfo | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return null
    }
    return JSON.parse(stored) as UserInfo
  } catch (error) {
    console.error('[AUTH_STORAGE] ❌ 读取用户信息失败:', error)
    return null
  }
}

/**
 * 设置用户信息
 * @param userInfo UserInfo | null 用户信息，传入 null 表示清除用户信息
 */
export function setUserInfo(userInfo: UserInfo | null): void {
  try {
    if (userInfo === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo))
    }
  } catch (error) {
    console.error('[AUTH_STORAGE] ❌ 保存用户信息失败:', error)
  }
}

/**
 * 获取用户ID（账号）
 * @returns string | null 用户ID，如果不存在则返回 null
 */
export function getUserId(): string | null {
  try {
    return localStorage.getItem('userId')
  } catch (error) {
    console.error('[AUTH_STORAGE] ❌ 读取用户ID失败:', error)
    return null
  }
}

/**
 * 设置用户ID（账号）
 * @param userId string | null 用户ID，传入 null 表示清除用户ID
 */
export function setUserId(userId: string | null): void {
  try {
    if (userId === null) {
      localStorage.removeItem('userId')
    } else {
      localStorage.setItem('userId', userId)
    }
  } catch (error) {
    console.error('[AUTH_STORAGE] ❌ 保存用户ID失败:', error)
  }
}

/**
 * 获取用户密码
 * @returns string | null 用户密码，如果不存在则返回 null
 */
export function getPassword(): string | null {
  try {
    return localStorage.getItem('userPassword')
  } catch (error) {
    console.error('[AUTH_STORAGE] ❌ 读取用户密码失败:', error)
    return null
  }
}

/**
 * 设置用户密码
 * @param password string | null 用户密码，传入 null 表示清除用户密码
 */
export function setPassword(password: string | null): void {
  try {
    if (password === null) {
      localStorage.removeItem('userPassword')
    } else {
      localStorage.setItem('userPassword', password)
    }
  } catch (error) {
    console.error('[AUTH_STORAGE] ❌ 保存用户密码失败:', error)
  }
}

/**
 * 获取研伴Token
 * @returns string | null 研伴Token，如果不存在则返回 null
 */
export function getYanbanToken(): string | null {
  try {
    return localStorage.getItem('YANBAN_TOKEN')
  } catch (error) {
    console.error('[AUTH_STORAGE] ❌ 读取研伴Token失败:', error)
    return null
  }
}

/**
 * 获取学班Token
 * @returns string | null 学班Token，如果不存在则返回 null
 */
export function getXuebanToken(): string | null {
  try {
    return localStorage.getItem('XUEBAN_TOKEN')
  } catch (error) {
    console.error('[AUTH_STORAGE] ❌ 读取学班Token失败:', error)
    return null
  }
}

/**
 * 设置研伴Token
 * @param token string | null 研伴Token，传入 null 表示清除Token
 */
export function setYanbanToken(token: string | null): void {
  try {
    if (token === null) {
      localStorage.removeItem('YANBAN_TOKEN')
    } else {
      localStorage.setItem('YANBAN_TOKEN', token)
    }
  } catch (error) {
    console.error('[AUTH_STORAGE] ❌ 保存研伴Token失败:', error)
  }
}

/**
 * 设置学班Token
 * @param token string | null 学班Token，传入 null 表示清除Token
 */
export function setXuebanToken(token: string | null): void {
  try {
    if (token === null) {
      localStorage.removeItem('XUEBAN_TOKEN')
    } else {
      localStorage.setItem('XUEBAN_TOKEN', token)
    }
  } catch (error) {
    console.error('[AUTH_STORAGE] ❌ 保存学班Token失败:', error)
  }
}



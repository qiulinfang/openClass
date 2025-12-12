/**
 * 配置工具函数
 * 简单的配置初始化和管理
 */

import { httpClient } from '../../services/http/http-client'
import { androidBridge } from '../../services/business/android-bridge'
import { setBaseUrl } from '../../services/http/api-endpoints'
import {
  getUserId,
  getCurrentUserIdOrDefault,
  setCurrentUser,
  UserType,
} from '../../services/http/auth-service'

/**
 * 初始化应用配置
 */
export async function initializeAppConfig(initData: unknown = {}) {
  // 1. 设置API基础URL - 使用相对路径让Vite代理处理
  const baseUrl = "" // 使用空字符串，让所有请求都通过Vite代理
  httpClient.setBaseURL(baseUrl)
  setBaseUrl(baseUrl) // 设置 api-endpoints 中的基础URL

  // 2. 收集所有认证信息
  const authConfig: {
    cookie?: string
    saToken?: string
    authorization?: string
    token?: string
  } = {}

  // 从initData获取认证信息
  if (initData && typeof initData === 'object') {
    const data = initData as Record<string, unknown>
    Object.assign(authConfig, {
      cookie: data.cookie as string,
      saToken: data.saToken as string,
      authorization: data.authorization as string,
      token: data.token as string
    })
    
    // 如果只有token，自动设置其他认证方式
    if (data.token && !data.saToken && !data.authorization) {
      authConfig.saToken = data.token as string
      authConfig.authorization = `Bearer ${data.token as string}`
    }
  }

  // 从Android Bridge获取认证信息
  if (androidBridge.isAndroidBridgeAvailable()) {
    const bridgeToken = androidBridge.getUserToken()
    if (bridgeToken && !authConfig.token) {
      authConfig.token = bridgeToken
      authConfig.saToken = bridgeToken
      authConfig.authorization = `Bearer ${bridgeToken}`
    }
  }

  // 从localStorage获取认证信息（支持用户分区）
  const defaultTokenKey = 'token'
  const tokenKeys: string[] = []
  const storedUserKey = getUserId()
  if (storedUserKey) {
    tokenKeys.push(`${storedUserKey}_${defaultTokenKey}`)
  }
  const fallbackKey = `${getCurrentUserIdOrDefault()}_${defaultTokenKey}`
  if (!tokenKeys.includes(fallbackKey)) {
    tokenKeys.push(fallbackKey)
  }
  tokenKeys.push(defaultTokenKey)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.endsWith(`_${defaultTokenKey}`) && !tokenKeys.includes(key)) {
      tokenKeys.push(key)
    }
  }
  tokenKeys.forEach(key => {
    const value = localStorage.getItem(key)
    if (value && !authConfig.token) {
      authConfig.token = value
      authConfig.saToken = value
      authConfig.authorization = `Bearer ${value}`
    }
  })

  // 从Cookie获取认证信息
  if (document.cookie && !authConfig.cookie) {
    authConfig.cookie = document.cookie
  }

  // 3. 直接设置localStorage认证信息
  Object.entries(authConfig).forEach(([key, value]) => {
    if (value && key === 'token') {
      // 如果 authConfig 中有 userId，设置当前用户ID（用于认证配置场景）
      const userIdFromConfig = (authConfig as Record<string, unknown>).userId as string | undefined
      if (userIdFromConfig) {
        console.log('[CONFIG] ⚙️ 从配置初始化userId:', {
          userId: userIdFromConfig,
          userType: UserType.XUEBAN,
          source: '应用配置(authConfig.userId)',
          note: '配置场景默认使用XUEBAN类型',
          timestamp: new Date().toISOString()
        })
        // 尝试推断用户类型（这里默认使用 XUEBAN，因为这是配置场景）
        setCurrentUser(userIdFromConfig, UserType.XUEBAN)
      }
      const storedUserKey = userIdFromConfig || getUserId()
      const storageKey = storedUserKey ? `${storedUserKey}_${key}` : key
      localStorage.setItem(storageKey, value as string)
    }
  })
}

/**
 * 更新全局认证配置
 */
export function updateGlobalAuthConfig(authConfig: {
  cookie?: string
  saToken?: string
  authorization?: string
  token?: string
}) {
  // 直接更新localStorage
  Object.entries(authConfig).forEach(([key, value]) => {
    if (value && key === 'token') {
      // 如果 authConfig 中有 userId，设置当前用户ID（用于认证配置场景）
      const userIdFromConfig = (authConfig as Record<string, unknown>).userId as string | undefined
      if (userIdFromConfig) {
        // 尝试推断用户类型（这里默认使用 XUEBAN，因为这是配置场景）
        setCurrentUser(userIdFromConfig, UserType.XUEBAN)
      }
      const storedUserKey = userIdFromConfig || getUserId()
      const storageKey = storedUserKey ? `${storedUserKey}_${key}` : key
      localStorage.setItem(storageKey, value as string)
    }
  })
}

/**
 * 清除所有认证信息
 */
export function clearGlobalAuthConfig() {
  // 直接清除localStorage
  const tokenKeys: string[] = []
  const storedUserKey = getUserId()
  if (storedUserKey) {
    tokenKeys.push(`${storedUserKey}_token`)
  }
  tokenKeys.push('token')
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.endsWith('_token') && !tokenKeys.includes(key)) {
      tokenKeys.push(key)
    }
  }
  tokenKeys.forEach(key => {
    localStorage.removeItem(key)
  })
  
  // 清除Cookie
  document.cookie.split(";").forEach(c => { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
}

/**
 * 获取当前认证配置
 */
export function getCurrentAuthConfig() {
  // 直接从localStorage获取认证配置
  const config: Record<string, string> = {}
  const keysToCheck: string[] = []
  const storedUserKey = getUserId()
  if (storedUserKey) {
    keysToCheck.push(`${storedUserKey}_token`)
  }
  keysToCheck.push('token')
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.endsWith('_token') && !keysToCheck.includes(key)) {
      keysToCheck.push(key)
    }
  }
  keysToCheck.forEach(key => {
    const value = localStorage.getItem(key)
    if (value) {
      config[key] = value
    }
  })
  
  return config
}

/**
 * 检查认证状态
 */
export function hasValidAuth(): boolean {
  // 直接从localStorage检查认证状态
  const keysToCheck: string[] = []
  const storedUserKey = getUserId()
  if (storedUserKey) {
    keysToCheck.push(`${storedUserKey}_token`)
  }
  keysToCheck.push('token')
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.endsWith('_token') && !keysToCheck.includes(key)) {
      keysToCheck.push(key)
    }
  }
  return keysToCheck.some(key => !!localStorage.getItem(key))
}

/**
 * 获取用户信息
 */
export function getUserInfo(initData: unknown = {}) {
  // 优先级：Android Bridge > initData > 本地存储
  if (androidBridge.isAndroidBridgeAvailable()) {
    const userInfo = androidBridge.getUserInfo()
    if (userInfo?.userId) return userInfo
  }

  if (initData && typeof initData === 'object' && 'userInfo' in initData) {
    const userInfo = (initData as { userInfo?: { userId?: string } }).userInfo
    if (userInfo?.userId) {
      return userInfo
    }
  }

  try {
    const keysToCheck: string[] = []
    const storedUserKey = getUserId()
    if (storedUserKey) {
      keysToCheck.push(`${storedUserKey}_USER_INFO_CACHE`)
    }
    const defaultKey = `${getCurrentUserIdOrDefault()}_USER_INFO_CACHE`
    if (!keysToCheck.includes(defaultKey)) {
      keysToCheck.push(defaultKey)
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.endsWith('_USER_INFO_CACHE') && !keysToCheck.includes(key)) {
        keysToCheck.push(key)
      }
    }
    for (const key of keysToCheck) {
      if (!key) continue
      const stored = localStorage.getItem(key)
      if (stored) {
        return JSON.parse(stored)
      }
    }
    return null
  } catch {
    return null
  }
}

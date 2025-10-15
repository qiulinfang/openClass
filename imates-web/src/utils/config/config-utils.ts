/**
 * 配置工具函数
 * 简单的配置初始化和管理
 */

import { httpClient } from '../../services/http-client'
import { androidBridge } from '../../services/android-bridge'
import { setBaseUrl } from '../../services/api-endpoints'

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

  // 从localStorage获取认证信息
  const tokenKeys = ['token'] as const
  tokenKeys.forEach(key => {
    const value = localStorage.getItem(key)
    if (value && !authConfig[key]) {
      authConfig[key] = value
      if (key === 'token' && !authConfig.saToken && !authConfig.authorization) {
        authConfig.saToken = value
        authConfig.authorization = `Bearer ${value}`
      }
    }
  })

  // 从Cookie获取认证信息
  if (document.cookie && !authConfig.cookie) {
    authConfig.cookie = document.cookie
  }

  // 3. 直接设置localStorage认证信息（不再使用全局认证配置）
  Object.entries(authConfig).forEach(([key, value]) => {
    if (value && key === 'token') {
      localStorage.setItem(key, value as string)
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
  // 直接更新localStorage（不再使用全局认证配置）
  Object.entries(authConfig).forEach(([key, value]) => {
    if (value && key === 'token') {
      localStorage.setItem(key, value as string)
    }
  })
}

/**
 * 清除所有认证信息
 */
export function clearGlobalAuthConfig() {
  // 直接清除localStorage（不再使用全局认证配置）
  const tokenKeys = ['token']
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
  const tokenKeys = ['token'] as const
  const config: Record<string, string> = {}
  
  tokenKeys.forEach(key => {
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
  const tokenKeys = ['token'] as const
  return tokenKeys.some(key => !!localStorage.getItem(key))
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
    const stored = localStorage.getItem('userInfo')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

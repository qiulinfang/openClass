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

  // 2. 设置认证Token - 优先级：initData > Android Bridge > 本地存储
  let token = ''
  
  // 首先尝试从传入的配置数据中获取
  if (initData && typeof initData === 'object' && 'token' in initData) {
    token = (initData as { token?: string }).token || ''
    console.log('🔑 从配置数据获取Token:', token ? `${token.substring(0, 10)}...` : '空')
  }
  
  // 如果配置数据中没有，尝试从 Android Bridge 获取
  if (!token) {
    token = androidBridge.getUserToken()
  }
  
  // 如果还是没有，尝试从本地存储获取
  if (!token) {
    token = localStorage.getItem('token') || ''
  }
  
  if (token) {
    httpClient.setAuthToken(token)
  }
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

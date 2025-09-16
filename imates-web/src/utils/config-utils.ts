/**
 * 配置工具函数
 * 简单的配置初始化和管理
 */

import { httpClient } from '../services/http-client'
import { androidBridge } from '../services/android-bridge'
import { setBaseUrl } from '../services/api-endpoints'

/**
 * 初始化应用配置
 */
export async function initializeAppConfig(initData: unknown = {}) {
  // 1. 设置API基础URL - 同时设置两个地方
  const baseUrl = "http://www.imates.com.cn:8222/blw-edu-service-alc"
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
    console.log('🔑 从Android Bridge获取Token:', token ? `${token.substring(0, 10)}...` : '空')
    console.log('🔑 Android Bridge 可用性:', androidBridge.isAndroidBridgeAvailable())
  }
  
  // 如果还是没有，尝试从本地存储获取
  if (!token) {
    token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || ''
    console.log('🔑 从本地存储获取Token:', token ? `${token.substring(0, 10)}...` : '空')
  }
  
  if (token) {
    httpClient.setAuthToken(token)
    console.log('🔑 Token 已设置到 HTTP 客户端')
  } else {
    console.warn('🔑 警告：未获取到有效的 Token，API 请求可能失败')
  }
  
  // 3. 处理传入的初始化数据（如果需要的话）
  if (initData && typeof initData === 'object') {
    console.log('初始化配置数据:', initData)
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

/**
 * 配置工具函数
 * 简单的配置初始化和管理
 */

import { httpClient } from '../services/http-client'
import { androidBridge } from '../services/android-bridge'

/**
 * 初始化应用配置
 */
export async function initializeAppConfig(initData: any = {}) {
  // 1. 设置API基础URL
  httpClient.setBaseURL("http://www.imates.com.cn:8222/blw-edu-service-alc")

  // 2. 设置认证Token
  const token = androidBridge.getUserToken()
  if (token) {
    httpClient.setAuthToken(token)
  }
}

/**
 * 获取用户信息
 */
export function getUserInfo(initData: any = {}) {
  // 优先级：Android Bridge > initData > 本地存储
  if (androidBridge.isAndroidBridgeAvailable()) {
    const userInfo = androidBridge.getUserInfo()
    if (userInfo?.userId) return userInfo
  }

  if (initData?.userInfo?.userId) {
    return initData.userInfo
  }

  try {
    const stored = localStorage.getItem('userInfo')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

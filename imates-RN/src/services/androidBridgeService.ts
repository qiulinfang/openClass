/**
 * Android Bridge 服务
 * 封装 React Native Native Modules，提供统一的原生功能接口
 * 
 * ⚠️ 重要说明：
 * 本服务用于与原生 Android 应用集成（如嵌入到现有原生应用中）。
 * 
 * 如果是纯 RN 应用（独立运行，不依赖原生代码），则不需要此桥接服务。
 * 纯 RN 应用可以直接使用：
 * - AsyncStorage 存储数据
 * - RN 的 Toast 或 Alert 显示提示
 * - RN 组件库实现功能
 * 
 * 使用场景：
 * 1. RN 嵌入到现有 Android 应用中（需要状态同步）
 * 2. 需要调用原生后台服务或系统 API
 * 3. 需要与原生 ViewModel 集成
 * 
 * 注意：在React Native中，需要创建对应的Native Module（AndroidBridgeModule.java）
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native'

const { AndroidBridge } = NativeModules
const eventEmitter = AndroidBridge ? new NativeEventEmitter(AndroidBridge) : null

export interface UserInfo {
  id: string
  name: string
  avatar?: string
  [key: string]: unknown
}

/**
 * Android Bridge 服务类
 * 封装原生模块调用，提供统一接口
 */
export class AndroidBridgeService {
  /**
   * 检查 Android Bridge 是否可用
   */
  static isAvailable(): boolean {
    return Platform.OS === 'android' && AndroidBridge !== null && AndroidBridge !== undefined
  }

  /**
   * 获取用户信息
   * @returns Promise<UserInfo | null> 用户信息
   */
  static async getUserInfo(): Promise<UserInfo | null> {
    try {
      if (!this.isAvailable() || !AndroidBridge.getUserInfo) {
        return null
      }
      const result = await AndroidBridge.getUserInfo()
      return result ? JSON.parse(result) : null
    } catch (error) {
      console.error('[AndroidBridge] ❌ 获取用户信息失败:', error)
      return null
    }
  }

  /**
   * 同步用户信息到原生
   * 第1步：检查Android Bridge是否可用
   * 第2步：调用原生方法同步用户信息
   * 第3步：返回同步结果
   * 
   * @param userId 用户ID
   * @param token 用户Token
   * @param password 用户密码（可选）
   * @returns Promise<boolean> 同步是否成功
   */
  static async syncUserInfo(
    userId: string,
    token: string,
    password?: string
  ): Promise<boolean> {
    try {
      // 第1步：检查Android Bridge是否可用
      if (!this.isAvailable() || !AndroidBridge.syncUserInfo) {
        console.warn('[AndroidBridge] ⚠️ Android Bridge不可用，跳过同步')
        return false
      }

      // 第2步：调用原生方法同步用户信息
      await AndroidBridge.syncUserInfo(userId, token, password || '')
      
      // 第3步：返回同步结果
      return true
    } catch (error) {
      console.error('[AndroidBridge] ❌ 同步用户信息失败:', error)
      return false
    }
  }

  /**
   * 显示Toast消息
   */
  static showToast(message: string): void {
    try {
      if (this.isAvailable() && AndroidBridge.showToast) {
        AndroidBridge.showToast(message)
      }
    } catch (error) {
      console.error('[AndroidBridge] ❌ 显示Toast失败:', error)
    }
  }

  /**
   * 监听原生事件
   * @param eventName 事件名称
   * @param callback 回调函数
   */
  static addEventListener(
    eventName: string,
    callback: (data: unknown) => void
  ): void {
    if (eventEmitter) {
      eventEmitter.addListener(eventName, callback)
    }
  }

  /**
   * 移除事件监听
   * @param eventName 事件名称
   * @param callback 回调函数
   */
  static removeEventListener(
    eventName: string,
    callback: (data: unknown) => void
  ): void {
    if (eventEmitter) {
      eventEmitter.removeListener(eventName, callback)
    }
  }

  /**
   * 获取用户Token
   * @returns Promise<string> 用户Token
   */
  static async getUserToken(): Promise<string> {
    try {
      if (!this.isAvailable() || !AndroidBridge.getUserToken) {
        return ''
      }
      const result = await AndroidBridge.getUserToken()
      return result || ''
    } catch (error) {
      console.error('[AndroidBridge] ❌ 获取用户Token失败:', error)
      return ''
    }
  }

  /**
   * 显示通知
   * @param message 通知内容
   * @param type 通知类型：success, error, warning, info
   */
  static showNotification(message: string, type: string = 'info'): void {
    try {
      if (this.isAvailable() && AndroidBridge.showNotification) {
        AndroidBridge.showNotification(message, type)
      } else {
        // 降级到Toast
        this.showToast(message)
      }
    } catch (error) {
      console.error('[AndroidBridge] ❌ 显示通知失败:', error)
    }
  }

  /**
   * 退出当前Activity
   */
  static exitActivity(): void {
    try {
      if (this.isAvailable() && AndroidBridge.exitActivity) {
        AndroidBridge.exitActivity()
      }
    } catch (error) {
      console.error('[AndroidBridge] ❌ 退出Activity失败:', error)
    }
  }
}


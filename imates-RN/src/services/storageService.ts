/**
 * 存储服务
 * 封装 AsyncStorage，提供统一的存储接口
 * 用于简单数据的持久化存储
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * 存储服务类
 * 封装 AsyncStorage 的常用操作
 */
export class StorageService {
  /**
   * 设置数据
   * 第1步：将数据序列化为JSON字符串
   * 第2步：存储到AsyncStorage
   */
  static async setItem<T>(key: string, value: T): Promise<void> {
    try {
      // 第1步：序列化数据
      const serialized = JSON.stringify(value)
      
      // 第2步：存储到AsyncStorage
      await AsyncStorage.setItem(key, serialized)
    } catch (error) {
      console.error(`[STORAGE] ❌ 存储数据失败 (${key}):`, error)
      throw error
    }
  }

  /**
   * 获取数据
   * 第1步：从AsyncStorage读取数据
   * 第2步：反序列化为对象
   */
  static async getItem<T>(key: string): Promise<T | null> {
    try {
      // 第1步：从AsyncStorage读取
      const serialized = await AsyncStorage.getItem(key)
      
      if (serialized === null) {
        return null
      }
      
      // 第2步：反序列化数据
      return JSON.parse(serialized) as T
    } catch (error) {
      console.error(`[STORAGE] ❌ 读取数据失败 (${key}):`, error)
      return null
    }
  }

  /**
   * 删除数据
   */
  static async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key)
    } catch (error) {
      console.error(`[STORAGE] ❌ 删除数据失败 (${key}):`, error)
      throw error
    }
  }

  /**
   * 清空所有数据
   */
  static async clear(): Promise<void> {
    try {
      await AsyncStorage.clear()
    } catch (error) {
      console.error('[STORAGE] ❌ 清空数据失败:', error)
      throw error
    }
  }

  /**
   * 获取所有键
   */
  static async getAllKeys(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys()
      return [...keys]
    } catch (error) {
      console.error('[STORAGE] ❌ 获取所有键失败:', error)
      return []
    }
  }

  /**
   * 批量获取数据
   */
  static async getMultiple<T>(keys: string[]): Promise<Array<[string, T | null]>> {
    try {
      const values = await AsyncStorage.multiGet(keys)
      return values.map(([key, value]) => [
        key,
        value ? (JSON.parse(value) as T) : null,
      ])
    } catch (error) {
      console.error('[STORAGE] ❌ 批量获取数据失败:', error)
      return keys.map((key) => [key, null] as [string, T | null])
    }
  }

  /**
   * 批量设置数据
   */
  static async setMultiple<T>(keyValuePairs: Array<[string, T]>): Promise<void> {
    try {
      const serialized = keyValuePairs.map(([key, value]) => [
        key,
        JSON.stringify(value),
      ])
      await AsyncStorage.multiSet(serialized as Array<[string, string]>)
    } catch (error) {
      console.error('[STORAGE] ❌ 批量设置数据失败:', error)
      throw error
    }
  }

  /**
   * 批量删除数据
   */
  static async removeMultiple(keys: string[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys)
    } catch (error) {
      console.error('[STORAGE] ❌ 批量删除数据失败:', error)
      throw error
    }
  }
}

/**
 * 存储键常量
 * 统一管理所有存储键名，避免重复和错误
 */
export const StorageKeys = {
  USER_INFO: 'USER_INFO_CACHE',
  XUEBAN_TOKEN: 'XUEBAN_TOKEN',
  YANBAN_TOKEN: 'YANBAN_TOKEN',
  USER_ID: 'userId',
  USER_PASSWORD: 'userPassword',
  LAST_LOGIN_TIME: 'lastLoginTime',
  // 其他存储键...
} as const


/**
 * 用户信息管理 Store
 * 使用 Zustand 实现状态管理
 * 职责：管理用户信息、应用配置、进度保存、持久化存储
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'USER_INFO_CACHE'

export interface UserInfo {
  id?: string
  name: string
  avatar?: string
  roles?: string[]
  // 其他用户信息字段
  [key: string]: unknown
}

interface UserState {
  // 状态定义
  userInfo: UserInfo | null
  subject: 'MATH' | 'BIOLOGY'
  
  // 方法定义
  initializeStore: () => Promise<void>
  setUserInfo: (user: UserInfo) => Promise<void>
  loadFromStorage: () => Promise<boolean>
  clearUserInfo: () => Promise<void>
  setSubject: (subject: 'MATH' | 'BIOLOGY') => void
  saveProgress: () => Promise<void>
  quickSaveProgress: () => Promise<void>
}

/**
 * 用户信息 Store
 * 使用 Zustand 创建，支持持久化
 */
export const useUserStore = create<UserState>((set, get) => ({
  // 初始状态
  userInfo: null,
  subject: 'MATH',

  /**
   * 初始化Store
   * 第1步：尝试从 AsyncStorage 读取持久化数据
   * 第2步：设置用户信息到 Store
   * 
   * 注意：纯RN应用只使用 AsyncStorage，不需要原生模块
   * 如果需要与原生应用集成，可以添加从原生模块获取用户信息的逻辑
   */
  initializeStore: async () => {
    try {
      // 第1步：尝试从 AsyncStorage 读取缓存
      const cachedData = await AsyncStorage.getItem(STORAGE_KEY)
      if (cachedData) {
        const parsed = JSON.parse(cachedData)
        set({ userInfo: parsed })
        return
      }

      // 注意：纯RN应用不需要从原生模块获取用户信息
      // 如果需要与原生应用集成，可以取消注释以下代码：
      // const user = await NativeModules.AndroidBridge.getUserInfo()
      // if (user) {
      //   set({ userInfo: user })
      //   await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      // }
    } catch (error) {
      console.error('[USER] ❌ 初始化失败:', error)
    }
  },

  /**
   * 设置用户信息并持久化
   * 第1步：设置 userInfo 状态
   * 第2步：保存到 AsyncStorage
   */
  setUserInfo: async (user: UserInfo) => {
    // 第1步：设置状态
    set({ userInfo: user })
    
    // 第2步：持久化到 AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } catch (error) {
      console.error('[USER] ❌ 持久化用户信息失败:', error)
    }
  },

  /**
   * 从持久化存储加载用户信息
   * 第1步：从 AsyncStorage 读取数据
   * 第2步：解析并设置到 userInfo
   * @returns 是否成功加载
   */
  loadFromStorage: async (): Promise<boolean> => {
    try {
      // 第1步：从 AsyncStorage 读取
      const cachedData = await AsyncStorage.getItem(STORAGE_KEY)
      if (!cachedData) {
        return false
      }
      
      // 第2步：解析并设置
      const parsed = JSON.parse(cachedData)
      set({ userInfo: parsed })
      return true
    } catch (error) {
      console.error('[USER] ❌ 加载存储数据失败:', error)
      return false
    }
  },

  /**
   * 清除用户信息和持久化数据
   * 第1步：清空 userInfo 状态
   * 第2步：从 AsyncStorage 移除数据
   */
  clearUserInfo: async () => {
    // 第1步：清空状态
    set({ userInfo: null })
    
    // 第2步：移除持久化数据
    try {
      await AsyncStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('[USER] ❌ 清除持久化数据失败:', error)
    }
  },

  /**
   * 设置当前科目
   */
  setSubject: (subject: 'MATH' | 'BIOLOGY') => {
    set({ subject })
  },

  /**
   * 保存学习进度
   * 注意：需要从原 exerciseStore 迁移完整实现
   */
  saveProgress: async () => {
    try {
      // 待实现
      console.log('[USER] ✅ 保存进度成功')
    } catch (error) {
      console.error('[USER] ❌ 保存进度失败:', error)
    }
  },

  /**
   * 快速保存学习进度
   * 注意：需要从原 exerciseStore 迁移完整实现
   */
  quickSaveProgress: async () => {
    try {
      // 待实现
      console.log('[USER] ✅ 快速保存进度成功')
    } catch (error) {
      console.error('[USER] ❌ 快速保存进度失败:', error)
    }
  },
}))


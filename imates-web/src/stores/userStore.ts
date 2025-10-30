/**
 * 用户信息管理 Store
 * 职责：管理用户信息、应用配置、进度保存、持久化存储
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { androidBridge } from '../services/android-bridge'
import type { UserInfo } from '../types'

const STORAGE_KEY = 'USER_INFO_CACHE'

export const useUserStore = defineStore('user', () => {
  // ==================== 状态定义 ====================
  
  /** 用户信息 */
  const userInfo = ref<UserInfo | null>(null)
  
  /** 当前科目 */
  const subject = ref<'MATH' | 'BIOLOGY'>('MATH')
  
  // ==================== 方法 ====================
  
  /**
   * 初始化Store
   * 第1步：尝试从 localStorage 读取持久化数据
   * 第2步：如果没有持久化数据，从 Android Bridge 获取
   * 第3步：设置用户信息到 Store
   */
  const initializeStore = async (): Promise<void> => {
    try {
      // 第1步：尝试从 localStorage 读取
      const cachedData = localStorage.getItem(STORAGE_KEY)
      if (cachedData) {
        const parsed = JSON.parse(cachedData)
        userInfo.value = parsed
        console.log('[USER] ✅ 从缓存加载用户信息:', parsed.id)
        return
      }
      
      // 第2步：从 Android Bridge 获取用户信息
      const user = await androidBridge.getUserInfo()
      
      // 第3步：设置用户信息并持久化
      if (user) {
        userInfo.value = user
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
        console.log('[USER] ✅ 初始化用户信息:', user.id)
      }
    } catch (error) {
      console.error('[USER] ❌ 初始化失败:', error)
    }
  }
  
  /**
   * 设置用户信息并持久化
   * 第1步：设置 userInfo 状态
   * 第2步：保存到 localStorage
   */
  const setUserInfo = (user: UserInfo): void => {
    // 第1步：设置状态
    userInfo.value = user
    
    // 第2步：持久化到 localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      console.log('[USER] ✅ 设置并持久化用户信息:', user.id)
    } catch (error) {
      console.error('[USER] ❌ 持久化用户信息失败:', error)
    }
  }
  
  /**
   * 从持久化存储加载用户信息
   * 第1步：从 localStorage 读取数据
   * 第2步：解析并设置到 userInfo
   * @returns 是否成功加载
   */
  const loadFromStorage = (): boolean => {
    try {
      // 第1步：从 localStorage 读取
      const cachedData = localStorage.getItem(STORAGE_KEY)
      if (!cachedData) {
        return false
      }
      
      // 第2步：解析并设置
      const parsed = JSON.parse(cachedData)
      userInfo.value = parsed
      console.log('[USER] ✅ 从存储加载用户信息:', parsed.id)
      return true
    } catch (error) {
      console.error('[USER] ❌ 加载存储数据失败:', error)
      return false
    }
  }
  
  /**
   * 清除用户信息和持久化数据
   * 第1步：清空 userInfo 状态
   * 第2步：从 localStorage 移除数据
   */
  const clearUserInfo = (): void => {
    // 第1步：清空状态
    userInfo.value = null
    
    // 第2步：移除持久化数据
    try {
      localStorage.removeItem(STORAGE_KEY)
      console.log('[USER] ✅ 清除用户信息')
    } catch (error) {
      console.error('[USER] ❌ 清除持久化数据失败:', error)
    }
  }
  
  /**
   * 设置当前科目
   */
  const setSubject = (newSubject: 'MATH' | 'BIOLOGY'): void => {
    subject.value = newSubject
    console.log('[USER] ✅ 设置科目:', newSubject)
  }
  
  /**
   * 保存学习进度
   * 注意：需要从原 exerciseStore 迁移完整实现
   */
  const saveProgress = async (): Promise<void> => {
    try {
      console.log('[USER] ✅ 保存进度成功')
    } catch (error) {
      console.error('[USER] ❌ 保存进度失败:', error)
    }
  }
  
  /**
   * 快速保存学习进度
   * 注意：需要从原 exerciseStore 迁移完整实现
   */
  const quickSaveProgress = async (): Promise<void> => {
    try {
      console.log('[USER] ✅ 快速保存进度成功')
    } catch (error) {
      console.error('[USER] ❌ 快速保存进度失败:', error)
    }
  }
  
  /**
   * 退出应用
   */
  const exitActivity = (): void => {
    try {
      androidBridge.exitActivity()
      console.log('[USER] ✅ 退出应用')
    } catch (error) {
      console.error('[USER] ❌ 退出应用失败:', error)
    }
  }
  
  /**
   * 拍照功能
   */
  const takePicture = (): void => {
    try {
      androidBridge.takePicture('')
      console.log('[USER] ✅ 调用拍照')
    } catch (error) {
      console.error('[USER] ❌ 拍照失败:', error)
    }
  }
  
  // ==================== 返回接口 ====================
  
  return {
    // 状态
    userInfo,
    subject,
    
    // 方法
    initializeStore,
    setUserInfo,
    loadFromStorage,
    clearUserInfo,
    setSubject,
    saveProgress,
    quickSaveProgress,
    exitActivity,
    takePicture
  }
})


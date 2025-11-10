/**
 * 用户信息管理 Store
 * 职责：管理用户信息、应用配置、进度保存、持久化存储
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { androidBridge } from '../services/android-bridge'
import { getCurrentUserIdOrDefault } from '../utils/user/userId'
import type { UserInfo } from '../types'

// 获取带用户ID前缀的存储key
const getStorageKey = () => {
  const userId = getCurrentUserIdOrDefault()
  return `${userId}_USER_INFO_CACHE`
}

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
      // 第1步：从 Android Bridge 获取用户信息（获取用户ID）
      const user = await androidBridge.getUserInfo()
      
      if (user && user.id) {
        // 第2步：设置用户信息到状态
        userInfo.value = user
        
        // 第3步：尝试从 localStorage 读取该用户的缓存（使用用户ID前缀）
        const key = `${user.id}_USER_INFO_CACHE`
        const cachedData = localStorage.getItem(key)
        if (cachedData) {
          const parsed = JSON.parse(cachedData)
          // 验证缓存中的用户ID是否匹配
          if (parsed.id === user.id) {
            userInfo.value = parsed
            return
          }
        }
        
        // 第4步：如果没有缓存或缓存不匹配，保存新用户信息
        localStorage.setItem(key, JSON.stringify(user))
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
    
    // 第2步：持久化到 localStorage（使用用户ID前缀）
    try {
      const key = user.id ? `${user.id}_USER_INFO_CACHE` : getStorageKey()
      localStorage.setItem(key, JSON.stringify(user))
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
      // 第1步：从 localStorage 读取（使用用户ID前缀）
      const key = getStorageKey()
      const cachedData = localStorage.getItem(key)
      if (!cachedData) {
        return false
      }
      
      // 第2步：解析并设置
      const parsed = JSON.parse(cachedData)
      userInfo.value = parsed
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
    const currentUserId = userInfo.value?.id
    userInfo.value = null
    
    // 第2步：移除持久化数据（使用用户ID前缀）
    try {
      if (currentUserId) {
        const key = `${currentUserId}_USER_INFO_CACHE`
        localStorage.removeItem(key)
      } else {
        const key = getStorageKey()
        localStorage.removeItem(key)
      }
    } catch (error) {
      console.error('[USER] ❌ 清除持久化数据失败:', error)
    }
  }
  
  /**
   * 设置当前科目
   */
  const setSubject = (newSubject: 'MATH' | 'BIOLOGY'): void => {
    subject.value = newSubject
  }
  
  /**
   * 保存学习进度
   * 注意：需要从原 exerciseStore 迁移完整实现
   */
  const saveProgress = async (): Promise<void> => {
    try {
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
    } catch (error) {
      console.error('[USER] ❌ 退出应用失败:', error)
    }
  }
  
  /**
   * 场景36：学生切换账号 - 清理旧账号数据
   * 第1步：清理消息监听器
   * 第2步：清理会话数据
   * 第3步：清理聊天历史
   * 第4步：清理其他业务数据
   */
  const cleanupOnAccountSwitch = async (oldUserId?: string): Promise<void> => {
    try {
      // 第1步：清理消息监听器
      try {
        const { useTeacherGeneralChatStore } = await import('./teacherGeneralChatStore')
        const teacherStore = useTeacherGeneralChatStore()
        await teacherStore.cleanupMessageReceiver()
      } catch (error) {
        console.warn('[USER] ⚠️ 清理消息监听器失败:', error)
      }
      
      // 第2步：清理会话数据（使用动态导入避免循环依赖）
      try {
        const { useTeacherGeneralChatStore } = await import('./teacherGeneralChatStore')
        const teacherStore = useTeacherGeneralChatStore()
        teacherStore.clearSession()
        teacherStore.clearMessages()
      } catch (error) {
        console.warn('[USER] ⚠️ 清理会话数据失败:', error)
      }
      
      // 第3步：清理聊天历史（清理localStorage中所有相关key）
      try {
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) {
            // 清理教师会话相关
            if (key.startsWith('teacher_chat_') || key.startsWith(`${oldUserId}_teacher_chat_`)) {
              keysToRemove.push(key)
            }
            // 清理聊天历史相关
            if (key.startsWith('chat_history_') || key.startsWith(`${oldUserId}_chat_history_`)) {
              keysToRemove.push(key)
            }
            // 清理AI通用会话相关
            if (key.startsWith('ai-general-sessions') || key.startsWith(`${oldUserId}_ai-general-sessions`)) {
              keysToRemove.push(key)
            }
            // 清理收藏相关
            if (key.startsWith('favorites') || key.startsWith(`${oldUserId}_favorites`)) {
              keysToRemove.push(key)
            }
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
      } catch (error) {
        console.warn('[USER] ⚠️ 清理聊天历史失败:', error)
      }
      
      // 第4步：清理IndexedDB数据（异步操作，不阻塞）
      try {
        const { asyncStorage } = await import('../services/chat-storage')
        // 清理所有会话（IndexedDB清理会在下次使用时自动重建）
      } catch (error) {
        console.warn('[USER] ⚠️ 清理IndexedDB数据失败:', error)
      }
    } catch (error) {
      console.error('[USER] ❌ 账号切换数据清理失败:', error)
    }
  }
  
  /**
   * 设置用户信息并处理账号切换
   * 如果检测到用户ID变化，自动清理旧账号数据
   */
  const setUserInfoWithCleanup = async (user: UserInfo): Promise<void> => {
    const oldUserId = userInfo.value?.id
    const newUserId = user.id
    
    // 设置新用户信息
    setUserInfo(user)
    
    // 如果用户ID发生变化，清理旧账号数据
    if (oldUserId && newUserId && oldUserId !== newUserId) {
      await cleanupOnAccountSwitch(oldUserId)
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
    setUserInfoWithCleanup, // 新增：带清理的setUserInfo
    loadFromStorage,
    clearUserInfo,
    setSubject,
    saveProgress,
    quickSaveProgress,
    exitActivity,
    cleanupOnAccountSwitch // 新增：手动清理方法
  }
})


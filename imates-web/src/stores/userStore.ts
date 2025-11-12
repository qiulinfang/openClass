/**
 * 用户信息管理 Store
 * 职责：管理用户信息、应用配置、进度保存、持久化存储
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserInfo } from '../types'
import { androidBridge } from '../services/android-bridge'
import {
  getUserInfo as getAuthUserInfo,
  setUserInfo as setAuthUserInfo
} from '../utils/user/authStorage'

export const useUserStore = defineStore('user', () => {
  // ==================== 状态定义 ====================
  
  /** 用户信息 */
  const userInfo = ref<UserInfo | null>(null)
  
  /** 当前科目 */
  const subject = ref<'MATH' | 'BIOLOGY'>('MATH')
  
  // ==================== 方法 ====================
  
  /**
   * 初始化Store
   * 第1步：尝试从统一存储读取持久化数据
   * 第2步：等待外部通过 setUserInfo 注入最新用户信息
   */
  const initializeStore = async (): Promise<void> => {
    try {
      // 从统一存储加载
      loadFromStorage()
    } catch (error) {
      console.error('[USER] ❌ 初始化失败:', error)
    }
  }
  
  /**
   * 设置用户信息并持久化
   * 第1步：设置 userInfo 状态
   * 第2步：保存到统一存储
   */
  const setUserInfo = (user: UserInfo): void => {
    // 第1步：设置状态
    userInfo.value = user
    
    // 第2步：持久化到统一存储
    try {
      setAuthUserInfo(user)
    } catch (error) {
      console.error('[USER] ❌ 持久化用户信息失败:', error)
    }
  }
  
  /**
   * 从持久化存储加载用户信息
   * 第1步：从统一存储读取数据
   * 第2步：设置到 userInfo
   * @returns 是否成功加载
   */
  const loadFromStorage = (): boolean => {
    try {
      // 第1步：从统一存储读取
      const cachedUserInfo = getAuthUserInfo()
      if (!cachedUserInfo) {
        return false
      }
      
      // 第2步：设置到状态
      userInfo.value = cachedUserInfo
      return true
    } catch (error) {
      console.error('[USER] ❌ 加载存储数据失败:', error)
      return false
    }
  }
  
  /**
   * 清除用户信息和持久化数据
   * 第1步：清空 userInfo 状态
   * 第2步：从统一存储移除用户信息（但保留其他身份数据如token）
   */
  const clearUserInfo = (): void => {
    // 第1步：清空状态
    userInfo.value = null
    
    // 第2步：从统一存储移除用户信息（但保留其他身份数据）
    try {
      setAuthUserInfo(null)
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
      // TODO: 如需清理 IndexedDB，可在此处补充实现
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


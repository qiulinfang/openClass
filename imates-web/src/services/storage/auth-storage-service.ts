/**
 * 用户认证信息存储服务
 * 提供用户信息的读取和保存功能
 * 包含原 userStore 的所有功能
 */

import type { UserInfo } from '@/types'

const STORAGE_KEY = 'userInfo'
const SUBJECT_STORAGE_KEY = 'currentSubject'
const CURRENT_USER_ID_KEY = 'CURRENT_USER_ID'
const CURRENT_USER_TYPE_KEY = 'CURRENT_USER_TYPE'

/**
 * 用户类型枚举
 */
export enum UserType {
  /** 学班管理员 */
  XUEBAN = 'XUEBAN',
  /** 研伴学生 */
  YANBAN = 'YANBAN'
}

/**
 * 清理字符串值，过滤无效值
 */
const sanitize = (value: string | null | undefined): string | null => {
  if (!value || value === 'undefined' || value.trim() === '') {
    return null
  }
  return value
}

/**
 * 用户认证信息存储服务类
 */
export class AuthStorageService {
  private static instance: AuthStorageService

  private constructor() {}

  /**
   * 获取服务单例实例
   */
  static getInstance(): AuthStorageService {
    if (!AuthStorageService.instance) {
      AuthStorageService.instance = new AuthStorageService()
    }
    return AuthStorageService.instance
  }

  /**
   * 获取用户信息
   * 第1步：从localStorage读取存储的用户信息
   * 第2步：解析JSON数据
   * 第3步：返回用户信息或null
   * @returns UserInfo | null 用户信息，如果不存在则返回 null
   */
  getUserInfo(): UserInfo | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return null
      }
      return JSON.parse(stored) as UserInfo
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 读取用户信息失败:', error)
      return null
    }
  }

  /**
   * 设置用户信息
   * 第1步：判断是否传入null
   * 第2步：如果为null则清除，否则保存到localStorage
   * @param userInfo UserInfo | null 用户信息，传入 null 表示清除用户信息
   */
  setUserInfo(userInfo: UserInfo | null): void {
    try {
      if (userInfo === null) {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo))
      }
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 保存用户信息失败:', error)
    }
  }

  /**
   * 获取用户ID（账号）
   * 第1步：优先从localStorage读取CURRENT_USER_ID（向后兼容）
   * 第2步：如果不存在，从localStorage读取userId
   * 第3步：返回用户ID或null
   * @returns string | null 用户ID，如果不存在则返回 null
   */
  getUserId(): string | null {
    try {
      // 优先读取 CURRENT_USER_ID（向后兼容 userId.ts）
      const currentUserId = sanitize(localStorage.getItem(CURRENT_USER_ID_KEY))
      if (currentUserId) {
        return currentUserId
      }
      // 回退到 userId
      return sanitize(localStorage.getItem('userId'))
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 读取用户ID失败:', error)
      return null
    }
  }

  /**
   * 获取当前用户ID，如果未登录则返回默认值
   * @param defaultValue 默认值，默认为'default'
   * @returns 用户ID或默认值
   */
  getCurrentUserIdOrDefault(defaultValue: string = 'default'): string {
    return this.getUserId() || defaultValue
  }

  /**
   * 获取当前用户类型
   * @returns 用户类型，如果未登录则返回null
   */
  getCurrentUserType(): UserType | null {
    try {
      const userType = localStorage.getItem(CURRENT_USER_TYPE_KEY)
      if (userType === UserType.XUEBAN || userType === UserType.YANBAN) {
        return userType as UserType
      }
      return null
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 读取用户类型失败:', error)
      return null
    }
  }

  /**
   * 设置当前登录用户ID和类型
   * @param userId 用户ID
   * @param userType 用户类型
   */
  setCurrentUserId(userId: string, userType: UserType): void {
    try {
      if (userId && userId !== 'undefined' && userId.trim() !== '') {
        const oldUserId = this.getUserId()
        const oldUserType = this.getCurrentUserType()
        
        localStorage.setItem(CURRENT_USER_ID_KEY, userId)
        localStorage.setItem(CURRENT_USER_TYPE_KEY, userType)
        
        // 同时设置 userId（向后兼容）
        localStorage.setItem('userId', userId)
        
        // 记录日志
        if (oldUserId !== userId || oldUserType !== userType) {
          console.log('[AUTH_STORAGE] 📝 设置当前用户ID:', {
            oldUserId,
            newUserId: userId,
            oldUserType,
            newUserType: userType,
            storageKeys: {
              userIdKey: CURRENT_USER_ID_KEY,
              userTypeKey: CURRENT_USER_TYPE_KEY
            },
            timestamp: new Date().toISOString()
          })
        }
      } else {
        console.warn('[AUTH_STORAGE] ⚠️ 尝试设置无效的userId:', {
          userId,
          userType,
          reason: !userId ? 'userId为空' : userId === 'undefined' ? 'userId为undefined字符串' : 'userId为空字符串'
        })
      }
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 设置用户ID失败:', error)
    }
  }

  /**
   * 获取带用户分区前缀的localStorage key
   * 用于存储用户相关的业务数据（如聊天记录、会话等）
   * @param suffix 后缀
   * @returns 带用户ID前缀的key
   */
  getScopedStorageKey(suffix: string): string {
    const userId = this.getUserId()
    return userId ? `${userId}_${suffix}` : suffix
  }

  /**
   * 获取带用户分区的localStorage值
   * @param suffix 后缀
   * @returns 存储的值，如果不存在则返回null
   */
  getScopedStorageValue(suffix: string): string | null {
    const scopedKey = this.getScopedStorageKey(suffix)
    return sanitize(localStorage.getItem(scopedKey))
  }

  /**
   * 为存储key添加用户ID前缀
   * @param key 原始key
   * @returns 带用户ID前缀的key
   */
  getStorageKeyWithUserId(key: string): string {
    const userId = this.getCurrentUserIdOrDefault()
    return `${userId}_${key}`
  }


  /**
   * 获取用户密码
   * 第1步：从localStorage读取userPassword
   * 第2步：返回用户密码或null
   * @returns string | null 用户密码，如果不存在则返回 null
   */
  getPassword(): string | null {
    try {
      return localStorage.getItem('userPassword')
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 读取用户密码失败:', error)
      return null
    }
  }

  /**
   * 获取研伴Token
   * 第1步：从localStorage读取YANBAN_TOKEN
   * 第2步：返回Token或null
   * @returns string | null 研伴Token，如果不存在则返回 null
   */
  getYanbanToken(): string | null {
    try {
      return localStorage.getItem('YANBAN_TOKEN')
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 读取研伴Token失败:', error)
      return null
    }
  }

  /**
   * 获取学班Token
   * 第1步：从localStorage读取XUEBAN_TOKEN
   * 第2步：返回Token或null
   * @returns string | null 学班Token，如果不存在则返回 null
   */
  getXuebanToken(): string | null {
    try {
      return localStorage.getItem('XUEBAN_TOKEN')
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 读取学班Token失败:', error)
      return null
    }
  }

  /**
   * 设置研伴Token
   * 第1步：判断是否传入null
   * 第2步：如果为null则清除，否则保存到localStorage
   * @param token string | null 研伴Token，传入 null 表示清除Token
   */
  setYanbanToken(token: string | null): void {
    try {
      if (token === null) {
        localStorage.removeItem('YANBAN_TOKEN')
      } else {
        localStorage.setItem('YANBAN_TOKEN', token)
      }
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 保存研伴Token失败:', error)
    }
  }

  /**
   * 设置学班Token
   * 第1步：判断是否传入null
   * 第2步：如果为null则清除，否则保存到localStorage
   * @param token string | null 学班Token，传入 null 表示清除Token
   */
  setXuebanToken(token: string | null): void {
    try {
      if (token === null) {
        localStorage.removeItem('XUEBAN_TOKEN')
      } else {
        localStorage.setItem('XUEBAN_TOKEN', token)
      }
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 保存学班Token失败:', error)
    }
  }

  /**
   * 获取当前科目
   * 第1步：从localStorage读取科目信息
   * 第2步：验证科目值是否有效
   * 第3步：返回科目或默认值'MATH'
   * @returns 'MATH' | 'BIOLOGY' 当前科目，默认为 'MATH'
   */
  getSubject(): 'MATH' | 'BIOLOGY' {
    try {
      const stored = localStorage.getItem(SUBJECT_STORAGE_KEY)
      if (stored === 'BIOLOGY' || stored === 'MATH') {
        return stored
      }
      return 'MATH'
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 读取科目失败:', error)
      return 'MATH'
    }
  }

  /**
   * 从持久化存储加载用户信息
   * 第1步：调用getUserInfo获取用户信息
   * 第2步：返回是否成功加载
   * @returns 是否成功加载
   */
  loadFromStorage(): boolean {
    try {
      const cachedUserInfo = this.getUserInfo()
      return cachedUserInfo !== null
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 加载存储数据失败:', error)
      return false
    }
  }

  /**
   * 初始化存储
   * 第1步：调用loadFromStorage加载数据
   * 第2步：处理可能的错误
   * 尝试从统一存储读取持久化数据
   */
  async initializeStore(): Promise<void> {
    try {
      this.loadFromStorage()
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 初始化失败:', error)
    }
  }

  /**
   * 场景36：学生切换账号 - 清理旧账号数据
   * 第1步：清理消息监听器
   * 第2步：清理会话数据
   * 第3步：清理聊天历史
   * 第4步：清理其他业务数据
   * @param oldUserId 旧用户ID
   */
  async cleanupOnAccountSwitch(oldUserId?: string): Promise<void> {
    try {
      // 第1步：清理消息监听器
      try {
        const { useTeacherGeneralChatStore } = await import('@/stores/teacherGeneralChatStore')
        const teacherStore = useTeacherGeneralChatStore()
        await teacherStore.cleanupMessageReceiver()
      } catch (error) {
        console.warn('[AUTH_STORAGE] ⚠️ 清理消息监听器失败:', error)
      }
      
      // 第2步：清理会话数据（使用动态导入避免循环依赖）
      try {
        const { useTeacherGeneralChatStore } = await import('@/stores/teacherGeneralChatStore')
        const teacherStore = useTeacherGeneralChatStore()
        teacherStore.clearSession()
        teacherStore.clearMessages()
      } catch (error) {
        console.warn('[AUTH_STORAGE] ⚠️ 清理会话数据失败:', error)
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
        console.warn('[AUTH_STORAGE] ⚠️ 清理聊天历史失败:', error)
      }
      
      // 第4步：清理IndexedDB数据（异步操作，不阻塞）
      // TODO: 如需清理 IndexedDB，可在此处补充实现
    } catch (error) {
      console.error('[AUTH_STORAGE] ❌ 账号切换数据清理失败:', error)
    }
  }

  /**
   * 设置用户信息并处理账号切换
   * 第1步：获取旧用户信息
   * 第2步：设置新用户信息
   * 第3步：如果用户ID发生变化，清理旧账号数据
   * 如果检测到用户ID变化，自动清理旧账号数据
   * @param user 用户信息
   */
  async setUserInfoWithCleanup(user: UserInfo): Promise<void> {
    const oldUserInfo = this.getUserInfo()
    const oldUserId = oldUserInfo?.id
    const newUserId = user.id
    
    // 设置新用户信息
    this.setUserInfo(user)
    
    // 如果用户ID发生变化，清理旧账号数据
    if (oldUserId && newUserId && oldUserId !== newUserId) {
      await this.cleanupOnAccountSwitch(oldUserId)
    }
  }
}

// 导出单例实例
export const authStorageService = AuthStorageService.getInstance()

// 为了保持向后兼容，导出便捷函数（这些函数内部调用服务实例）
export const getUserInfo = () => authStorageService.getUserInfo()
export const setUserInfo = (userInfo: UserInfo | null) => authStorageService.setUserInfo(userInfo)
export const getUserId = () => authStorageService.getUserId()
export const getPassword = () => authStorageService.getPassword()
export const getYanbanToken = () => authStorageService.getYanbanToken()
export const getXuebanToken = () => authStorageService.getXuebanToken()
export const setYanbanToken = (token: string | null) => authStorageService.setYanbanToken(token)
export const setXuebanToken = (token: string | null) => authStorageService.setXuebanToken(token)
export const getSubject = () => authStorageService.getSubject()
export const loadFromStorage = () => authStorageService.loadFromStorage()
export const initializeStore = () => authStorageService.initializeStore()
export const cleanupOnAccountSwitch = (oldUserId?: string) => authStorageService.cleanupOnAccountSwitch(oldUserId)
export const setUserInfoWithCleanup = (user: UserInfo) => authStorageService.setUserInfoWithCleanup(user)


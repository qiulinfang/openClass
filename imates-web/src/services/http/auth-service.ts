import CryptoJS from 'crypto-js'
import { httpClient } from './http-client'
import { getCurrentEnvType, AppEnvType, getYanbanNativeEnabled } from '@/config/env-config'
import { AndroidBridge } from '../business/android-bridge'
import { showMessage } from '@/utils'
import type {
  UserInfo,
  XuebanLoginResponse,
  LoginResponse,
  LoginRequest,
  LoginData,
  ApiResponse,
} from '@/types'

export enum UserType {
  XUEBAN = 'XUEBAN',
  YANBAN = 'YANBAN'
}

const STORAGE_KEY = 'userInfo'
const SUBJECT_STORAGE_KEY = 'currentSubject'
const CURRENT_USER_ID_KEY = 'CURRENT_USER_ID'
const CURRENT_USER_TYPE_KEY = 'CURRENT_USER_TYPE'

const sanitize = (value: string | null | undefined): string | null => {
  if (!value || value === 'undefined' || value.trim() === '') {
    return null
  }
  return value
}

export const getUserId = (): string | null => sanitize(localStorage.getItem('userId'))
export const getPassword = (): string | null => sanitize(localStorage.getItem('userPassword'))
export const getYanbanToken = (): string | null => sanitize(localStorage.getItem('YANBAN_TOKEN'))
export const getXuebanToken = (): string | null => sanitize(localStorage.getItem('XUEBAN_TOKEN'))
export const setYanbanToken = (token: string | null): void => {
  if (token === null) localStorage.removeItem('YANBAN_TOKEN')
  else localStorage.setItem('YANBAN_TOKEN', token)
}
export const setXuebanToken = (token: string | null): void => {
  if (token === null) localStorage.removeItem('XUEBAN_TOKEN')
  else localStorage.setItem('XUEBAN_TOKEN', token)
}
export const getCurrentUserId = (): string | null => sanitize(localStorage.getItem(CURRENT_USER_ID_KEY))
export const getCurrentUserType = (): UserType | null => {
  const v = sanitize(localStorage.getItem(CURRENT_USER_TYPE_KEY))
  if (v === UserType.XUEBAN || v === UserType.YANBAN) return v as UserType
  return null
}

export const getCurrentYanbanUserId = (): string | null => {
  return sanitize(getCurrentUserId() || localStorage.getItem('studentUserId'))
}

export const isYanbanLoggedIn = (): boolean => {
  const token = getYanbanToken()
  const userId = getCurrentYanbanUserId()
  return !!(token && userId)
}

export const getCurrentYanbanAuth = (): { token: string; username: string } | null => {
  const token = getYanbanToken()
  const userId = getCurrentYanbanUserId()

  if (token && userId) {
    return { token, username: userId }
  }
  return null
}
export const getCurrentUserIdOrDefault = (defaultValue: string = 'default'): string => {
  return getCurrentUserId() || getUserId() || defaultValue
}
export const getScopedStorageKey = (suffix: string): string => {
  const userId = getCurrentUserIdOrDefault()
  return `${userId}_${suffix}`
}
export const getScopedStorageValue = (suffix: string): string | null => {
  return sanitize(localStorage.getItem(getScopedStorageKey(suffix)))
}
export const setCurrentUser = (userId: string, userType: UserType): void => {
  if (!userId || userId === 'undefined' || userId.trim() === '') return
  localStorage.setItem(CURRENT_USER_ID_KEY, userId)
  localStorage.setItem(CURRENT_USER_TYPE_KEY, userType)
}
export const getSubject = (): 'MATH' | 'BIOLOGY' => {
  const stored = sanitize(localStorage.getItem(SUBJECT_STORAGE_KEY))
  if (stored === 'BIOLOGY' || stored === 'MATH') return stored
  return 'MATH'
}
export const getUserInfo = (): UserInfo | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as UserInfo
  } catch {
    return null
  }
}
export const loadFromStorage = (): boolean => {
  return getUserInfo() !== null
}
export const setUserInfo = (userInfo: UserInfo | null): void => {
  try {
    if (userInfo === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo))
  } catch {
  }
}

/**
 * 认证相关业务逻辑
 * - 统一处理 401 场景下的 Token 清理与自动重新登录
 * - 从 http-client 中抽离，避免 http-client 直接依赖 api-service
 */
export class AuthService {
  private static instance: AuthService
  private androidBridge: AndroidBridge

  private constructor() {
    this.androidBridge = AndroidBridge.getInstance()
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  /**
   * 处理 401 未授权错误：清理对应 token 并尝试自动重新登录
   * @param url 当前请求路径（相对路径，如 /permission/xxx 或 /blw-edu-yb/xxx）
   * @returns 是否自动登录成功
   */
  public async handle401(url: string): Promise<boolean> {
    try {
      showMessage('账号已在其他设备登录', 'warning', 2500)
    } catch {
    }

    this.forceLogoutToLogin()
    return false
  }

  private forceLogoutToLogin(): void {
    try {
      // 清理登录态信息，强制回到登录页
      localStorage.removeItem('XUEBAN_TOKEN')
      localStorage.removeItem('YANBAN_TOKEN')
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem('studentUserId')
      localStorage.removeItem(CURRENT_USER_ID_KEY)
      localStorage.removeItem(CURRENT_USER_TYPE_KEY)
      localStorage.removeItem('lastLoginTime')
    } catch {
    }

    try {
      const isOnLoginPage = typeof window !== 'undefined' && window.location?.hash?.includes('/login')
      if (!isOnLoginPage) {
        window.location.hash = '#/login'
      }
    } catch {
    }
  }

  /**
   * 根据接口路径清除对应的 token
   */
  private async clearTokenByPath(url: string): Promise<void> {
    if (url.startsWith('/permission') || url.startsWith('/admin/info') || url.startsWith('/biologyTopicKnowledge')) {
      // 学班管理员相关接口：清除 XUEBAN_TOKEN
      setXuebanToken(null)
    } else if (url.startsWith('/blw-edu-yb')) {
      // 研伴相关接口：清除 YANBAN_TOKEN
      setYanbanToken(null)
    }
  }

  /**
   * 尝试自动重新登录
   * - 从统一存储读取 userId / password
   * - 按路径选择学班或研伴登录
   * - 直接调用本类的登录方法刷新 token
   */
  private async tryAutoRelogin(url: string): Promise<boolean> {
    try {
      const userId = getUserId()
      const password = getPassword()

      // 没有有效凭据，无法自动登录
      if (!userId || !password || userId === 'undefined' || password === 'undefined') {
        return false
      }

      if (url.startsWith('/blw-edu-yb')) {
        // 研伴相关接口：使用研伴登录
        const loginResult = await this.loginYanban(userId, password)

        // 补充检查：只要成功写入了 YANBAN_TOKEN，也视为重新登录成功
        const token = getYanbanToken()
        const success = loginResult !== null || (token !== null && token !== 'undefined' && token.trim() !== '')

        if (!success) {
          console.warn('[AuthService] tryAutoRelogin 研伴登录失败', {
            userId,
            hasLoginResult: !!loginResult,
            hasTokenInStorage: !!token,
          })
        }

        return success
      } else if (
        url.startsWith('/permission') ||
        url.startsWith('/admin/info') ||
        url.startsWith('/biologyTopicKnowledge')
      ) {
        // 学班管理员相关接口：使用学班登录
        try {
          const token = await this.loginXueban(userId, password)
          return !!token
        } catch {
          return false
        }
      } else {
        // 其他接口：尝试通用登录（优先研伴登录）
        const loginResult = await this.loginYanban(userId, password)
        const token = getYanbanToken()
        const success = loginResult !== null || (token !== null && token !== 'undefined' && token.trim() !== '')

        if (!success) {
          console.warn('[AuthService] tryAutoRelogin 通用登录失败', {
            userId,
            hasLoginResult: !!loginResult,
            hasTokenInStorage: !!token,
          })
        }

        return success
      }
    } catch {
      return false
    }
  }

  /**
   * 自动登录功能
   * 从 localStorage 获取保存的用户凭据并尝试登录（目前针对研伴学生登录）
   * @param enableLogging 是否启用详细日志输出，默认为 false
   */
  public async autoLogin(enableLogging: boolean = false): Promise<boolean> {
    try {
      const userId = localStorage.getItem('userId')
      const password = localStorage.getItem('userPassword')

      if (!userId || !password || userId === 'undefined' || password === 'undefined' || userId.trim() === '' || password.trim() === '') {
        console.warn('[AuthService] autoLogin 略过：本地凭据无效', {
          hasUserId: !!userId,
          hasPassword: !!password,
          userIdValue: userId,
          passwordIsEmpty: !password || password.trim() === '',
        })
        return false
      }

      // 直接调用本类的 loginYanban 方法
      const loginResult = await this.loginYanban(userId, password)
      const token = getYanbanToken()

      // 判定成功条件：
      // 1）loginResult 不为 null，或
      // 2）已经在统一存储中成功写入了 YANBAN_TOKEN
      const success = !!loginResult || (token !== null && token !== 'undefined' && token.trim() !== '')

      if (!success) {
        console.warn('[AuthService] autoLogin 失败：既没有有效的 loginResult，也没有有效的 YANBAN_TOKEN', {
          userId,
          hasLoginResult: !!loginResult,
          hasTokenInStorage: !!token,
        })
        return false
      }

      // 更新登录时间戳
      localStorage.setItem('lastLoginTime', Date.now().toString())
      return true
    } catch (error) {
      console.warn('[AuthService] autoLogin 失败', error)
      return false 
    }
  }

  // ========== 认证相关方法（从 xueban-api / yanban-api 迁移） ==========

  /**
   * MD5加密 - 与Android端保持一致
   */
  private md5(input: string): string {
    return CryptoJS.MD5(input).toString()
  }

  /**
   * 研伴接口统一封装
   * - 解决测试环境 HTTPS 证书问题：测试环境可通过 AndroidBridge 走原生网络
   * - 保持与 Android 原生一致的分流策略：内部测试环境 + 有 AndroidBridge 时走原生网络
   * - 其他环境直接通过 httpClient 调用 Web 接口
   */
  private async callYanban<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
    const envType = getCurrentEnvType()

    const nativeEnabled = getYanbanNativeEnabled()
    const bridgeAvailable = this.androidBridge.isAndroidBridgeAvailable()
    const useNative = nativeEnabled && envType === AppEnvType.INTERNAL_TEST


    if (useNative && bridgeAvailable) {
      const apiPath = url.replace('/blw-edu-yb', '')
      const yanbanToken = getYanbanToken() || ''
      const result = await this.androidBridge.callYanbanApi(apiPath, body, 'POST', envType, yanbanToken)

      return {
        success: (result as any)?.success ?? false,
        data: ((result as any)?.data ?? result) as T,
        code: (result as any)?.code ?? ((result as any)?.success ? 200 : 0),
        message: (result as any)?.message,
      }
    }

    return httpClient.post<T>(url, body)
  }

  /**
   * 学伴登录
   * @param account 账号
   * @param password 密码（明文，与Android端LoginActivity保持一致）
   * @returns Promise<string> 返回token
   */
  public async loginXueban(account: string, password: string): Promise<string> {
    const response = await httpClient.post<XuebanLoginResponse>('/admin/login', {
      account,
      password,
    })

    if (!response.success) {
      throw new Error((response as any)?.data?.message || '登录失败')
    }

    const token = (response.data as any)?.data?.token
    if (!token) {
      throw new Error('登录失败：未获取到token')
    }

    localStorage.setItem('XUEBAN_TOKEN', token)
    localStorage.setItem('userId', account)
    localStorage.setItem('userPassword', password)
    localStorage.setItem('lastLoginTime', Date.now().toString())

    // 同步登录研伴系统获取YANBAN_TOKEN
    try {
      await this.loginYanban(account, password)
    } catch (yanbanError) {
      console.warn('[AuthService] ⚠️ 研伴登录失败，将在需要时自动重试:', yanbanError)
    }

    return token
  }

  /**
   * 获取用户信息
   * @param token 用户token
   * @returns Promise<UserInfo> 用户信息
   */
  public async getUserInfo(token: string): Promise<UserInfo> {
    const response = await httpClient.get<{
      success: boolean
      message: string
      data: UserInfo
    }>(`/admin/info?token=${token}`)

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取用户信息失败')
    }

    const userInfo = (response.data as any).data
    try {
      localStorage.setItem('userInfo', JSON.stringify(userInfo))
    } catch {
    }

    // 同步用户信息到Android原生ViewModel
    try {
      const userId = localStorage.getItem('userId')
      const userPassword = localStorage.getItem('userPassword')
      
      if (userId && token) {
        this.androidBridge.syncUserInfo(
          userId,
          token,
          userPassword || ''
        )
      }
    } catch {
    }

    // 同步到 userStore
    try {
      await this.setUserInfoWithCleanup(userInfo)
    } catch (storeError) {
      console.warn('[AuthService] ⚠️ 同步 userStore 失败:', storeError)
    }

    return userInfo
  }

  /**
   * 研伴学生登录 - 与Android端LearnResourceManager.login保持一致
   */
  public async loginYanban(account: string, password: string): Promise<LoginResponse | null> {
    try {
      const md5Password = this.md5(password)

      const loginRequest: LoginRequest = {
        account,
        password: md5Password,
      }

      const response = await this.callYanban<{
        code: number
        success: boolean
        message: string
        data: LoginData
      }>('/blw-edu-yb/auth/login-student', loginRequest)

      const respData = response.data as any
      const tokenData = respData?.data || respData

      if (response.success && tokenData && tokenData.token) {
        const loginResponse: LoginResponse = {
          token: tokenData.token,
          userId: tokenData.userId,
          defaultPassword: tokenData.defaultPassword,
        }

        try {
          localStorage.setItem('YANBAN_TOKEN', tokenData.token)
          localStorage.setItem('studentUserId', tokenData.userId)

          try {
            const effectiveUserId = tokenData.userId || account
            if (effectiveUserId) {
              setCurrentUser(effectiveUserId, UserType.YANBAN)
            }
          } catch {
          }

          localStorage.setItem('lastLoginTime', Date.now().toString())
        } catch {
        }

        return loginResponse
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * 检查学生登录状态
   */
  public isStudentLoggedIn(): boolean {
    const token = localStorage.getItem('YANBAN_TOKEN')
    const studentUserId = localStorage.getItem('studentUserId')
    return !!(
      token &&
      studentUserId &&
      token !== 'undefined' &&
      studentUserId !== 'undefined' &&
      token.trim() !== '' &&
      studentUserId.trim() !== ''
    )
  }

  /**
   * 学生登出
   */
  public logoutStudent(): void {
    localStorage.removeItem('YANBAN_TOKEN')
    localStorage.removeItem('studentUserId')
  }

  public async cleanupOnAccountSwitch(oldUserId?: string): Promise<void> {
    try {
      try {
        const { useTeacherGeneralChatStore } = await import('@/stores/teacherGeneralChatStore')
        const teacherStore = useTeacherGeneralChatStore()
        await teacherStore.cleanupMessageReceiver()
      } catch {
      }

      try {
        const { useTeacherGeneralChatStore } = await import('@/stores/teacherGeneralChatStore')
        const teacherStore = useTeacherGeneralChatStore()
        teacherStore.clearSession()
        teacherStore.clearMessages()
      } catch {
      }

      try {
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key) continue
          if (key.startsWith('teacher_chat_') || (oldUserId && key.startsWith(`${oldUserId}_teacher_chat_`))) {
            keysToRemove.push(key)
          }
          if (key.startsWith('chat_history_') || (oldUserId && key.startsWith(`${oldUserId}_chat_history_`))) {
            keysToRemove.push(key)
          }
          if (key.startsWith('ai-general-sessions') || (oldUserId && key.startsWith(`${oldUserId}_ai-general-sessions`))) {
            keysToRemove.push(key)
          }
          if (key.startsWith('favorites') || (oldUserId && key.startsWith(`${oldUserId}_favorites`))) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k))
      } catch {
      }
    } catch {
    }
  }

  public async setUserInfoWithCleanup(user: UserInfo): Promise<void> {
    const oldUserInfo = getUserInfo()
    const oldUserId = (oldUserInfo as any)?.id as string | undefined
    const newUserId = (user as any)?.id as string | undefined
    setUserInfo(user)
    if (oldUserId && newUserId && oldUserId !== newUserId) {
      await this.cleanupOnAccountSwitch(oldUserId)
    }
  }
}

export const authService = AuthService.getInstance()

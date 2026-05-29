import CryptoJS from 'crypto-js'
import { httpClient } from './http-client'
import { getApiPaths, getCurrentEnvType, AppEnvType } from '@/config/env-config'
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

const SUBJECT_STORAGE_KEY = 'currentSubject'

const sanitize = (value: string | null | undefined): string | null => {
  if (!value || value === 'undefined' || value.trim() === '') {
    return null
  }
  return value
}
// 学伴用户ID
export const getUserId = (): string | null => sanitize(localStorage.getItem('xuebanuserid'))
// 学伴用户密码
export const getPassword = (): string | null => sanitize(localStorage.getItem('userPassword'))
// 研伴用户Token
export const getYanbanToken = (): string | null => sanitize(localStorage.getItem('YANBAN_TOKEN'))
// 学伴用户Token
export const getXuebanToken = (): string | null => sanitize(localStorage.getItem('XUEBAN_TOKEN'))
// 设置研伴用户Token
export const setYanbanToken = (token: string | null): void => {
  if (token === null) localStorage.removeItem('YANBAN_TOKEN')
  else localStorage.setItem('YANBAN_TOKEN', token)
}
// 设置学伴用户Token
export const setXuebanToken = (token: string | null): void => {
  if (token === null) localStorage.removeItem('XUEBAN_TOKEN')
  else localStorage.setItem('XUEBAN_TOKEN', token)
}
// 获取当前研伴用户ID
export const getCurrentYanbanUserId = (): string | null => {
  return sanitize(localStorage.getItem('yanbanuserid'))
}

// 是否研伴登录
export const isYanbanLoggedIn = (): boolean => {
  const token = getYanbanToken()
  const userId = getCurrentYanbanUserId()
  return !!(token && userId)
}


// 获取当前研伴认证信息
export const getCurrentYanbanAuth = (): { token: string; username: string } | null => {
  const token = getYanbanToken()
  const userId = getCurrentYanbanUserId()

  if (token && userId) {
    return { token, username: userId }
  }
  return null
}
// 获取作用域存储键
export const getScopedStorageKey = (suffix: string): string => {
  const userId = getUserId() || 'default'
  const envType = getCurrentEnvType() || AppEnvType.RELEASE

  // 正式环境沿用旧 key，复用历史数据；测试环境增加环境维度做隔离
  if (envType === AppEnvType.RELEASE) {
    return `${userId}_${suffix}`
  }

  return `${userId}_${envType}_${suffix}`
}
// 获取作用域存储值
export const getScopedStorageValue = (suffix: string): string | null => {
  const newKey = getScopedStorageKey(suffix)
  const v = sanitize(localStorage.getItem(newKey))
  if (v !== null) return v

  // 兼容旧版本：历史 key 未包含环境维度
  const userId = getUserId() || 'default'
  const legacyKey = `${userId}_${suffix}`
  return sanitize(localStorage.getItem(legacyKey))
}
// 获取学科
export const getSubject = (): 'MATH' | 'BIOLOGY' => {
  const stored = sanitize(localStorage.getItem(SUBJECT_STORAGE_KEY))
  if (stored === 'BIOLOGY' || stored === 'MATH') return stored
  return 'MATH'
}
// 获取用户信息
export const getUserInfo = (): UserInfo | null => {
  try {
    const stored = localStorage.getItem('userInfo')
    if (!stored) return null
    return JSON.parse(stored) as UserInfo
  } catch {
    return null
  }
}
// 从存储加载
export const loadFromStorage = (): boolean => {
  return getUserInfo() !== null
}
// 设置用户信息
export const setUserInfo = (userInfo: UserInfo | null): void => {
  try {
    if (userInfo === null) localStorage.removeItem('userInfo')
    else localStorage.setItem('userInfo', JSON.stringify(userInfo))
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
  public async handle401(): Promise<boolean> {
    try {
      showMessage('账号已在其他设备登录', 'warning', 2500)
    } catch {
    }

    // 登录过期时断开 WebSocket 连接
    try {
      const { useTeacherChatStore } = await import('../../stores/teacherChatStore')
      const teacherStore = useTeacherChatStore()
      if (teacherStore.currentSessionId) {
        console.log('[AuthService] 登录过期，清除教师聊天会话')
        teacherStore.setCurrentSessionId(null)
        teacherStore.clearMessages()
      }
    } catch (error) {
      console.error('[AuthService] 断开 WebSocket 连接失败:', error)
    }

    this.forceLogoutToLogin()
    return false
  }

  private forceLogoutToLogin(): void {
    try {
      // 清理登录态信息，强制回到登录页
      localStorage.removeItem('XUEBAN_TOKEN')
      localStorage.removeItem('YANBAN_TOKEN')
      localStorage.removeItem('userInfo')
      localStorage.removeItem('yanbanuserid')
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
   * 退出登录
   */
  public logout(): void {
    this.forceLogoutToLogin()
  }

  /**
   * 根据接口路径清除对应的 token
   */
  private async clearTokenByPath(url: string): Promise<void> {
    if (
      url.startsWith(getApiPaths().xueban.permission.base) ||
      url.startsWith(getApiPaths().xueban.admin.info) ||
      url.startsWith(getApiPaths().xueban.biologyTopicKnowledge.base)
    ) {
      // 学伴管理员相关接口：清除 XUEBAN_TOKEN
      setXuebanToken(null)
    } else if (url.startsWith('/blw-edu-yb') || url.startsWith('/yb-test/blw-edu-yb')) {
      // 研伴相关接口：清除 YANBAN_TOKEN
      setYanbanToken(null)
    }
  }

  /**
   * 尝试自动重新登录
   * - 从统一存储读取 userId / password
   * - 按路径选择学伴或研伴登录
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

      if (url.startsWith('/blw-edu-yb') || url.startsWith('/yb-test/blw-edu-yb')) {
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
        url.startsWith(getApiPaths().xueban.permission.base) ||
        url.startsWith(getApiPaths().xueban.admin.info) ||
        url.startsWith(getApiPaths().xueban.biologyTopicKnowledge.base)
      ) {
        // 学伴管理员相关接口：使用学伴登录
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
    const bridgeAvailable = this.androidBridge.isAndroidBridgeAvailable()

    if (envType === AppEnvType.INTERNAL_TEST && bridgeAvailable) {
      const apiPath = url
        .replace('/yb-test/blw-edu-yb', '')
        .replace('/blw-edu-yb', '')
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
    const response = await httpClient.post<XuebanLoginResponse>(getApiPaths().xueban.admin.login, {
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
    localStorage.setItem('xuebanuserid', account)
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
    }>(`${getApiPaths().xueban.admin.info}?token=${token}`)

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取用户信息失败')
    }

    const userInfo = (response.data as any).data

    // 保留本地存储的自定义头像
    try {
      const existingUserInfo = localStorage.getItem('userInfo')
      if (existingUserInfo) {
        const parsed = JSON.parse(existingUserInfo)
        if (parsed.avatarNew) {
          userInfo.avatarNew = parsed.avatarNew
        }
      }
    } catch (error) {
      console.warn('[AuthService] 读取现有用户信息失败:', error)
    }

    try {
      localStorage.setItem('userInfo', JSON.stringify(userInfo))
    } catch {
    }

    // 同步用户信息到Android原生ViewModel
    try {
      const userId = localStorage.getItem('xuebanuserid')
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

      const endpoint = getApiPaths().yanban.auth.loginStudent

      const response = await this.callYanban<{
        code: number
        success: boolean
        message: string
        data: LoginData
      }>(endpoint, loginRequest)

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
          localStorage.setItem('yanbanuserid', tokenData.userId)


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


  public async cleanupOnAccountSwitch(oldUserId?: string): Promise<void> {
    try {
      // 账户切换时断开教师WebSocket连接（用户ID改变需要重新连接）
      try {
        const { useTeacherChatStore } = await import('../../stores/teacherChatStore')
        const teacherStore = useTeacherChatStore()
        teacherStore.setCurrentSessionId(null)
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

export const logout = () => authService.logout()

import { getUserId, getPassword, getYanbanToken, setXuebanToken, setYanbanToken } from '../storage/auth-storage-service'

/**
 * 认证相关业务逻辑
 * - 统一处理 401 场景下的 Token 清理与自动重新登录
 * - 从 http-client 中抽离，避免 http-client 直接依赖 api-service
 */
export class AuthService {
  private static instance: AuthService

  private constructor() {}

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
      await this.clearTokenByPath(url)
      const loginSuccess = await this.tryAutoRelogin(url)
      return loginSuccess
    } catch {
      return false
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
   * - 调用 api-service 中的登录接口刷新 token
   */
  private async tryAutoRelogin(url: string): Promise<boolean> {
    try {
      const userId = getUserId()
      const password = getPassword()

      // 没有有效凭据，无法自动登录
      if (!userId || !password || userId === 'undefined' || password === 'undefined') {
        return false
      }

      // 动态导入 apiService，避免循环依赖
      const { apiService } = await import('../business/api-service')

      if (url.startsWith('/blw-edu-yb')) {
        // 研伴相关接口：使用研伴登录
        const loginResult = await apiService.loginYanban(userId, password)

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
          const token = await apiService.loginXueban(userId, password)
          return !!token
        } catch {
          return false
        }
      } else {
        // 其他接口：尝试通用登录（优先研伴登录）
        const loginResult = await apiService.loginYanban(userId, password)
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

      // 使用 apiService 进行登录（动态导入避免循环依赖）
      const { apiService } = await import('../business/api-service')
      const loginResult = await apiService.loginYanban(userId, password)
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
}

export const authService = AuthService.getInstance()

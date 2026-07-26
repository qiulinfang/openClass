import { AuthApi, type LoginParams } from './api/authApi'
import { StorageService } from './storageService'
import { useUserStore } from '@/store/user'

export interface SavedAccount {
  account: string
  password: string
  lastUsed: number
}

/**
 * 认证业务服务层 (Auth Service)
 */
export class AuthService {
  /**
   * 执行用户登录业务（对齐 imates-web：包含学伴登录 + 研伴同步登录）
   */
  static async login(params: LoginParams): Promise<boolean> {
    const userStore = useUserStore()

    // 1. 调用学伴登录接口
    const token = await AuthApi.loginXueban(params)

    // 2. 本地持久化 Token 与凭据
    StorageService.setXuebanToken(token)
    StorageService.setSavedCredentials(params.account, params.password)

    // 3. 更新 Pinia 状态
    userStore.setToken(token)

    // 4. 获取用户信息
    try {
      const userInfo = await AuthApi.getUserInfo(token)
      if (userInfo) {
        userStore.setUserInfo(userInfo)
      }
    } catch (e) {
      console.warn('[AuthService] 获取用户信息失败:', e)
    }

    // 5. 同步登录研伴系统
    try {
      const yanbanRes = await AuthApi.loginYanban(params)
      const yanbanToken = yanbanRes?.data?.token
      if (yanbanToken) {
        uni.setStorageSync('YANBAN_TOKEN', yanbanToken)
        if (yanbanRes?.data?.userId) {
          uni.setStorageSync('yanbanuserid', yanbanRes.data.userId)
        }
      }
    } catch (yanbanErr) {
      console.warn('[AuthService] 研伴同步登录异常:', yanbanErr)
    }

    // 6. 更新多历史账号记录
    this.updateSavedAccounts(params.account, params.password)

    return true
  }

  /**
   * 加载保存的账号密码与多账号列表
   */
  static getInitialLoginState() {
    const credentials = StorageService.getSavedCredentials()
    const savedAccounts = StorageService.getSavedAccounts<SavedAccount>()
      .sort((a, b) => b.lastUsed - a.lastUsed)

    return {
      account: credentials.account,
      password: credentials.password,
      savedAccounts
    }
  }

  /**
   * 更新历史多账号记录
   */
  static updateSavedAccounts(account: string, password: string): SavedAccount[] {
    const list = StorageService.getSavedAccounts<SavedAccount>()
    const index = list.findIndex(a => a.account === account)

    if (index !== -1) {
      list[index].password = password
      list[index].lastUsed = Date.now()
    } else {
      list.push({
        account,
        password,
        lastUsed: Date.now()
      })
    }

    StorageService.setSavedAccounts(list)
    return list
  }

  /**
   * 删除某个历史账号记录
   */
  static deleteSavedAccount(account: string): SavedAccount[] {
    const list = StorageService.getSavedAccounts<SavedAccount>()
      .filter(a => a.account !== account)
    StorageService.setSavedAccounts(list)
    return list
  }

  /**
   * 退出登录
   */
  static logout(): void {
    const userStore = useUserStore()
    userStore.logout()
    StorageService.clearAllAuth()
  }
}

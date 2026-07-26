import CryptoJS from 'crypto-js'
import { request } from '@/utils/request'
import { getApiPaths, getYanbanBaseUrl } from '@/config/env-config'

export interface LoginParams {
  account: string
  password: string
}

export interface XuebanLoginResponse {
  success: boolean
  message?: string
  data?: {
    token: string
    [key: string]: any
  }
}

export interface YanbanLoginResponse {
  code: number
  success: boolean
  message?: string
  data?: {
    token: string
    userId: string
    [key: string]: any
  }
}

/**
 * 认证 API 层
 */
export class AuthApi {
  /**
   * 学伴登录接口 (/xb-release/admin/login 或 /xb-test/admin/login)
   * 密码发送明文，与 imates-web / Android 保持一致
   */
  static async loginXueban(params: LoginParams): Promise<string> {
    const paths = getApiPaths()
    const res = await request<XuebanLoginResponse>({
      url: paths.xueban.admin.login,
      method: 'POST',
      data: params
    })

    if (!res.success && res.message) {
      throw new Error(res.message)
    }

    const token = res.data?.token || (res as any).token
    if (!token) {
      throw new Error('登录失败：未获取到token')
    }

    return token
  }

  /**
   * 获取学伴用户信息接口 (/xb-release/admin/info 或 /xb-test/admin/info)
   */
  static async getUserInfo(token: string): Promise<any> {
    const paths = getApiPaths()
    const res = await request({
      url: `${paths.xueban.admin.info}?token=${token}`,
      method: 'GET'
    })
    return res.data || res
  }

  /**
   * 研伴学生同步登录接口 (/yb-release/blw-edu-yb/auth/login-student)
   * 注意：研伴登录接口密码需使用 MD5 加密，与 imates-web 保持一致
   */
  static async loginYanban(params: LoginParams): Promise<YanbanLoginResponse | null> {
    const paths = getApiPaths()
    const yanbanBaseUrl = getYanbanBaseUrl()
    const md5Password = CryptoJS.MD5(params.password).toString()
    
    try {
      const res = await request<YanbanLoginResponse>({
        url: paths.yanban.auth.loginStudent,
        method: 'POST',
        baseUrl: yanbanBaseUrl,
        data: {
          account: params.account,
          password: md5Password
        }
      })
      return res
    } catch {
      return null
    }
  }
}

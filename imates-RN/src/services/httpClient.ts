/**
 * HTTP 客户端工具类
 * 使用 Axios 封装 HTTP 请求
 * 处理认证、重试、超时、错误处理等通用逻辑
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface ApiResponse<T = unknown> {
  success: boolean
  code?: number
  message?: string
  data?: T
}

export interface RequestConfig extends AxiosRequestConfig {
  retries?: number
  skipAuth401Retry?: boolean
}

/**
 * HTTP 客户端类
 * 封装 Axios，提供统一的请求接口
 */
export class HttpClient {
  private instance: AxiosInstance
  private baseURL: string
  private timeout: number

  constructor(baseURL: string = '', timeout: number = 5000) {
    this.baseURL = baseURL
    this.timeout = timeout
    
    // 第1步：创建 Axios 实例
    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // 第2步：设置请求拦截器
    this.instance.interceptors.request.use(
      async (config) => {
        // 动态获取认证配置
        const authConfig = await this.getDynamicAuthConfig(config.url || '')
        if (config.headers) {
          Object.assign(config.headers, authConfig)
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // 第3步：设置响应拦截器
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response
      },
      async (error) => {
        // 处理 401 错误
        if (error.response?.status === 401 && !error.config.skipAuth401Retry) {
          const loginSuccess = await this.tryAutoRelogin(error.config.url || '')
          if (loginSuccess) {
            // 重新发起请求
            error.config.skipAuth401Retry = true
            return this.instance.request(error.config)
          }
        }
        return Promise.reject(error)
      }
    )
  }

  /**
   * 动态获取认证配置，根据请求路径选择不同的token
   * 第1步：根据请求路径选择不同的token
   * 第2步：将token赋值给所有认证字段
   */
  private async getDynamicAuthConfig(url: string): Promise<Record<string, string>> {
    const authConfig: Record<string, string> = {}
    
    // 第1步：登录接口不需要认证头
    if (url === '/admin/login') {
      return authConfig
    }
    
    // 第2步：根据请求路径选择不同的token
    let selectedToken: string | null = null
    
    if (url.startsWith('/permission') || url.startsWith('/admin/info')) {
      // 学班管理员相关接口：使用XUEBAN_TOKEN
      selectedToken = await AsyncStorage.getItem('XUEBAN_TOKEN')
    } else if (url.startsWith('/blw-edu-yb')) {
      // 研伴相关接口：使用YANBAN_TOKEN
      selectedToken = await AsyncStorage.getItem('YANBAN_TOKEN')
    } else {
      // 其他请求：使用默认token
      selectedToken = await AsyncStorage.getItem('token')
    }
    
    // 第3步：将token赋值给所有认证字段
    if (selectedToken) {
      authConfig['sa-token'] = selectedToken
      authConfig['authorization'] = selectedToken
      authConfig['token'] = selectedToken
    }
    
    return authConfig
  }

  /**
   * 根据接口路径清除对应的token
   * 第1步：判断接口类型
   * 第2步：删除对应的token
   */
  private async clearTokenByPath(url: string): Promise<void> {
    if (url.startsWith('/permission') || url.startsWith('/admin/info')) {
      await AsyncStorage.removeItem('XUEBAN_TOKEN')
    } else if (url.startsWith('/blw-edu-yb')) {
      await AsyncStorage.removeItem('YANBAN_TOKEN')
    } else {
      await AsyncStorage.removeItem('token')
    }
  }

  /**
   * 尝试自动重新登录
   * 第1步：获取保存的用户凭据
   * 第2步：根据接口路径选择合适的登录方式
   * 第3步：执行登录并保存新token
   * 第4步：返回是否成功
   */
  private async tryAutoRelogin(url: string): Promise<boolean> {
    try {
      // 第1步：获取用户凭据
      const userId = await AsyncStorage.getItem('userId')
      const password = await AsyncStorage.getItem('userPassword')
      
      if (!userId || !password) {
        return false
      }
      
      // 第2步：根据接口路径选择登录方式（待实现 apiService）
      // 动态导入避免循环依赖
      // const { apiService } = await import('./apiService')
      // if (url.startsWith('/blw-edu-yb')) {
      //   const loginResult = await apiService.loginYanban(userId, password)
      //   return loginResult !== null
      // }
      
      return false
    } catch {
      return false
    }
  }

  /**
   * 通用请求方法
   */
  private async request<T>(
    url: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const { retries = 3, ...axiosConfig } = config
    
    let lastError: Error | null = null
    
    // 重试机制：最多尝试 retries + 1 次
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.instance.request<T>({
          url,
          ...axiosConfig,
        })
        
        // 处理响应数据
        const responseData = response.data as T
        return {
          success: true,
          data: responseData,
          code: response.status,
        }
      } catch (error: unknown) {
        lastError = error as Error
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }
    
    // 所有重试都失败了
    return {
      success: false,
      message: lastError?.message || '网络请求失败',
      code: 0,
    }
  }

  /**
   * GET 请求
   */
  async get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' })
  }

  /**
   * POST 请求
   */
  async post<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'POST', data })
  }

  /**
   * PUT 请求
   */
  async put<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PUT', data })
  }

  /**
   * DELETE 请求
   */
  async delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' })
  }

  /**
   * 设置基础 URL
   */
  setBaseURL(url: string) {
    this.baseURL = url
    this.instance.defaults.baseURL = url
  }
}

// 创建默认的 HTTP 客户端实例
export const httpClient = new HttpClient()


/**
 * HTTP 客户端工具类
 * 用于处理网络请求，替代部分 AndroidBridge 调用
 */

import type { ApiResponse, RequestConfig } from '@/types'
import { createTimeoutController } from '@/utils/common/polyfills'
import { showMessage } from '@/utils'
import { getApiBaseUrl, getHistoryManageBaseUrl, getResourceBaseUrl, getYanbanBaseUrl } from '@/config/env-config'
import { authService } from './auth-service'

export class HttpClient {
  private baseURL: string
  private defaultHeaders: Record<string, string>
  private timeout: number

  // 流程：file://环境下的路由映射表（统一管理，避免重复）
  // 动态获取，根据当前环境返回不同的 Base URL
  private getRouteBaseMap(): Record<string, string> {
    const apiBaseUrl = getApiBaseUrl()
    const resourceBaseUrl = getResourceBaseUrl()
    const yanbanBaseUrl = getYanbanBaseUrl()
    const historyManageBaseUrl = getHistoryManageBaseUrl()
    
    return {
      // 应用更新配置（/bj101/appupdate.json）永远走学班服务
      '/bj101': 'https://www.imates.com.cn',
      // 学班服务（根据环境动态切换）
      '/admin': apiBaseUrl,
      '/permission': apiBaseUrl,
      '/ai': apiBaseUrl,
      '/history_manage': historyManageBaseUrl,
      '/biologyTopicKnowledge': apiBaseUrl,
      // 研伴/教材等走资源服务器
      '/blw-edu-yb': yanbanBaseUrl,
      // Zammad 示例
      '/api/v1': 'http://app.imates.com.cn:8080',
      // 资源服务器（根据环境动态切换）
      '/resource': resourceBaseUrl,
      '/img': resourceBaseUrl,
      // 知识点查询服务
      '/knowledge': 'http://www.imates.com.cn:8090',
      // 经开二中的应用更新配置（/jinkai/update.json）
      '/jinkai': resourceBaseUrl,
      '/appupdate_test.json': 'https://www.imates.com.cn',
    }
  }

  constructor(baseURL: string = '', timeout: number = 5000) {
    this.baseURL = baseURL
    this.timeout = timeout
    this.defaultHeaders = {
      'Content-Type': 'application/json', 
    }
  }



  /**
   * 构建完整URL
   * 流程：处理相对路径和绝对路径，支持file://环境的路由映射
   */
  public buildFullUrl(url: string): string {
    // 流程：绝对URL直接使用
    if (url.startsWith('http')) {
      return url
    }

    // 流程：判断是否为file://环境（Android WebView）
    const isFileEnv = typeof window !== 'undefined' && window.location?.protocol === 'file:'
    
    if (isFileEnv) {
      // 流程：根据首段路径路由到后端网关
      const routeBaseMap = this.getRouteBaseMap()
      const matchedBase = Object.keys(routeBaseMap).find(prefix => url.startsWith(prefix))
      if (matchedBase) {
        return `${routeBaseMap[matchedBase]}${url}`
      }
      // 流程：无法匹配时回退baseURL（避免file:///）
      return `${this.baseURL}${url}`
    }
    // 流程：http(s)环境下使用baseURL拼接
    return `${this.baseURL}${url}`
  }

  /**
   * 动态获取认证配置，根据请求路径选择不同的token
   * 将选择的token同时赋值给cookie、saToken、authorization、token字段
   */
  private async getDynamicAuthConfig(url: string): Promise<Record<string, string>> {
    const authConfig: Record<string, string> = {}
    
    // 登录接口不需要认证头
    if (url === '/admin/login') {
      return authConfig
    }
    
    // 根据请求路径选择不同的token（从统一存储读取）
    let selectedToken: string | null = null

    const sanitize = (value: string | null | undefined): string | null => {
      if (!value || value === 'undefined' || value.trim() === '') {
        return null
      }
      return value
    }

    if (url.startsWith('/permission') || url.startsWith('/ai') || url.startsWith('/admin/info') || url.startsWith('/biologyTopicKnowledge')) {
      // /permission、/admin/info和/biologyTopicKnowledge开头的请求使用XUEBAN_TOKEN
      selectedToken = sanitize(localStorage.getItem('XUEBAN_TOKEN'))
    } else if (url.startsWith('/blw-edu-yb')) {
      // /blw-edu-yb开头的请求使用YANBAN_TOKEN
      selectedToken = sanitize(localStorage.getItem('YANBAN_TOKEN'))
    }
    
    // 如果找到了token，将其赋值给所有认证字段
    if (selectedToken) {
      // ⭐ 修复：使用Token header（首字母大写），与Android原生保持一致
      authConfig['Token'] = selectedToken
      // 保留其他header作为备用（如果后端支持）
      authConfig['sa-token'] = selectedToken
      authConfig['authorization'] = selectedToken
      // ⚠️ 注意：不设置小写的 'token'，避免与 'Token' 重复（HTTP header 名称大小写不敏感）
      // 如果后端需要小写的 'token' header，可以通过其他方式单独设置
    }
    
    return authConfig
  }


  /**
   * 设置基础 URL
   */
  setBaseURL(url: string) {
    this.baseURL = url
  }

  /**
   * 通用请求方法
   * @template T 响应数据的类型
   * @param url 请求URL（可以是相对路径或绝对URL）
   * @param config 请求配置选项
   * @param config.method HTTP方法，默认为'GET'
   * @param config.headers 额外的请求头，会与默认请求头合并
   * @param config.body 请求体数据（GET请求时会被忽略）
   * @param config.timeout 超时时间（毫秒），默认使用实例的timeout值
   * @param config.retries 重试次数，默认为3次
   * @param config.skipAuth401Retry 跳过401认证重试（内部使用，避免无限循环）
   * @returns Promise<ApiResponse<T>> 统一的API响应格式
   */
  private async request<T>(
    url: string,
    config: RequestConfig & { body?: unknown; skipAuth401Retry?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    // 解构配置参数，设置默认值
    const {
      method = 'GET',           // HTTP方法，默认为GET
      headers = {},             // 额外请求头，默认为空对象
      body,                     // 请求体数据
      timeout = this.timeout,  // 超时时间，使用实例默认值
      skipAuth401Retry = false  // 是否跳过401认证重试
    } = config

    // 流程：构建完整URL（统一处理file://和http(s)环境）
    const fullUrl = this.buildFullUrl(url)
    
    // 单次请求：不做通用重试（由业务层自行决定是否重试）
    const { controller, cleanup } = createTimeoutController(timeout)

    const dynamicAuthConfig = await this.getDynamicAuthConfig(url)
    const requestOptions: RequestInit = {
      method,
      headers: {
        ...this.defaultHeaders,
        ...dynamicAuthConfig,
        ...headers,
      },
      ...(controller && { signal: controller.signal }),
    }

    if (body && method !== 'GET') {
      if (body instanceof FormData || body instanceof Blob) {
        requestOptions.body = body
        delete (requestOptions.headers as Record<string, string>)['Content-Type']
      } else if (typeof body === 'string') {
        requestOptions.body = body
      } else {
        requestOptions.body = JSON.stringify(body)
      }
    }

    try {
      const response = await fetch(fullUrl, requestOptions)
      cleanup()

      if (response.status === 401 && !skipAuth401Retry) {
        await authService.handle401(url)
        return {
          success: false,
          data: undefined,
          message: '认证失败(401): 登录已失效',
          code: 401,
        }
      }

      let data: any = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok) {
        return {
          success: false,
          data,
          message: (data && (data.message || data.msg)) || `HTTP ${response.status}: ${response.statusText}`,
          code: response.status,
        }
      }

      return {
        success: data.success,
        data,
        code: response.status,
      }
    } catch (error) {
      cleanup()
      return {
        success: false,
        message: (error as Error)?.message || '网络请求失败',
        code: 0,
      }
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
  async post<T>(url: string, body?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'POST', body })
  }

  /**
   * PUT 请求
   */
  async put<T>(url: string, body?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PUT', body })
  }

  /**
   * DELETE 请求
   */
  async delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' })
  }

  /**
   * 文件下载流（用于下载二进制文件）
   * 返回原始Response对象，调用方可以使用response.body获取ReadableStream
   */
  async downloadStream(
    url: string,
    config?: RequestConfig & { signal?: AbortSignal }
  ): Promise<Response> {
    // 流程：构建完整URL（统一处理file://和http(s)环境）
    const fullUrl = this.buildFullUrl(url)
    
    // 流程：构建请求选项，包含认证头和下载优化配置
    const dynamicAuthConfig = await this.getDynamicAuthConfig(url)
    const requestOptions: RequestInit = {
      method: config?.method || 'GET',
      headers: {
        ...dynamicAuthConfig,      // 动态获取认证配置
        'Accept-Encoding': 'gzip, deflate', // 启用压缩
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...config?.headers, // 用户自定义请求头（优先级最高）
      },
      signal: config?.signal, // 支持取消下载
      keepalive: true,
      mode: 'cors'
    }
    
    // 流程：发送请求并返回原始Response
    const response = await fetch(fullUrl, requestOptions)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return response
  }

  /**
   * 流式请求（用于 AI 聊天）
   */
  async streamRequest(
    url: string,
    body: unknown,
    onChunk: (chunk: string, isComplete: boolean) => void,
    config?: RequestConfig
  ): Promise<void> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`
    
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        ...this.defaultHeaders,
        ...config?.headers,
      },
      body: JSON.stringify(body),
    }

    try {
      const response = await fetch(fullUrl, requestOptions)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          // 处理缓冲区中剩余的数据
          if (buffer.trim()) {
            onChunk(buffer, false)
          }
          onChunk('', true) // 发送完成信号
          break
        }

        buffer += decoder.decode(value, { stream: true })
        
        // 按行处理数据
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后一个不完整的行

        for (const line of lines) {
          if (line.trim()) {
            // 处理 Server-Sent Events 格式
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                onChunk('', true)
                return
              }
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content || ''
                if (content) {
                  onChunk(content, false)
                }
              } catch {
                // 如果不是 JSON 格式，直接作为文本处理
                onChunk(data, false)
              }
            } else {
              onChunk(line, false)
            }
          }
        }
      }
    } catch (error) {
      onChunk('', true) // 确保发送完成信号
      throw error
    }
  }
}

// 创建默认的 HTTP 客户端实例
export const httpClient = new HttpClient()
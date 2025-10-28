/**
 * HTTP 客户端工具类
 * 用于处理网络请求，替代部分 AndroidBridge 调用
 */

import type { ApiResponse, RequestConfig } from '../types'
import { createTimeoutController } from '../utils/common/polyfills'

export class HttpClient {
  private baseURL: string
  private defaultHeaders: Record<string, string>
  private timeout: number
  // 全局认证配置已删除，所有认证配置都通过getDynamicAuthConfig动态获取

  // 流程：file://环境下的路由映射表（统一管理，避免重复）
  private readonly routeBaseMap: Record<string, string> = {
    // 学班服务
    '/admin': 'http://www.imates.com.cn:8222/blw-edu-service-alc',
    '/permission': 'http://www.imates.com.cn:8222/blw-edu-service-alc',
    '/biologyTopicKnowledge': 'http://www.imates.com.cn:8222/blw-edu-service-alc',
    // 研伴/教材等走 www.imates.com.cn:9099
    '/blw-edu-yb': 'https://www.imates.com.cn:9099',
    // Zammad 示例
    '/api/v1': 'http://app.imates.com.cn:8080',
    // 资源服务器
    '/resource': 'https://www.imates.com.cn:9099'
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
      const matchedBase = Object.keys(this.routeBaseMap).find(prefix => url.startsWith(prefix))
      if (matchedBase) {
        return `${this.routeBaseMap[matchedBase]}${url}`
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
  private getDynamicAuthConfig(url: string): Record<string, string> {
    const authConfig: Record<string, string> = {}
    
    // 登录接口不需要认证头
    if (url === '/admin/login') {
      return authConfig
    }
    
    // 根据请求路径选择不同的token
    let selectedToken: string | null = null
    
    if (url.startsWith('/permission') || url.startsWith('/admin/info') || url.startsWith('/biologyTopicKnowledge')) {
      // /permission、/admin/info和/biologyTopicKnowledge开头的请求使用XUEBAN_TOKEN
      selectedToken = localStorage.getItem('XUEBAN_TOKEN')
    } else if (url.startsWith('/blw-edu-yb')) {
      // /blw-edu-yb开头的请求使用YANBAN_TOKEN
      selectedToken = localStorage.getItem('YANBAN_TOKEN')
    } else {
      // 其他请求使用默认token
      selectedToken = localStorage.getItem('token')
    }
    
    // 如果找到了token，将其赋值给所有认证字段
    if (selectedToken) {
      // 使用sa-token格式（与Android原生保持一致）
      authConfig['sa-token'] = selectedToken
      authConfig['authorization'] = selectedToken
      authConfig['token'] = selectedToken
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
   * @returns Promise<ApiResponse<T>> 统一的API响应格式
   */
  private async request<T>(
    url: string,
    config: RequestConfig & { body?: unknown } = {}
  ): Promise<ApiResponse<T>> {
    // 解构配置参数，设置默认值
    const {
      method = 'GET',           // HTTP方法，默认为GET
      headers = {},             // 额外请求头，默认为空对象
      body,                     // 请求体数据
      timeout = this.timeout,  // 超时时间，使用实例默认值
      retries = 3              // 重试次数，默认为3次
    } = config

    // 流程：构建完整URL（统一处理file://和http(s)环境）
    const fullUrl = this.buildFullUrl(url)
    
    // 记录最后一次错误，用于重试失败后的错误信息
    let lastError: Error | null = null

    // 重试机制：最多尝试 retries + 1 次（包括首次尝试）
    for (let attempt = 0; attempt <= retries; attempt++) {
      // 为每次尝试创建新的超时控制器，避免重复使用已取消的AbortController
      const { controller, cleanup } = createTimeoutController(timeout)
      
      // 构建请求选项
      const requestOptions: RequestInit = {
        method,                    // HTTP方法
        headers: {
          ...this.defaultHeaders,  // 默认请求头（如Content-Type）
          ...this.getDynamicAuthConfig(url), // 动态获取认证配置（包含全局认证配置和路径相关token）
          ...headers,              // 用户自定义请求头（优先级最高）
        },
        ...(controller && { signal: controller.signal }), // 超时控制信号
      }

      // 处理请求体：只有非GET请求才添加body，且自动序列化JSON
      if (body && method !== 'GET') {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
      }

      try {
        // 发送HTTP请求
        const response = await fetch(fullUrl, requestOptions)
        
        // 请求成功，清除超时定时器
        cleanup()
        
        // 检查HTTP状态码，非2xx状态码视为错误
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // 解析响应JSON数据
        const data = await response.json()
        
        // 返回统一的API响应格式
        return {
          success: data.success,  // 业务层成功标识
          data,                   // 响应数据
          code: response.status   // HTTP状态码
        }
      } catch (error) {
        // 请求失败，记录错误信息
        lastError = error as Error
        
        // 清除超时定时器
        cleanup()
        
        // 如果不是最后一次尝试，等待后重试
        // 使用递增延迟：第1次重试等待1秒，第2次等待2秒，第3次等待3秒
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }

    // 所有重试都失败了，返回错误响应
    return {
      success: false,
      message: lastError?.message || '网络请求失败',
      code: 0  // 0表示网络错误或重试失败
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
    const requestOptions: RequestInit = {
      method: config?.method || 'GET',
      headers: {
        ...this.getDynamicAuthConfig(url), // 动态获取认证配置
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
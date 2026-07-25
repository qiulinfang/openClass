/**
 * 配置相关类型定义
 * 环境配置和流式响应相关类型
 */

/** HTTP 请求配置接口 */
export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  timeout?: number
  retries?: number
  skipAuth401Retry?: boolean
}

/** 流式响应配置接口 */
export interface StreamingConfig {
  /** 打字机效果速度（毫秒） */
  typewriterSpeed: number
  /** 流式响应超时时间（毫秒） */
  timeout: number
}

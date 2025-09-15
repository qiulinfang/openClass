/**
 * 流式响应配置
 */
import type { StreamingConfig } from '../types'

/**
 * 默认流式响应配置
 */
export const defaultStreamingConfig: StreamingConfig = {
  typewriterSpeed: 30,
  timeout: 30000, // 30秒超时
}

/**
 * 获取流式响应配置
 */
export const getStreamingConfig = (): StreamingConfig => {
  // 可以从环境变量或本地存储中读取配置
  const config = { ...defaultStreamingConfig }
  
  // 从环境变量读取配置
  if (import.meta.env.VITE_TYPEWRITER_SPEED) {
    config.typewriterSpeed = parseInt(import.meta.env.VITE_TYPEWRITER_SPEED, 10)
  }
  
  return config
}

/**
 * 流式响应状态管理
 */
export class StreamingManager {
  private static instance: StreamingManager
  private config: StreamingConfig
  private activeStreams: Map<string, number> = new Map()

  private constructor() {
    this.config = getStreamingConfig()
  }

  public static getInstance(): StreamingManager {
    if (!StreamingManager.instance) {
      StreamingManager.instance = new StreamingManager()
    }
    return StreamingManager.instance
  }

  /**
   * 获取配置
   */
  public getConfig(): StreamingConfig {
    return this.config
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 开始流式响应超时计时
   */
  public startTimeout(requestId: string, callback: () => void): void {
    if (this.activeStreams.has(requestId)) {
      this.clearTimeout(requestId)
    }

    const timeout = setTimeout(() => {
      callback()
      this.activeStreams.delete(requestId)
    }, this.config.timeout)

    this.activeStreams.set(requestId, timeout)
  }

  /**
   * 清除超时计时
   */
  public clearTimeout(requestId: string): void {
    const timeout = this.activeStreams.get(requestId)
    if (timeout) {
      clearTimeout(timeout)
      this.activeStreams.delete(requestId)
    }
  }

  /**
   * 清除所有超时计时
   */
  public clearAllTimeouts(): void {
    this.activeStreams.forEach((timeout) => clearTimeout(timeout))
    this.activeStreams.clear()
  }
}

export const streamingManager = StreamingManager.getInstance()
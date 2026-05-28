/**
 * 聊天策略接口
 * 定义不同对话类型需要实现的方法
 */

import type { SendMessageOptions, ChatViewInterface, ForwardResult, ForwardOptions } from './types'

export interface ChatStrategy {
  /** 初始化策略 */
  initialize(options?: any): Promise<void>

  /** 发送消息 */
  sendMessage(content: string, options?: SendMessageOptions): Promise<void>

  /** 处理 AI 响应 */
  handleAIResponse(message: any): void

  /** 获取会话标题 */
  getSessionTitle(): string

  /** 转发消息 */
  forwardMessages(options: ForwardOptions): Promise<ForwardResult>

  /** 加载历史消息 */
  loadHistory(sessionId: string): Promise<void>

  /** 清理资源 */
  cleanup(): void
}

/** 策略工厂 */
export class ChatStrategyFactory {
  private static strategies = new Map<string, new () => ChatStrategy>()

  static register(type: string, strategy: new () => ChatStrategy) {
    this.strategies.set(type, strategy)
  }

  static create(type: string): ChatStrategy | null {
    const StrategyClass = this.strategies.get(type)
    if (!StrategyClass) {
      console.warn(`[ChatStrategyFactory] Unknown strategy type: ${type}`)
      return null
    }
    return new StrategyClass()
  }
}

export type { ChatViewInterface, SendMessageOptions, ForwardResult, ForwardOptions }

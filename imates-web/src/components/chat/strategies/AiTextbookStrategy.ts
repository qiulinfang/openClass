/**
 * AI教材对话策略（使用场景独立Store）
 * 处理教材问答逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions } from './types'
import { useAiTextbookChatStore } from '../../../stores/aiTextbookChatStore'

export class AiTextbookStrategy implements ChatStrategy {
  private aiTextbookStore = useAiTextbookChatStore()
  
  // 第1步：获取消息列表
  getMessages(): ChatBubble[] {
    return this.aiTextbookStore.messages
  }
  
  // 第2步：添加消息
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiTextbookStore.addMessage(message)
  }
  
  // 第3步：发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const hidePrefix = content.includes('我们开始吧')
    await this.aiTextbookStore.sendChatMessage(
      content,
      options.selectedModel,
      options.imageData,
      hidePrefix
    )
  }
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string {
    return '你好！我可以帮你解答教材中的问题。请告诉我你的疑问，或者直接发送教材截图。'
  }
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean {
    return false // AI教材对话不需要题目
  }
  
  // 第6步：获取消息类型
  getMessageType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 第7步：获取发送者类型
  getSenderType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 第8步：保存聊天历史
  async saveChatHistory(): Promise<void> {
    await this.aiTextbookStore.saveChatHistory(false)
  }
}

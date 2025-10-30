/**
 * AI通用对话策略（使用场景独立Store）
 * 处理通用AI对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions } from './types'
import { useAiGeneralChatStore } from '../../../stores/aiGeneralChatStore'
import { useUserStore } from '../../../stores/userStore'

export class AiGeneralStrategy implements ChatStrategy {
  private aiGeneralStore = useAiGeneralChatStore()
  private userStore = useUserStore()
  
  // 第1步：获取消息列表
  getMessages(): ChatBubble[] {
    return this.aiGeneralStore.messages
  }
  
  // 第2步：添加消息（直接操作messages）
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiGeneralStore.messages.push(message)
  }
  
  // 第3步：发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    // 调用Store的sendMessage方法，传递所有必需参数
    await this.aiGeneralStore.sendMessage(
      content,
      this.userStore.userInfo,
      this.userStore.subject as 'MATH' | 'BIOLOGY',
      options.selectedModel || 'mate'
    )
  }
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string {
    return '你好！我是你的AI助手。有什么问题我可以帮你解答吗？'
  }
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean {
    return false // AI通用对话不需要题目
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
    await this.aiGeneralStore.saveChatHistory()
  }
}

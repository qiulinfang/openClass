/**
 * AI题目对话策略（使用场景独立Store）
 * 处理基于题目的AI对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions } from './types'
import { useAiExerciseChatStore } from '../../../stores/aiExerciseChatStore'
import { useQuestionStore } from '../../../stores/questionStore'
import { useUserStore } from '../../../stores/userStore'

export class AiExerciseStrategy implements ChatStrategy {
  private aiExerciseStore = useAiExerciseChatStore()
  private questionStore = useQuestionStore()
  private userStore = useUserStore()
  
  // 第1步：获取消息列表
  getMessages(): ChatBubble[] {
    return this.aiExerciseStore.messages
  }
  
  // 第2步：添加消息（直接操作messages）
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiExerciseStore.messages.push(message)
  }
  
  // 第3步：发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    // 验证是否选择了题目
    if (!this.questionStore.currentQuestion) {
      throw new Error('请先选择题目')
    }
    
    const hidePrefix = content.includes('我们开始吧')
    
    // 调用Store的sendMessage方法，传递所有必需参数
    await this.aiExerciseStore.sendMessage(
      content,
      this.questionStore.currentQuestion,
      this.userStore.userInfo,
      this.userStore.subject as 'MATH' | 'BIOLOGY',
      options.selectedModel || 'mate',
      options.imageData,
      hidePrefix
    )
  }
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string {
    return '请先选择一道题目，然后我们可以开始讨论。你可以从题目列表中选择一道感兴趣的题目。'
  }
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean {
    return true
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
    const questionId = this.questionStore.currentQuestion?.id
    if (questionId) {
      await this.aiExerciseStore.saveChatHistory(questionId)
    }
  }
}

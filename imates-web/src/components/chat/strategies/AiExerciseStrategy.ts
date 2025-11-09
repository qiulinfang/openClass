/**
 * AI题目对话策略（使用场景独立Store）
 * 处理基于题目的AI对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy, ForwardResult, ForwardOptions } from './ChatStrategy'
import type { SendMessageOptions } from './types'
import { useAiExerciseChatStore } from '../../../stores/aiExerciseChatStore'
import { useQuestionStore } from '../../../stores/questionStore'
import { useUserStore } from '../../../stores/userStore'
import {
  selectOrCreateTeacherExerciseSession,
  forwardMessageToTeacher,
  forwardMessagesSeparately,
} from './ForwardMessageHelper'
import { showMessage } from '../../../utils'

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
  
  // 第9步：检查是否支持转发消息
  canForwardMessage(): boolean {
    return true // AI题目对话支持转发
  }
  
  // 第10步：获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    // AI题目场景：通过题目的科目字段进行判断
    try {
      const question = this.questionStore.currentQuestion
      if (question?.subject) {
        // 将科目转换为小写格式
        const subjectLower = question.subject.toLowerCase()
        if (subjectLower === 'biology' || subjectLower === '生物') {
          return 'biology'
        } else if (subjectLower === 'math' || subjectLower === '数学') {
          return 'math'
        }
      }
      return null
    } catch (error) {
      console.error('[AiExerciseStrategy] ❌ 获取题目科目失败:', error)
      return null
    }
  }
  
  // 第11步：转发单条消息
  async forwardMessage(message: ChatBubble, options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      // 验证是否选择了题目
      if (!this.questionStore.currentQuestion) {
        return {
          success: false,
          error: '请先选择题目',
        }
      }
      
      const question = this.questionStore.currentQuestion
      const subject = this.getCurrentSubjectForForward()
      
      if (!subject) {
        return {
          success: false,
          error: '无法确定题目科目',
        }
      }
      
      // 选择或创建老师题目会话
      const session = await selectOrCreateTeacherExerciseSession(
        question.id,
        question.title || '题目',
        subject
      )
      
      if (!session) {
        return {
          success: false,
          error: '会话创建失败',
        }
      }
      
      // 转发消息到题目会话
      const success = await forwardMessageToTeacher([message], session.sessionId, 'exercise')
      
      if (success) {
        const result: ForwardResult = {
          success: true,
          successCount: 1,
          sessionId: session.sessionId,
        }
        
        // AI题目对话页面不显示对话框，只显示简单提示
        showMessage('转发成功', 'success')
        if (options.onSuccess) {
          await options.onSuccess(result)
        }
        
        return result
      } else {
        const error = '转发失败'
        if (options.onError) {
          options.onError(error)
        }
        return {
          success: false,
          error,
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (options.onError) {
        options.onError(errorMessage)
      }
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
  
  // 第12步：转发多条消息
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      // 验证是否选择了题目
      if (!this.questionStore.currentQuestion) {
        return {
          success: false,
          error: '请先选择题目',
        }
      }
      
      const question = this.questionStore.currentQuestion
      const subject = this.getCurrentSubjectForForward()
      
      if (!subject) {
        return {
          success: false,
          error: '无法确定题目科目',
        }
      }
      
      // 选择或创建老师题目会话
      const session = await selectOrCreateTeacherExerciseSession(
        question.id,
        question.title || '题目',
        subject
      )
      
      if (!session) {
        return {
          success: false,
          error: '会话创建失败',
        }
      }
      
      // 逐条转发消息到题目会话
      const { successCount } = await forwardMessagesSeparately(
        messages,
        session.sessionId,
        'exercise'
      )
      
      if (successCount > 0) {
        const result: ForwardResult = {
          success: true,
          successCount,
          sessionId: session.sessionId,
        }
        
        // AI题目对话页面不显示对话框，只显示简单提示
        showMessage(`转发成功，已转发 ${successCount} 条消息`, 'success')
        if (options.onSuccess) {
          await options.onSuccess(result)
        }
        
        return result
      } else {
        const error = '转发失败，请重试'
        if (options.onError) {
          options.onError(error)
        }
        return {
          success: false,
          error,
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (options.onError) {
        options.onError(errorMessage)
      }
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
}

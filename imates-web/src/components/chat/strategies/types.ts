/**
 * 策略相关的类型定义
 */

import type { ChatImageData } from '../../../stores/utils/chatStoreUtils'

/**
 * 发送消息的选项
 */
export interface SendMessageOptions {
  selectedModel?: string
  imageData?: ChatImageData
  skipUserMessage?: boolean  // 是否跳过创建用户消息（乐观发送场景）
}

/**
 * 教师会话信息
 */
export interface TeacherSessionInfo {
  sessionId: string
  sessionName: string
  subject: string
}

/**
 * 初始化选项
 */
export interface InitializeOptions {
  currentSubject?: 'biology' | 'math'
  currentQuestionId?: string
  currentQuestionTitle?: string
  sessionId?: string
  resourceId?: string
  hasSelectedQuestion?: boolean
}


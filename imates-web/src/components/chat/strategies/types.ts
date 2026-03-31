/**
 * 策略相关的类型定义
 */

import type { ChatImageData } from '../../../stores/utils/chatStoreUtils'
import type { HtmlPreviewFocus } from '../../../types/api'

/**
 * 发送消息的选项
 */
export interface SendMessageOptions {
  selectedModel?: string
  imageData?: ChatImageData
  imageList?: ChatImageData[]
  skipUserMessage?: boolean  // 是否跳过创建用户消息（乐观发送场景）
  focus?: HtmlPreviewFocus
  // 当前题目对象，由上层 ChatView 通过 props.question 传入
  question?: unknown
  // 当前题目对象，由上层 ChatView 通过 props.question 传入
  currentQuestion?: unknown
  // 当前题目ID，由上层 ChatView 通过 props.questionId 传入
  currentQuestionId?: string
  // 引用的消息信息，用于消息气泡展示
  quotedMessage?: {
    id: string
    content: string
    sender: 'user' | 'ai' | 'teacher'
  }
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
  // 可选：当前题目对象（用于避免策略内部访问全局 questionStore）
  question?: unknown
}


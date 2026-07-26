/**
 * 策略相关的类型定义 (imates-uniapp)
 */

import type { ChatImageData } from '@/store/utils/chatStoreUtils'

export interface SendMessageOptions {
  selectedModel?: string
  imageData?: ChatImageData
  imageList?: ChatImageData[]
  skipUserMessage?: boolean
  question?: unknown
  currentQuestion?: unknown
  currentQuestionId?: string
  quotedMessage?: {
    id: string
    content: string
    sender: any
  }
  displayContent?: string
}

export interface TeacherSessionInfo {
  sessionId: string
  sessionName: string
  subject: string
}

export interface InitializeOptions {
  currentSubject?: 'biology' | 'math'
  currentQuestionId?: string
  currentQuestionTitle?: string
  sessionId?: string
  resourceId?: string
  hasSelectedQuestion?: boolean
  question?: unknown
}

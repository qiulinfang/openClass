import type { ChatImageData } from '@/stores/utils/chatStoreUtils'

export interface SendMessageOptions {
  selectedModel?: string
  imageData?: ChatImageData
  imageList?: ChatImageData[]
  skipUserMessage?: boolean
  focus?: unknown
  question?: unknown
  currentQuestion?: unknown
  currentQuestionId?: string
  quotedMessage?: {
    id: string
    content: string
    sender: 'user' | 'ai' | 'teacher'
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

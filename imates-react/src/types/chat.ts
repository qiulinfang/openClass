import type { Sender } from './enums'

export type ChatType = 'ai-general' | 'ai-exercise' | 'ai-homework' | 'ai-textbook' | 'teacher' | 'user-client'

export interface QuotedMessageInfo {
  id: string
  content: string
  sender: 'ai' | 'human'
}

export interface ConversationRecord {
  messageId: string
  content: string
  isSelf: boolean
  messageType: string
  sessionId: string
  timestamp: number
  sender: Sender
}

export interface ChatMessageSession {
  sessionId: string
  catalogId: string
  sessionName: string
  sessionType: string
  createTime: number
  updateTime: number
  msgCount: number
}

export interface ChatBubble {
  id: string
  messageId?: string
  content: string
  sender: Sender
  type: Sender
  timestamp: string
  messageType?: 'text' | 'voice' | 'image' | 'multi_image' | 'chat_record' | 'html' | 'system' | 'time_separator'
  rawHtml?: string
  rawHtmlMap?: Record<string, [string, string?]>
  isStreaming?: boolean
  isError?: boolean
  canRetry?: boolean
  retryCount?: number
  originalMessage?: string
  isRecalled?: boolean
  isSystemMessage?: boolean
  isRead?: boolean
  sessionId?: string
  voiceData?: {
    filePath: string
    duration: number
    fileSize: number
  }
  imageData?: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
    isLargeImage?: boolean
  }
  imageList?: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
    isLargeImage?: boolean
  }[]
  chatRecordData?: {
    messages: ChatBubble[]
    additionalMessage?: string
  }
  selectedModel?: string
  quotedMessage?: {
    id: string
    content: string
    sender: Sender
  }
  originalDstUrl?: string
}

export interface AttachedScreenshot {
  id: string
  filePath: string
  width: number
  height: number
  fileSize: number
  base64DataUrl?: string
  cropData?: {
    x: number
    y: number
    width: number
    height: number
  }
}

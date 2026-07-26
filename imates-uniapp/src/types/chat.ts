/**
 * 聊天相关类型定义 (移植自 imates-web)
 * 包含全量消息气泡、会话、上下文引用等数据类型
 */

import { MessageType, Sender, SessionType } from './enums'

/** 截图附件信息 */
export interface AttachedScreenshot {
  id: string
  dataUrl?: string
  filePath?: string
  width?: number
  height?: number
}

/** 聊天业务类型联合类型 */
export type ChatType = 'ai-general' | 'ai-exercise' | 'ai-homework' | 'ai-textbook' | 'teacher' | 'user-client'

/** 引用消息信息 */
export interface QuotedMessageInfo {
  id: string
  content: string
  sender: 'ai' | 'human' | Sender
}

/** 对话记录接口（用于数据存储和传输） */
export interface ConversationRecord {
  messageId: string
  content: string
  isSelf: boolean
  messageType: MessageType
  sessionId: string
  timestamp: number
  sender: Sender
}

/** 聊天会话接口 */
export interface ChatMessageSession {
  sessionId: string
  catalogId: string
  sessionName: string
  sessionType: SessionType
  createTime: number
  updateTime: number
  msgCount: number
}

/** 聊天气泡接口 (全量移植自 imates-web) */
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
  selectedModel?: string
  quotedMessage?: {
    id: string
    content: string
    sender: Sender
  }
  originalDstUrl?: string
}

/** 后端历史消息类型 */
export interface BackendHistoryMessage {
  id: string
  content: string
  type: 'ai' | 'human'
}

/** SSE 消息载荷类型 */
export interface SSEPayload {
  content?: string
  agent_status?: 'talking' | 'drawing' | 'thinking' | string
  history_messages?: BackendHistoryMessage[]
}

/** AI通用会话结构 */
export interface AiGeneralSession {
  sessionId: string            // 会话ID
  sessionName: string          // 会话名称
  createTime: number           // 创建时间戳
  updateTime: number           // 最后更新时间戳
  msgCount: number             // 消息数量
  pinned?: boolean             // 是否置顶
  messages?: ChatBubble[]      // 会话的消息列表
  userMessage?: string         // 用户第一条消息
  aiMessage?: string           // AI第一条消息
  lastMessage?: string         // 最后一条消息
  previewMessagesMarkdown?: string[] // 快照预览列表
}

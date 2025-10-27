/**
 * 聊天相关类型定义
 * 包含消息、会话、转发、组件Props等所有聊天相关类型
 */

import type { MessageType, ChatRole, SessionType } from './enums'

// ========== 基础聊天类型 ==========

/** 对话记录接口（用于数据存储和传输） */
export interface ConversationRecord {
  messageId: string
  content: string
  isSelf: boolean
  messageType: MessageType
  sessionId: string
  timestamp: number
  chatRole: ChatRole
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

/** 聊天气泡接口（UI显示用，扩展了基础ConversationRecord，添加UI相关字段） */
export interface ChatBubble {
  id: string
  messageId?: string // 兼容旧版本
  content: string
  sender: 'user' | 'ai' | 'teacher'
  type: 'user' | 'ai' | 'teacher'
  timestamp: string
  messageType?: 'text' | 'voice' | 'image' | 'chat_record'
  isStreaming?: boolean
  isError?: boolean // 标记是否为错误消息
  canRetry?: boolean // 标记是否可以重发
  retryCount?: number // 重试次数
  originalMessage?: string // 原始消息内容（用于重发）
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
  }
  chatRecordData?: {
    messages: ChatBubble[]
    additionalMessage?: string
  }
}

// ========== 转发相关类型 ==========

/** 转发消息数据接口 */
export interface ForwardMessageData {
  selectedMessages: ConversationRecord[]
  teacherSessionId: string
  aiSessionId: string
}

/** 兼容类型别名 */
export type TeacherSessionType = 'USER_TALK_TEACHER_BIOLOGY' | 'USER_TALK_TEACHER_MATH'

// ========== 聊天组件Props类型 ==========

/** ChatInput 组件 Props 接口 */
export interface ChatInputProps {
  modelValue: string
  placeholderText: string
  isLoading: boolean
  isRecording: boolean
  enableWebSearch: boolean
  selectedModel: string
  type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher'
  uploadedFiles: UploadedFile[]
  activeMode: ActiveMode | null
  canSend: boolean
  isEditing?: boolean
  editingMessageId?: string | null
}

/** ChatInput 组件 Emits 接口 */
export interface ChatInputEmits {
  'update:modelValue': [value: string]
  'send-message': []
  'add-new-line': []
  'input-focus': []
  'input-blur': []
  'start-voice-input': [event?: TouchEvent | MouseEvent]
  'stop-voice-input': [event?: TouchEvent | MouseEvent]
  'voice-move': [event: TouchEvent | MouseEvent]
  'show-image-picker': []
  'toggle-web-search': []
  'scroll-to-bottom': []
  'update:selected-model': [value: string]
  'remove-file': [fileId: string]
  'upload-file': []
  'cancel-edit': []
}

/** ChatMessage Props接口 */
export interface ChatMessageProps {
  message: ChatBubble
  type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher'
  isSelected?: boolean
  isSelectionMode?: boolean
  messageIndex?: number
}

/** StreamingMessage Props接口 */
export interface StreamingMessageProps {
  content: string
  isStreaming?: boolean
  typewriterSpeed?: number // 打字机速度（毫秒）
}

/** ChatView Props接口 */
export interface ChatViewProps {
  type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher'
  currentQuestionId?: string
}

/** ForwardModeDialog Props接口 */
export interface ForwardModeDialogProps {
  modelValue: boolean
  messageCount: number
}

/** ChatRecordCard Props接口 */
export interface ChatRecordCardProps {
  messages: ChatBubble[]
  additionalMessage?: string
}

// ========== 聊天相关工具类型 ==========

/** 上传文件接口 */
export interface UploadedFile {
  id: string
  name: string
  file: File
}

/** 活动模式接口 */
export interface ActiveMode {
  label: string
  icon: string
  color: string
}

// ========== 问题记录相关类型 ==========

/** 问题记录接口 */
export interface QuestionRecord {
  id: string
  question: string
  answer?: string
  timestamp: number
}
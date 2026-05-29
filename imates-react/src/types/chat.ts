/**
 * 聊天相关类型定义
 * 包含消息、会话、转发、组件Props等所有聊天相关类型
 */

import type { MessageType, Sender, SessionType } from '@/types/enums'
import type { ExerciseItem } from '@/types/exercise'

// ========== 基础聊天类型 ==========

/** 聊天业务类型联合类型 */
export type ChatType = 'ai-general' | 'ai-exercise' | 'ai-homework' | 'ai-textbook' | 'teacher' | 'user-client'

/**
 * 引用消息信息
 * 引用信息的通用结构（保留兼容字段）
 */
export interface QuotedMessageInfo {
  id: string
  content: string
  // 后端只区分 human / ai，这里用 human 表示“人类侧”的消息（学生提问等）
  sender: 'ai' | 'human'
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

/** 聊天气泡接口（UI显示用，扩展了基础ConversationRecord，添加UI相关字段） */
export interface ChatBubble {
  id: string
  messageId?: string
  content: string
  sender: Sender
  type: Sender
  timestamp: string
  messageType?: 'text' | 'voice' | 'image' | 'multi_image' | 'chat_record' | 'html' | 'system' | 'time_separator' // 场景39：支持系统消息类型 + 多图消息 + 时间分隔符
  rawHtml?: string
  rawHtmlMap?: Record<string, [string, string?]>
  isStreaming?: boolean
  isError?: boolean // 标记是否为错误消息
  canRetry?: boolean // 标记是否可以重发
  retryCount?: number // 重试次数
  originalMessage?: string // 原始消息内容（用于重发）
  isRecalled?: boolean // 场景38：标记消息是否已撤回
  isSystemMessage?: boolean // 场景39：标记是否为系统消息（不保存到历史）
  isRead?: boolean // 消息已读状态
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
    base64DataUrl?: string  // base64数据URL，用于UI显示
    isLargeImage?: boolean  // 标记是否为大图片
  }
  imageList?: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string  // base64数据URL，用于UI显示
    isLargeImage?: boolean  // 标记是否为大图片
  }[]
  chatRecordData?: {
    messages: ChatBubble[]
    additionalMessage?: string
  }
  selectedModel?: string // AI模式（mate/mentor/researcher），用于显示对应头像
  // 引用消息信息
  quotedMessage?: {
    id: string
    content: string
    sender: Sender
  }
  originalDstUrl?: string
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
  type: ChatType
  uploadedFiles: UploadedFile[]
  activeMode: ActiveMode | null
  canSend: boolean
  isEditing?: boolean
  editingMessageId?: string | null
  quotedMessage?: ChatBubble | null // 引用的消息
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
  'remove-quote': [] // 移除引用
}

/** ChatMessage Props接口 */
export interface ChatMessageProps {
  message: ChatBubble
  type: ChatType
  isSelected?: boolean
  isSelectionMode?: boolean
  messageIndex?: number
  isLastMessage?: boolean // 是否是最后一条消息
  showReadStatus?: boolean // 是否显示已读状态
  showTime?: boolean // 是否显示消息时间
}

/** ChatView Props接口 */
export interface ChatViewProps {
  type: ChatType
  currentQuestionId?: string
  sessionId?: string  // 教师对话会话ID
  overrideQuestion?: ExerciseItem | null  // 可选的题目覆盖（用于避免污染全局状态，如拍照搜题场景）
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
  pinned?: boolean  // 是否置顶
  resourceId?: string  // 关联的资源ID，用于加载消息历史
  storageKey?: string  // 存储键，用于加载消息历史（格式：ai-textbook-${resourceId}）
  hasImage?: boolean  // 是否包含图片消息，用于判断接口类型
}

// ========== 后端历史消息类型 ==========

/**
 * 后端返回的历史消息结构
 * 用于 history_messages 字段的类型定义
 * - id: 服务端生成的唯一标识，前端全链路使用
 * - content: 消息内容
 * - type: 消息来源，'ai' 或 'human'
 */
export interface BackendHistoryMessage {
  id: string
  content: string
  type: 'ai' | 'human'
}

/**
 * SSE 消息载荷类型
 * 后端通过 data: {...} 格式返回的 JSON 结构
 */
export interface SSEPayload {
  content?: string
  agent_status?: 'talking' | 'drawing' | 'thinking' | string
  history_messages?: BackendHistoryMessage[]
}

// ========== AI通用会话相关类型 ==========

/** AI通用会话接口 */
export interface AiGeneralSession {
  sessionId: string            // 会话ID
  sessionName: string          // 会话名称（通常是第一条用户消息）
  createTime: number           // 创建时间戳
  updateTime: number           // 最后更新时间戳
  msgCount: number             // 消息数量
  pinned?: boolean             // 是否置顶
  messages?: ChatBubble[]      // 会话的消息列表（可选，用于加载详情）
}

/** AI作业会话接口（扩展通用会话） */
export interface AiHomeworkSession extends AiGeneralSession {
  metadata?: {
    questionBmNo?: string
    [key: string]: any
  }
}

// 加载会话详情
// 定义 AI 教材会话接口
export interface AiTextbookSession {
  sessionId: string        // 会话ID
  sessionName: string      // 会话名称
  createTime: number       // 创建时间戳
  updateTime: number       // 最后更新时间戳
  msgCount: number         // 消息数量
  pinned?: boolean         // 是否置顶
  resourceId?: string      // 关联的资源ID（可选）
  thumbnailImage?: string  // 会话缩略图（截图发送创建会话的图片，base64格式）
  // 向后兼容字段（用于从 QuestionRecord 迁移）
  id?: string              // 兼容字段：等同于 sessionId
  question?: string        // 问题内容（用于显示和降级方案）
  answer?: string          // 答案内容（用于降级方案）
  timestamp?: number       // 兼容字段：等同于 createTime
  storageKey?: string      // 存储键，用于加载消息历史（格式：ai-textbook-${resourceId} 或 ai-textbook-${resourceId}-${sessionId}）
  hasImage?: boolean       // 是否包含图片消息，用于判断接口类型
}

export type ChatCategory = 'ai-general' | 'teacher'

export type ChatEntry =
  | { mode: 'default'; category: ChatCategory }
  | { mode: 'new'; category: ChatCategory }
  | { mode: 'session'; category: ChatCategory; sessionId: string }
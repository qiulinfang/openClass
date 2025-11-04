/**
 * 聊天相关类型定义（React Native 版本）
 * 包含消息、会话、转发、组件Props等所有聊天相关类型
 */

// ========== 基础聊天类型 ==========

/** 消息类型枚举 */
export type MessageType = 'text' | 'voice' | 'image' | 'chat_record'

/** 聊天角色枚举 */
export type ChatRole = 'user' | 'ai' | 'teacher'

/** 会话类型枚举 */
export type SessionType = 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher'

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
  messageType?: MessageType
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
    base64DataUrl?: string  // base64数据URL，用于UI显示
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

/** ChatInput 组件 Props 接口（React Native 版本） */
export interface ChatInputProps {
  value: string // 对应 Web 版本的 modelValue
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
  onChange?: (value: string) => void // 对应 Web 版本的 update:modelValue
  onSend?: () => void // 对应 Web 版本的 send-message
  onFocus?: () => void // 对应 Web 版本的 focus
  onBlur?: () => void // 对应 Web 版本的 blur
  onStartVoiceInput?: (event?: any) => void // 对应 Web 版本的 start-voice-input
  onStopVoiceInput?: (event?: any) => void // 对应 Web 版本的 stop-voice-input
  onVoiceMove?: (event: any) => void // 对应 Web 版本的 voice-move
  onShowImagePicker?: () => void // 对应 Web 版本的 show-image-picker
  onToggleWebSearch?: () => void // 对应 Web 版本的 toggle-web-search
  onScrollToBottom?: () => void // 对应 Web 版本的 scroll-to-bottom
  onSelectedModelChange?: (value: string) => void // 对应 Web 版本的 update:selected-model
  onRemoveFile?: (fileId: string) => void // 对应 Web 版本的 remove-file
  onCancelEdit?: () => void // 对应 Web 版本的 cancel-edit
}

/** ChatMessage Props接口 */
export interface ChatMessageProps {
  message: ChatBubble
  type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher'
  isSelected?: boolean
  isSelectionMode?: boolean
  messageIndex?: number
  onToggleSelection?: (messageId: string) => void
  onMessageClick?: (message: ChatBubble) => void
  onForwardMessage?: (message: ChatBubble) => void
  onEnterMultiSelect?: () => void
  onEditMessage?: (message: ChatBubble) => void
  onRetry?: (messageId: string) => Promise<void>
}

/** StreamingMessage Props接口 */
export interface StreamingMessageProps {
  content: string
  isStreaming?: boolean
  typewriterSpeed?: number // 打字机速度（毫秒）
}

/** ChatScreen Props接口 */
export interface ChatScreenProps {
  type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher'
  currentQuestionId?: string
  sessionId?: string  // 教师对话会话ID
}

/** ForwardModeDialog Props接口 */
export interface ForwardModeDialogProps {
  visible: boolean // 对应 Web 版本的 modelValue
  messageCount: number
  onConfirm?: () => void
  onCancel?: () => void
}

/** ChatRecordCard Props接口 */
export interface ChatRecordCardProps {
  messages: ChatBubble[]
  additionalMessage?: string
}

// ========== 聊天相关工具类型 ==========

/** 上传文件接口（React Native 版本） */
export interface UploadedFile {
  id: string
  name: string
  uri: string // React Native 使用 URI 而不是 File 对象
  type?: string // MIME 类型
  size?: number // 文件大小（字节）
}

/** 活动模式接口 */
export interface ActiveMode {
  label: string
  icon: string
  color: string
}

/** 图片数据接口（用于发送图片消息） */
export interface ChatImageData {
  filePath: string
  width: number
  height: number
  fileSize: number
  base64DataUrl?: string  // base64数据URL，用于UI显示
}

// ========== 问题记录相关类型 ==========

/** 问题记录接口 */
export interface QuestionRecord {
  id: string
  question: string
  answer?: string
  timestamp: number
  pinned?: boolean  // 是否置顶
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

// ========== AI题目会话相关类型 ==========

/** AI题目会话接口 */
export interface AiExerciseSession {
  sessionId: string            // 会话ID
  sessionName: string          // 会话名称
  questionId: string           // 关联的题目ID
  createTime: number           // 创建时间戳
  updateTime: number           // 最后更新时间戳
  msgCount: number             // 消息数量
  messages?: ChatBubble[]      // 会话的消息列表（可选，用于加载详情）
}

// ========== AI教材会话相关类型 ==========

/** AI教材会话接口 */
export interface AiTextbookSession {
  sessionId: string            // 会话ID
  sessionName: string          // 会话名称
  subject: 'MATH' | 'BIOLOGY'  // 科目
  createTime: number           // 创建时间戳
  updateTime: number           // 最后更新时间戳
  msgCount: number             // 消息数量
  messages?: ChatBubble[]      // 会话的消息列表（可选，用于加载详情）
}

// ========== 教师会话相关类型 ==========

/** 教师会话接口 */
export interface TeacherSession {
  sessionId: string            // 会话ID
  sessionName: string          // 会话名称
  subject: 'biology' | 'math'  // 科目（小写，用于存储）
  createTime: number           // 创建时间戳
  updateTime?: number          // 最后更新时间戳（可选）
  msgCount?: number            // 消息数量（可选）
  messages?: ChatBubble[]      // 会话的消息列表（可选，用于加载详情）
}


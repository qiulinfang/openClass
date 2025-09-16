/**
 * 统一类型定义
 * 整合所有类型定义，消除重复和分散
 * 
 * 分类说明：
 * 1. 基础类型 - 通用基础类型定义
 * 2. 枚举类型 - 所有枚举定义
 * 3. 用户相关 - 用户信息和认证相关
 * 4. 题目相关 - 练习题目和相似题目
 * 5. 聊天相关 - 聊天会话和消息
 * 6. API 相关 - 请求和响应类型
 * 7. UI 相关 - 界面显示和交互
 * 8. 媒体相关 - 语音、图片等媒体文件
 * 9. 配置相关 - 环境配置和流式响应
 * 10. Android Bridge - 原生桥接相关
 */

// ========== 1. 基础类型 ==========

/** JSON 字符串类型，用于与原生交互 */
export type JSONString<T = any> = string

/** 通用 API 响应格式 */
export interface ApiResponse<T = any> {
  success: boolean
  code?: number
  message?: string
  data?: T
}

// ========== 2. 枚举类型 ==========

/** 消息类型枚举 */
export enum MessageType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
  IMAGE = 'IMAGE'
}

/** 聊天角色枚举 */
export enum ChatRole {
  CHAT_ROLE_MYSELF = 'CHAT_ROLE_MYSELF',
  CHAT_ROLE_TEACHER = 'CHAT_ROLE_TEACHER',
  CHAT_ROLE_AI = 'CHAT_ROLE_AI'
}

/** 会话类型枚举 */
export enum SessionType {
  USER_TALK_AI = 'USER_TALK_AI',
  USER_TALK_TEACHER_BIOLOGY = 'USER_TALK_TEACHER_BIOLOGY',
  USER_TALK_TEACHER_MATH = 'USER_TALK_TEACHER_MATH'
}

/** 科目枚举 */
export enum Subject {
  SUBJECT_MATH = 'SUBJECT_MATH',
  SUBJECT_BIOLOGY = 'SUBJECT_BIOLOGY',
  SUBJECT_CHEMISTRY = 'SUBJECT_CHEMISTRY',
  SUBJECT_PHYSICS = 'SUBJECT_PHYSICS',
  SUBJECT_CHINESE = 'SUBJECT_CHINESE',
  SUBJECT_ENGLISH = 'SUBJECT_ENGLISH'
}

/** 环境类型枚举 */
export type EnvType = 'RELEASE' | 'INTERNAL_TEST' | 'DEVELOPMENT'

// ========== 3. 用户相关 ==========

/** 用户信息接口 */
export interface UserInfo {
  userId: string
  userName: string
  avatar?: string
  grade?: string
  token?: string
}

// ========== 4. 题目相关 ==========

/** 练习题目接口 */
export interface ExerciseItem {
  id: string
  bmNo: string
  title: string
  question?: string // 题目内容，兼容旧版本
  answer: string
  explanation: string // aiExplanation
  analysisData: string // answerAnalysis
  subject?: string // 科目
  
  // 显示相关属性
  atUserList?: boolean
  isAiGuiding?: boolean
  userSelect?: boolean
  beginGuideToSolve?: boolean
}

/** 相似题目接口，继承 ExerciseItem 并添加相似度 */
export interface SimilarExercise extends ExerciseItem {
  similarity?: number
}

// ========== 5. 聊天相关 ==========

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


/** 转发消息数据接口 */
export interface ForwardMessageData {
  selectedMessages: import('./index').ConversationRecord[]
  teacherSessionId: string
  aiSessionId: string
}

/** 兼容类型别名 */
export type TeacherSessionType = 'USER_TALK_TEACHER_BIOLOGY' | 'USER_TALK_TEACHER_MATH'

// ========== 6. API 相关 ==========

/** AI 聊天消息请求接口 */
export interface AiChatMessageRequest {
  sessionId: string
  newValue: string
  coversation: string
  question: string
  answer: string
  name: string
  reason: string
  dstUrl?: string  // 与Java接口保持一致
  bmNo: string
  isWebSearch: string
  chatRole: string
}

/** 添加题目请求接口 */
export interface AddQuestionRequest {
  bmNo: string
  type: string
  exercisesId: string
}

/** 查找相似题目请求接口 */
export interface FindSimilarQuestionRequest {
  bmNo: string
  title: string
  answer: string
  explanation: string
  analysisData: string
  exercisesId: string
  type: string
}

/** 根据知识点查找相似题目请求接口 */
export interface FindSimilarQuestionByKnowledgeRequest {
  knowledgeNo: string
  exercisesId: string
  type: string
  size: number        // 修复：与后端字段名一致
  current: number     // 修复：与后端字段名一致
  totalCount?: number
}

/** 题目列表响应接口 */
export interface QuestionListResponse {
  questions: ExerciseItem[]
  totalCount: number
  pageSize: number
  currentPage: number
}

/** 习题查找配置接口 */
export interface FindExerciseConfig {
  apiBaseURL: string
  subject: Subject
  token: string
  knowledgeList: string
}

/** 聊天响应接口 */
export interface ChatResponse {
  success: boolean
  messageId: string
  reply: string
  timestamp: number
}

/** 老师消息响应接口 */
export interface TeacherMessageResponse {
  success: boolean
  messageId: string
  status: string
  timestamp: number
}

/** 语音录制响应接口 */
export interface VoiceRecordingResponse {
  success: boolean
  message: string
  data: string | null
}

/** 图片选择响应接口 */
export interface ImagePickerResponse {
  success: boolean
  message: string
  data: string | null
}

// ========== 7. UI 相关 ==========

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
  voiceData?: VoiceData
  imageData?: ImageData
  chatRecordData?: ChatRecordData
}

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

/** 内容块接口 */
export interface ContentBlock {
  id: string
  type: 'text' | 'formula'
  content: string
  renderedContent?: string
  isEditing?: boolean
  isSelected?: boolean
  mathfield?: any
}

/** ChatInput 组件 Props 接口 */
export interface ChatInputProps {
  modelValue: string
  placeholderText: string
  isLoading: boolean
  isRecording: boolean
  enableWebSearch: boolean
  selectedModel: string
  type: 'ai' | 'teacher'
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

// ========== 8. 媒体相关 ==========

/** 语音数据接口 */
export interface VoiceData {
  filePath: string
  duration: number
  fileSize: number
}

/** 图片数据接口 */
export interface ImageData {
  filePath: string
  width: number
  height: number
  fileSize: number
}

/** 聊天记录数据接口 */
export interface ChatRecordData {
  messages: ChatBubble[]
  additionalMessage?: string
}

/** 语音录制状态接口 */
export interface VoiceRecordingStatus {
  isRecording: boolean
  isPlaying: boolean
  currentFile: string
}

/** 图片压缩结果接口 */
export interface ImageCompressionResult {
  originalPath: string
  compressedPath: string
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

// ========== 9. 配置相关 ==========

/** HTTP 请求配置接口 */
export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  timeout?: number
  retries?: number
}

/** 流式响应配置接口 */
export interface StreamingConfig {
  /** 打字机效果速度（毫秒） */
  typewriterSpeed: number
  /** 流式响应超时时间（毫秒） */
  timeout: number
}

// ========== 10. Android Bridge 相关 ==========

/** Android Bridge 用户信息接口 */
export interface BridgeUserInfo extends UserInfo {}

/** Android Bridge 题目项接口 */
export interface BridgeExerciseItem {
  id: string
  title?: string
  content?: string
  difficulty?: number
  type?: string
  subject?: string
  createTime?: number
}

/** Android Bridge 聊天消息数据接口 */
export interface BridgeChatMessageData {
  content: string
  type: 'user' | 'ai' | 'teacher'
  exerciseId?: string
  chatRole?: string
  requestId?: string
}

/** Android Bridge 进度数据接口 */
export interface BridgeProgressData {
  currentQuestionIndex: number
  chatResponseTimes: number
  timestamp: number
}

// ========== Android Bridge 接口声明 ==========

declare global {
  interface Window {
    // Android 配置对象
    AndroidConfig?: FindExerciseConfig
    
    AndroidBridge?: {
      // 基础功能
      showToast(message: string): void
      showNotification?(message: string, type: string): void
      getUserToken(): string
      getUserInfo(): JSONString<BridgeUserInfo>
      exitActivity(): void

      // 题目相关
      getExerciseList(subject: string): JSONString<BridgeExerciseItem[]>
      deleteExercise(exerciseId: string, subject: string): void
      addQuestionToList(questionData: JSONString<BridgeExerciseItem>, subject: string): void
      findSimilarQuestions(questionData: JSONString<BridgeExerciseItem>, subject: string): JSONString<SimilarExercise[]>
      
      // 习题查找相关
      startExerciseSolve?(): void
      finishActivity?(): void
      showToast?(message: string): void

      // 聊天功能
      sendChatMessage(messageData: JSONString<BridgeChatMessageData>): JSONString<ChatResponse>
      sendMessageToTeacher(messageData: JSONString<BridgeChatMessageData>): JSONString<ChatResponse>

      // 进度保存
      saveExerciseProgress(progressData: JSONString<BridgeProgressData>): void

      // 拍照搜题
      startPhotoSearch(subject: string): void

      // 语音相关
      startVoiceRecording(): string
      stopVoiceRecording(): string
      cancelVoiceRecording(): string
      playVoiceMessage(filePath: string): string
      stopVoicePlayback(): string
      sendVoiceMessage(filePath: string, duration: string, chatId: string): string
      getVoiceRecordingStatus(): string

      // 图片相关
      selectImageFromGallery(): string
      captureImageFromCamera(): string
      showImagePickerDialog(): string
      sendImageMessage(filePath: string, chatId: string): string
      compressImage(filePath: string, quality: number): string
      deleteImageFile(filePath: string): string
      checkImageResult?(): string

      // 老师对话相关
      createTeacherChatSession?(aiSessionId: string, aiSessionName: string, subject: string): string
      sendTextMessageToTeacher?(content: string, sessionId: string, subject: string): string
      sendVoiceMessageToTeacher?(voicePath: string, duration: string, sessionId: string, subject: string): string
      sendPictureToTeacher?(imagePath: string, sessionId: string, subject: string): string
      forwardAiChatToTeacher?(selectedMessagesData: string, teacherSessionId: string): string
      getTeacherChatHistory?(sessionId: string): string
      checkTeacherSessionExists?(sessionId: string): string
      getCurrentSessionMessageCount?(sessionId: string): string
      initTeacherMessageListener?(): string
      cleanupTeacherMessageListener?(): string
    }

    // Android 事件回调
    onAndroidReady?(): void
    onExerciseDeleted?(exerciseId: string): void
    onQuestionAdded?(questionData: any): void
    onProgressSaved?(progressData: any): void
    onDataUpdate?(type: string, data: any): void
    onExerciseListUpdated?(questions: any): void
    onLoadingStateChanged?(isLoading: boolean): void
    onSubjectChanged?(subjectName: string): void
    onVoiceRecognitionResult?(text: string): void
    onVoicePlaybackCompleted?(filePath: string): void
    onImageSelected?(imageInfo: any): void
    onImageCaptured?(imageInfo: any): void
    onTeacherMessage?(message: any): void
    onTeacherMessageReceived?(messageData: any): void
    onStreamResponse?(requestId: string, chunk: string, isComplete: boolean): void
    onChatResponse?(requestId: string, response: any): void
  }
}

export {}
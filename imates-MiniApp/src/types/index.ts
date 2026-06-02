export enum Sender {
  USER = 'user',
  AI = 'ai',
  TEACHER = 'teacher',
  SYSTEM = 'system',
}

export interface ChatBubble {
  id: string;
  sender: Sender;
  type: Sender;
  content: string;
  timestamp: string;
  sessionId: string;
  messageId?: string;
  messageType?: 'text' | 'image' | 'multi_image' | 'time_separator' | 'voice' | 'chat_record' | 'html';
  isRead?: boolean;
  isStreaming?: boolean;
  isError?: boolean;
  canRetry?: boolean;
  retryCount?: number;
  originalMessage?: string;
  selectedModel?: string;
  originalDstUrl?: string;
  rawHtml?: string;
  rawHtmlMap?: Record<string, [string, string?]>;
  imageData?: {
    filePath: string;
    width: number;
    height: number;
    fileSize: number;
    base64DataUrl?: string;
  };
  imageList?: Array<{
    url?: string;
    width?: number;
    height?: number;
    fileSize?: number;
    filePath?: string;
    base64DataUrl?: string;
    isLargeImage?: boolean;
  }>;
  voiceData?: {
    filePath: string;
    duration: number;
    fileSize: number;
  };
  quotedMessage?: {
    id: string;
    content: string;
    sender: Sender;
  };
  chatRecordData?: {
    messages: ChatBubble[];
    additionalMessage?: string;
  };
}

export interface AiChatMessageRequest {
  sessionId: string;
  newValue: '0' | '1';
  coversation: string;
  question: string;
  answer: string;
  name: string;
  reason: string;
  bmNo: string;
  isWebSearch: '0' | '1';
  role: string;
  subject: string;
  dstUrl: string;
  explanation: string;
  sectionName?: string;
  chapter_info?: {
    grade: string;
    subject: string;
    textbook: string;
    chapter_title: string;
  };
  imageList?: Array<{ base64DataUrl: string }>;
  focus?: any;
}

export interface BackendHistoryMessage {
  id: string;
  content: string;
  sender: 'human' | 'ai';
  timestamp: string;
}

export interface AttachedScreenshot {
  id: string;
  url: string;
  width: number;
  height: number;
}

// ========== 教材相关类型 ==========

/**
 * 教材选择器选项
 */
export interface TextbookOption {
  value: string // 选项值
  label: string // 显示标签
  textbookId: string // 教材ID
  subject: string // 学科
  grade: string // 年级
  semester: string // 学期
  publisher: string // 出版社
  cover: string // 封面图片URL
}

/**
 * 章节节点
 */
export interface ChapterNode {
  id: string // 章节唯一标识
  name: string // 章节名称
  parentId?: string | null // 父章节ID
  label: string // 章节标签
  level: number | null // 章节层级
  isRoot: boolean // 是否为根节点
  updateTime: string // 更新时间
  children?: ChapterNode[] // 子章节列表
}

/**
 * 学习资源包
 */
export interface LearningPackage {
  id: string // 资源包唯一标识
  packageId?: string // 资源包ID（与id相同，用于兼容性）
  sectionId: string // 章节ID
  packageName: string // 资源包名称
  description: string // 资源包描述
  updateTime: string // 更新时间
  isDefault: number // 是否为默认方案
  userId: string // 用户ID
  releaseStatus: boolean // 发布状态
  visibility: number // 可见性
  authors: string // 作者信息
  tags: string // 标签信息
  resourceList: ResourceFile[] // 资源文件列表
  localFiles?: LocalFileInfo[] // 本地文件信息列表
}

/**
 * 资源文件
 */
export interface ResourceFile {
  id: string // 资源文件唯一标识
  packageId?: string // 资源包ID
  fileName: string // 文件名
  fileUrl: string // 文件下载URL
  checksum: string // 文件校验和
  size: number // 文件大小（字节）
  mimeType?: string | null // MIME类型
  directoryId?: string | null // 目录ID
  uploadTime: string // 上传时间
  previewCount: number // 预览次数
  downloadCount: number // 下载次数
}

/**
 * 本地文件信息（元数据）
 */
export interface LocalFileInfo {
  id: string // 文件唯一标识
  fileName: string // 文件名
  fileSize: number // 文件大小（字节）
  checksum: string // 文件校验和
  isDownloaded: boolean // 是否已下载
  localPath?: string // 本地文件路径
  thumbnail?: string // PDF缩略图（base64格式）
  annotations?: Record<number, object[]> // PDF注释数据
}

// ========== 题目相关类型 ==========

/** 结构化题目选项 */
export interface StructuredOption {
  label: string
  text: string
}

/** 结构化题目内容 */
export interface StructuredQuestionContent {
  id?: string
  subject?: string
  score?: number
  type?: string
  stem: string
  analysis?: string
  options?: StructuredOption[]
  answer?: string | string[]
  blanks?: number
  judgmentResult?: boolean
}

/** 练习题目接口 */
export interface ExerciseItem {
  id: string
  bmNo?: string
  title?: string
  question?: string
  answer?: string
  explanation?: string
  analysisData?: string
  subject?: string
  type?: string
  questionContent?: string
  questionReason?: string
  questionChooseInfo?: string
  questionChooseList?: string[]
  questionStructureData?: string
  structuredContent?: StructuredQuestionContent
  atUserList?: boolean
  isAiGuiding?: boolean
  userSelect?: boolean
  beginGuideToSolve?: boolean
  material?: string
  subQuestions?: any[]
}

// ========== 作业相关类型 ==========

/** 未完成作业列表项 */
export interface HomeworkUndoItem {
  id: string
  title: string
  subject: string
  totalScore: string
  releaseTime: string
  deadline: string
  fullSubmit: string
  lateSubmit: string
  resubmit: string
  status: string
  remark: string
}

/** 作业问题详情项 */
export interface HomeworkQuestionDetail {
  id: string
  questionId: string
  questionContent: string
  questionAnswer?: string
  questionAnalysis?: string
  questionReason?: string
  questionStructureData?: string
  questionChooseInfo?: string
  questionChooseList?: string[]
}

/** 转发模式对话框属性 */
export interface ForwardModeDialogProps {
  modelValue: boolean;
  messageCount: number;
}

/** 聊天记录卡片属性 */
export interface ChatRecordCardProps {
  messages: ChatBubble[];
  additionalMessage?: string;
}

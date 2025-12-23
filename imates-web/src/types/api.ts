/**
 * API相关类型定义
 * 包含所有API请求和响应类型
 */


// ========== 聊天相关API ==========

/** AI 聊天消息请求接口 */
export interface AiChatMessageRequest {
  sessionId: string
  newValue: string
  coversation: string
  question: string
  answer: string
  name: string
  reason: string
  dstUrl: string  // 与Java接口保持一致
  bmNo: string
  isWebSearch: string
  role: string,
  subject: string,
  sectionName?: string,
  chapter_info?: {
    grade: string
    subject: string
    textbook: string
    chapter_title: string
  },
  explanation: string
  /** 截图会话使用的图片列表（单图或多图），目前用于教材/截图场景 */
  imageList?: Array<{
    base64DataUrl: string
  }>
}

/** 聊天响应接口 */
export interface ChatResponse {
  success: boolean
  messageId: string
  reply: string
  timestamp: number
}

// ========== 对话记忆管理 API ==========

/** 对话记忆管理指令 */
export type ManageMemoryCommand = 'delete_messages' | 'delete_thread'

/** 对话记忆管理关联的智能体名称 */
export type AgentName = 'chatbot' | 'solvingbot'

/** 对话记忆管理请求体 */
export interface ManageConversationMemoryRequest {
  /** 操作指令：delete_messages / delete_thread */
  command: ManageMemoryCommand
  /** 要操作的对话线程唯一 ID（必填） */
  thread_id: string
  /** 起始消息 ID（command 为 delete_messages 时必填，delete_thread 时忽略） */
  message_id?: string
  /** 关联智能体名称，仅支持 chatbot / solvingbot */
  agent_name: AgentName
}

/** 老师消息响应接口 */
export interface TeacherMessageResponse {
  success: boolean
  messageId: string
  status: string
  timestamp: number
}

// ========== 题目相关API ==========

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

export interface FindSimilarQuestionByBmNoRequest {
  bmNoList: string
  exercisesId: string
  type: string
  size: number
  current: number
  totalCount?: number
}

// ========== 反馈相关API ==========

/** 反馈工单创建请求接口 */
export interface FeedbackTicketRequest {
  title: string
  group: string
  customer: string
  article: {
    subject: string
    body: string
    type: string
    internal: boolean
    attachments?: Array<{
      filename: string
      data: string
      'mime-type': string
    }>
  }
}

/** 反馈工单创建响应接口 */
export interface FeedbackTicketResponse {
  success: boolean
  message?: string
  data?: {
    id: number
    number: string
    title: string
    state: string
    priority: string
    created_at: string
  }
}

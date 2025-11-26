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
  dstUrl?: string  // 与Java接口保持一致
  bmNo: string
  isWebSearch: string
  chatRole: string,
  subject: string,
  explanation?: string
  focus?: string  // 引用的消息内容
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

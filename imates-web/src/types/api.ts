/**
 * API相关类型定义
 * 包含所有API请求和响应类型
 */


// ========== 聊天相关API ==========

/** HTML 预览焦点对象 */
export interface HtmlPreviewFocus {
  type: 'html'
  value: string
  change: Array<{
    type: string
    ts: number
    data: any
  }>
  screenshot: string | null
}

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
  /** 图片 URL（用于 /ai/2.0/chatMath 与 /ai/2.0/chat 等文本对话接口透传图片链接） */
  image_url?: string
  /** 可选：前端额外上下文（如 html-preview 的 focus 对象） */
  focus?: HtmlPreviewFocus
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

// ========== 作业管理 API ==========

/** 作业查询请求 */
export interface HomeworkQueryReq {
  pageNumber?: number
  pageSize?: number
  name?: string
  subject?: string
  status?: string
  date?: string
}

/** 作业查询响应 */
export interface HomeworkQueryResp {
  id: string
  name: string
  subject: string
  status: string
  createTime: string
  updateTime: string
  releaseTime?: string
  questionCount?: number
}


/** 作业详情响应 */
export interface HomeworkInfoResp {
  id: string
  name: string
  subject: string
  description?: string
  status: string
  createTime: string
  updateTime: string
  releaseTime?: string
  deadline?: string
  questions?: Record<string, unknown>[]
  classes?: Record<string, unknown>[]
}

/** 通用ID请求 */
export interface IdReq {
  id: string
}

/** 通用分页响应 */
export interface PageResponse<T> {
  /** 记录列表 */
  records: T[]
  /** 总记录数 */
  total: number
  /** 每页大小 */
  pageSize: number
  /** 当前页码 */
  pageNumber: number
  /** 总页数 */
  pages: number
}

/** 作业提交保存请求 */
export interface HomeworkSubmitSaveReq {
  /** 作业ID */
  homeworkId: string
  /** 问题回答列表 */
  questionAnswerList: HomeworkQuestionAnswer[]
}

/** 作业问题回答 */
export interface HomeworkQuestionAnswer {
  /** 问题ID */
  questionId: string
  /** 回答图片列表 */
  answerList: string[]
  chooseList?: string[]
}

/** 未完成作业列表项 */
export interface HomeworkUndoItem {
  /** 作业唯一 ID */
  id: string
  /** 作业标题（例如：“初一数学课后练习”） */
  title: string
  /** 学科编码（如 1 代表数学，需配合字典接口显示文字） */
  subject: string
  /** 该份作业的总分 */
  totalScore: string
  /** 作业发布时间 */
  releaseTime: string
  /** 提交截止时间 */
  deadline: string
  /** 
   * 是否要求一次性提交
   * 1: 必须把所有题目都做完才能点击提交
   * 0: 可以做一部分先交一部分（保存进度）
   */
  fullSubmit: string
  /** 
   * 是否允许补交
   * 1: 截止时间后仍可提交，但会标记为“迟交”
   * 0: 截止后禁止提交
   */
  lateSubmit: string
  /** 
   * 是否允许重复提交
   * 1: 提交后可以修改答案再次提交，覆盖旧答案
   * 0: 提交后不可修改
   */
  resubmit: string
  /** 作业当前状态（1:已发布, 3:已结束） */
  status: string
  /** 老师填写的作业说明或注意事项 */
  remark: string
}

/** 作业问题详情项 */
export interface HomeworkQuestionDetail {
  /** 作业详情ID */
  id: string
  /** 问题ID */
  questionId: string
  /** 问题内容 */
  questionContent: string
  /** 问题答案 */
  questionAnswer?: string
  /** 问题解析 */
  questionAnalysis?: string
  /** 问题原因 */
  questionReason?: string
  /** 结构化数据 (JSON string) */
  questionStructureData?: string
  /** 问题选项 */
  questionChooseInfo?: string
  /** 问题选项列表 */
  questionChooseList?: string[]
}

// ========== 手写公式识别 API ==========

/** 手写公式识别请求 (Base64 JSON) */
export interface RecognizeHandwrittenFormulaJsonRequest {
  /** 图片 Base64 数据（包含 data:image/xxx;base64, 前缀） */
  file: string
  /** 文件名 */
  filename: string
}

/** 手写公式识别响应 */
export interface RecognizeHandwrittenFormulaResponse {
  /** 主识别结果 (LaTeX) */
  latex: string
  /** 候选公式列表 */
  candidates: string[]
  /** 候选数量 */
  formula_count: number
  /** 消息 */
  message: string
}

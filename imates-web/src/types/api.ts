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
  /** 回答数据 */
  answerData?: string[]
  /** 回答图片列表 */
  answerList?: string[]
  /** 选项列表 */
  chooseList?: string[]
}

/** 填空题/主观题的具体作答载荷 */
export interface AnswerDetail {
  /** 数据类型：'text' (文本输入) | 'img' (图片，包含照片与手写板图片上传后的URL) */
  type: 'text' | 'img'
  /** 
   * 具体答案数据：
   * - 'text': 文本字符串
   * - 'img': 图片的 OSS 地址或云端相对路径
   */
  content: string
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

// ========== 填空题手写 OCR 判罚 API ==========

/** 填空要点信息 */
export interface OcrGradeBlankItem {
  /** 空 ID */
  blankId: string
  /** 标准答案列表 */
  standardAnswers: string[]
  /** 手写答案裁剪图 URL 或 Base64 (如果提供) */
  answerImageUrl?: string
}

/** 填空题手写 OCR 判罚请求 */
export interface FillBlankHandwritingOcrGradeRequest {
  /** 请求唯一 ID */
  requestId?: string
  /** 完整题目文本 */
  completeQuestion?: string
  /** 当前题目文本 (含 [blank_x] 占位) */
  currentQuestion?: string
  /** 单个空白图 OCR 模式参数 (可选) */
  ocrOnly?: boolean
  /** 整题图 URL (可选，若不为空且 blanks 中各项目无对应切图则通常识别整图) */
  image_url?: string
  /** 兼容 OSS 地址 (可选) */
  oss_url?: string
  /** 逐空明细数据 */
  blanks?: OcrGradeBlankItem[]
}

/** 识别出来的手写细节项 */
export interface OcrHandwritingItem {
  /** 序号 */
  itemIndex: number
  /** 识别出来的手写文本 */
  text: string
  /** 在图片中的推断位置 */
  location?: string
  /** 置信度：high, medium, low */
  confidence?: 'high' | 'medium' | 'low'
}

/** 逐空判罚结果项 */
export interface OcrBlankResultItem {
  /** 空 ID */
  blankId: string
  /** 识别出的学生手写答案 */
  studentAnswer: string
  /** 标准答案数组 */
  standardAnswers?: string[]
  /** 是否正确 */
  isCorrect?: boolean | null
  /** 判罚结果状态 */
  judgement?: 'correct' | 'incorrect' | 'partial' | 'unknown'
  /** 置信度 */
  confidence?: 'high' | 'medium' | 'low'
  /** 是否需要复核 */
  needReview?: boolean
  /** 匹配策略 */
  matchingStrategy?: 'NORMALIZED_EXACT_MATCH' | 'LENIENT_LIST_MATCH' | 'MODEL_SEMANTIC' | 'OCR_ONLY' | string
  /** 判罚原因 */
  reason?: string
}

/** 填空题手写 OCR 判罚响应 */
export interface FillBlankHandwritingOcrGradeResponse {
  /** 状态 */
  status: 'success' | string
  /** 请求唯一 ID */
  requestId?: string
  /** 是否只做 OCR 识别 */
  ocrOnly?: boolean
  /** 整体正确性汇总 */
  studentAnswer?: string
  /** 逐空明细判罚结果 */
  blankResults?: OcrBlankResultItem[]
  /** 兼容蛇形字段命名 */
  blank_results?: OcrBlankResultItem[]
  /** 整图多文本手写识别明细 */
  handwritingItems?: OcrHandwritingItem[]
  /** 兼容蛇形字段命名 */
  handwriting_items?: OcrHandwritingItem[]
  /** 整体数据汇总 */
  overall?: {
    correctCount: number
    totalCount: number
    needReview: boolean
  }
  /** 包裹的返回实体数据，用于向下兼容 */
  data?: {
    blankResults?: OcrBlankResultItem[]
    blank_results?: OcrBlankResultItem[]
    handwritingItems?: OcrHandwritingItem[]
    handwriting_items?: OcrHandwritingItem[]
  }
}

/** 更新头像 API 响应类型 */
export interface UpdateAvatarResult {
  avatar: string
}

// ========== 作业提交批改详情 API ==========

/** OCR 框图与识别区域 */
export interface JudgeOcrRegion {
  /** 识别源文件索引序号 */
  source_index?: number
  /** 识别源文件索引序号（驼峰形式兼容） */
  sourceIndex?: number
  /** 文本切图在图片中的像素坐标范围 [x1, y1, x2, y2] */
  bbox?: number[]
  /** 识别出的手写文本或公式内容 */
  text?: string
  /** 识别置信度等级（如 high, medium, low） */
  confidence?: string
  /** 文字或公式是否模糊不清 */
  vague?: boolean
  /** 后处理更正后的文本内容 */
  corrected_text?: string
  /** 是否保留该识别区域 */
  keep?: boolean
  /** 是否需要人工复核该区域 */
  review_required?: boolean
}

/** 采分点匹配项 */
export interface JudgeScorePoint {
  /** 采分点唯一标识符 ID */
  pointId: string
  /** 学生作答是否命中该采分点 */
  hit: boolean
  /** 学生实际获得的得分 */
  score: number
  /** 该采分点的满分分值 */
  maxScore: number
}

/** 批改得分汇总 */
export interface JudgeScoreSummary {
  /** 自动判罚过程是否发生异常或失败 */
  autoJudgeFailed?: boolean
  /** 学生作答命中的采分点数量 */
  hitCount?: number
  /** 本题的最大总分 */
  maxScore?: number
  /** 本题的总采分点数量 */
  pointCount?: number
  /** 各采分点的具体得分详情列表 */
  points?: JudgeScorePoint[]
  /** 本题最终获得的总得分 */
  score?: number
}

/** 子题结构化数据 */
export interface SubQuestionStructureItem {
  /** 子题唯一标识 ID */
  id: string
  /** 子题题型名称（如 subjective, single_choice 等） */
  type: string
  /** 子题题干描述文本 */
  stem?: string
  /** 子题解析说明 */
  analysis?: string
  /** 子题标准答案 */
  answer?: string
  /** 子题分类类别 */
  question_category?: string
}

/** 题目结构数据 (questionStructureData 解析后) */
export interface QuestionStructureData {
  /** 解析处理状态（如 success） */
  status?: string
  /** 题目核心实体信息 */
  question?: {
    /** 主题目唯一标识 ID */
    id: string
    /** 学科名称（如 math） */
    subject?: string
    /** 题目满分分值 */
    score?: number | null
    /** 题目类型（如 composite 复合大题） */
    type?: string
    /** 题目主干说明文本 */
    stem?: string
    /** 题目整体解析 */
    analysis?: string
    /** 题目材料背景 */
    material?: string
    /** 包含的子题列表 */
    subQuestions?: SubQuestionStructureItem[]
    /** 题目分类 */
    question_category?: string
    /** 预分类大模型提示词与信号信息 */
    pre_classification?: Record<string, any>
  }
  /** 后端 AI 处理耗时（如 "23.26s"） */
  processing_time?: string
  /** 调用的大语言模型名称 */
  llm_model?: string
  /** LLM API 服务 Base URL */
  llm_base_url?: string
  /** 模型调用签名标识 */
  llm_signature?: string
}

/** 学生作答数据项 (questionAnswerData 解析后) */
export interface QuestionAnswerDataItem {
  /** 子题或题目 ID */
  questionId: string
  /** 学生作答内容/图片地址列表 */
  answerData?: string[]
}

/** 批改修订数据项 (questionRevisedData 解析后) */
export interface QuestionRevisedDataItem {
  /** 子题或题目 ID */
  questionId: string
  /** 作答资源地址列表 */
  answerData?: string[]
  /** 对应的得分汇总详情 */
  scoreSummary?: JudgeScoreSummary
}

/** 骨架对齐明细 */
export interface SkeletonAlignmentItem {
  /** 该推导骨架标准节点是否达成 */
  criterion_met: boolean
  /** 未达成或达成的推理依据与原因 */
  criterion_reason?: string
  /** 错误分类类型（如 calculation_error, expression_missing 等） */
  error_type?: string
  /** 学生作答中是否存在对应步骤证据 */
  is_present?: boolean
  /** 匹配到的学生 OCR 文本坐标区域列表 */
  matched_ocr_regions?: JudgeOcrRegion[]
  /** 存在或不存在的说明原因 */
  present_reason?: string
  /** 对应的标准解法节点 ID */
  standard_node_id?: string
  /** 是否覆盖了模糊逻辑判定 */
  vague_overridden?: boolean
}

/** 采分点 Payload 规则数据 */
export interface ScorePayloadItem {
  /** 是否满足判罚标准 */
  criterion_met: boolean
  /** 错误类型标识 */
  error_type?: string
  /** 采分点命中描述文本 */
  hit_description?: string
  /** 作答中是否存在判定证据 */
  is_present?: boolean
  /** 关联的 OCR 区域列表 */
  matched_ocr_regions?: JudgeOcrRegion[]
  /** 潜在错误原因说明 */
  potential_error_reason?: string
  /** 潜在错误类型 */
  potential_error_type?: string
  /** 该节点已给得分 */
  score_awarded?: number
  /** 该节点最高分值 */
  score_max?: number
  /** 对应的标准节点 ID */
  standard_node_id?: string
  /** 是否覆盖模糊判定 */
  vague_overridden?: boolean
}

/** 判罚风险警告项 */
export interface JudgeRiskItem {
  /** 风险类型代码（如 FORMULA_DENSE, JUMP_OR_SPARSE_PROCESS 等） */
  code: string
  /** 风险严重等级（high, medium, low） */
  severity: string
  /** 风险描述提示信息 */
  message: string
  /** 建议采纳的操作动作（如“建议人工复核”） */
  suggestedAction?: string
  /** 触发风险的证据数据对象 */
  evidence?: Record<string, any>
}

/** 单个节点的 AI 判罚结果 */
export interface JudgeNodeResult {
  /** 自动判罚是否失败 */
  autoJudgeFailed?: boolean
  /** 节点全局 ID */
  nodeId?: string
  /** 节点层级标签（如 "主题目 > 子题 1"） */
  nodeLabel?: string
  /** 对应的题目或子题 ID */
  questionId?: string
  /** 题目类型 */
  questionType?: string
  /** 识别出的 OCR 区域数组 */
  ocr_regions?: JudgeOcrRegion[]
  /** OCR 识别出的整体文本内容 */
  ocr_text?: string
  /** 重新整理后的学生作答步骤描述 */
  rearrange_students_answer?: string
  /** 区域识别集合 */
  regions?: JudgeOcrRegion[]
  /** AI 两阶段解析输出结果 */
  parserOutput?: {
    /** 阶段 1：解法匹配与主旨判定 */
    stage_1?: Record<string, any>
    /** 阶段 2：推导骨架对齐与潜在问题诊断 */
    stage_2?: {
      skeleton_alignment?: SkeletonAlignmentItem[]
      student_potential_issues?: string[]
    }
  }
  /** 判罚路由与规则 Payload 结果 */
  route?: {
    /** 执行的操作路由动作（如 PROCEED_TO_VERIFIER） */
    action?: string
    /** 是否需要教师介入介入标识 */
    need_teacher?: boolean
    /** 触发理由 */
    reason?: string
    /** 逐采分点明细规则荷载 */
    payload?: ScorePayloadItem[]
  }
  /** 得分汇总 */
  scoreSummary?: JudgeScoreSummary
  /** 判罚使用策略（如 RULE_THEN_PARSER_AGENT） */
  strategy?: string
  /** 学生答题潜在问题点汇总列表 */
  studentPotentialIssues?: string[]
  /** 主观题智能诊断报告与风险评估 */
  subjectiveDiagnostics?: {
    /** 是否需要教师人工复核 */
    needTeacherReview?: boolean
    /** 整体风险等级（如 high, medium, low） */
    overallRisk?: string
    /** 风险列表明细 */
    risks?: JudgeRiskItem[]
  }
}

/** AI 智能判罚详细分析数据 (questionJudgeDataData 解析后) */
export interface QuestionJudgeData {
  /** 解法推导图谱与标准解法节点列表 */
  analysisNodes?: any[]
  /** 自动生成的上下文调试配置 */
  autoGeneratedContext?: Record<string, any>
  /** 各子题/节点的 AI 判罚评估结果集 */
  results?: JudgeNodeResult[]
}

/** 作业提交批改详情单项 (后端 /homework-submit-judge-detail 返回数据项) */
export interface HomeworkSubmitJudgeDetailItem {
  /** 记录唯一标识 ID */
  id: string
  /** 所属作业 ID */
  homeworkId: string
  /** 提交记录 ID */
  submitId: string
  /** 题目 ID */
  questionId: string
  /** 题目结构数据 JSON 字符串（解出来为 QuestionStructureData） */
  questionStructureData?: string
  /** 学生回答数据 JSON 字符串（解出来为 QuestionAnswerDataItem[]） */
  questionAnswerData?: string
  /** 批改修改数据 JSON 字符串（解出来为 QuestionRevisedDataItem[]） */
  questionRevisedData?: string
  /** AI 智能判罚数据 JSON 字符串或对象（解出来为 QuestionJudgeData） */
  questionJudgeDataData?: string | QuestionJudgeData
}

/** 作业提交批改详情响应数据结构 */
export interface HomeworkSubmitJudgeDetailResponse {
  /** 业务响应状态码 */
  code?: number
  /** 接口调用是否成功 */
  success?: boolean
  /** 响应消息提示 */
  message?: string
  /** 响应消息提示（兼容字段） */
  msg?: string
  /** 返回的批改详情单项或列表数据 */
  data?: HomeworkSubmitJudgeDetailItem[] | HomeworkSubmitJudgeDetailItem
}



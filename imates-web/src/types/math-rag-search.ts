/**
 * MathRAG v2 拍照搜题与同题判定接口类型定义
 * 参考: 拍照搜题接口文档(1).md
 */

/** 同题判定标签 */
export type SameQuestionLabel = 'same' | 'likely_same' | 'similar' | 'different'

/** 数学条件冲突类型 */
export type MathConflictType =
  | 'number_conflict'
  | 'target_conflict'
  | 'topic_conflict'
  | 'goal_conflict'
  | 'strong_math_condition_conflict'
  | string

/** 单个同题判断数据 */
export interface SameQuestionDetail {
  label: SameQuestionLabel
  is_same: boolean | null
  probability: number
  threshold: number
  likely_threshold: number
  conflicts: MathConflictType[]
  evidence?: {
    small_probability?: number
    large_probability?: number
    sequence_ratio?: number
    number_query_coverage?: number
    [key: string]: any
  }
  model?: string
}

/** 单个搜题候选结果 */
export interface MathRagSearchResultItem {
  id: number | string
  question: string
  score: number
  same_question: SameQuestionDetail
  [key: string]: any
}

/** 1. 拍照搜题请求参数 (/v2/search_image) */
export interface SearchImageRequest {
  /** OCR 或公式识别后的完整题目文本 */
  ocr_text: string
  /** OCR 整体置信度，取值范围 0~1 */
  ocr_confidence?: number | null
  /** 预留字段，当前服务端不执行图片 OCR */
  image_base64?: string | null
  /** 返回候选数量，范围 1~20，默认 5 */
  k?: number
  /** 是否返回详细匹配特征，默认 true */
  explain?: boolean
}

/** 1. 拍照搜题响应体 (/v2/search_image) */
export interface SearchImageResponse {
  source?: string
  ocr_text?: string
  best_score?: number | null
  is_same_question?: boolean | null
  same_question_label?: SameQuestionLabel | string | null
  question_bank_hit?: boolean
  question_bank_hit_label?: SameQuestionLabel | string | null
  question_bank_auto_reusable?: boolean
  ocr_confidence?: number | null
  ocr_low_confidence?: boolean
  ocr_low_confidence_threshold?: number
  auto_judgement_failed?: boolean
  auto_judgement_failure_reason?: string | null
  results?: MathRagSearchResultItem[]
  reason?: string
  message?: string
  image_received?: boolean
}

/** 2. 文本搜题请求参数 (/v2/search) */
export interface SearchTextRequest {
  query: string
  k?: number
  candidate_pool?: number
  min_score?: number
  explain?: boolean
  solve_fallback?: boolean
}

/** 2. 文本搜题响应体 (/v2/search) */
export interface SearchTextResponse {
  query?: string
  results?: MathRagSearchResultItem[]
  [key: string]: any
}

/** 3. 两题直接对比请求参数 (/v2/same_question) */
export interface SameQuestionRequest {
  query: string
  candidate: string
}

/** 3. 两题直接对比响应体 (/v2/same_question) */
export type SameQuestionResponse = SameQuestionDetail

/** 4. 服务健康检查响应体 (/v2/health) */
export interface MathRagHealthResponse {
  status: string
  index_size: number
  mode: string
  same_question_model: {
    loaded: boolean
    [key: string]: any
  }
  [key: string]: any
}

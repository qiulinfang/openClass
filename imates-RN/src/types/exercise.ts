/**
 * 题目相关类型定义
 * 包含练习题目、相似题目、查找配置、API请求等所有题目相关类型
 */

export type Subject = 'MATH' | 'BIOLOGY'

// ========== 基础题目类型 ==========

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

/** 题目列表响应接口 */
export interface QuestionListResponse {
  questions: ExerciseItem[]
  totalCount: number
  pageSize: number
  currentPage: number
}

// ========== 题目查找配置 ==========

/** 习题查找配置接口 */
export interface FindExerciseConfig {
  apiBaseURL: string
  subject: Subject
  token: string
  knowledgeList: string
}


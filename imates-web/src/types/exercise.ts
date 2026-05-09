/**
 * 题目相关类型定义
 * 包含练习题目、相似题目、查找配置、API请求等所有题目相关类型
 */

import type { AllSubjectType } from '@/constants/subjects'

// ========== 基础题目类型 ==========

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
  bmNo: string
  title: string
  question?: string // 题目内容，兼容旧版本
  answer: string
  explanation: string // aiExplanation
  analysisData: string // answerAnalysis
  subject?: string // 科目
  type?: string // 题目类型 (choice, fill, judgment, essay)
  questionContent?: string // 完整题目内容 (包含图片和文字)
  
  // 结构化相关
  questionStructureData?: string
  structuredContent?: StructuredQuestionContent

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
  token?: string
  subject: AllSubjectType
  knowledgeList?: string
  sectionId?: string
  sectionName?: string
  bmNoList?: string
  isLearningMode?: boolean
}

/**
 * QuestionList 策略模式 - 类型定义
 */

import type { ExerciseItem } from '../../../types'

/**
 * 加载题目的选项
 */
export interface FetchQuestionsOptions {
  /** 学科 */
  subject?: string
  /** 是否优先使用本地缓存 */
  useLocalFirst?: boolean
}

/**
 * 删除题目的选项
 */
export interface DeleteQuestionOptions {
  /** 学科 */
  subject?: string
  /** 是否同时删除聊天记录 */
  deleteChat?: boolean
}

/**
 * 题目列表类型
 */
export type QuestionListType = 'exercise' | 'homework' | 'mistake'

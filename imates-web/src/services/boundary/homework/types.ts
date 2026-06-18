/**
 * 作业边界层类型定义
 * 描述 API / 持久化 与领域模型之间的中间数据结构
 */

import type { ExerciseItem } from '@/types'

/** IndexedDB 中按题目 ID 存储的 legacy 作答缓存项 */
export interface LegacyAnswerCacheItem {
  chooseList?: string[]
  judgmentValue?: string
  fillList?: Array<string | Record<string, unknown>>
  compositeAnswers?: Record<string, unknown>
  subjectiveData?: unknown
  boardData?: unknown
  imageData?: string | null
}

/** 提交前的中间作答结构（含复合题嵌套，尚未扁平化） */
export interface IntermediateQuestionAnswer {
  questionId: string
  type: string
  answers: string | string[] | IntermediateQuestionAnswer[]
  images?: string[]
}

/** 写入 IndexedDB 的作业提交载荷（不含 timestamp） */
export interface HomeworkSubmissionPayload {
  homeworkId: string
  homeworkName: string
  isSubmitted: boolean
  answerDataCache: Record<string, LegacyAnswerCacheItem>
  questions: ExerciseItem[]
}

/** 从存储层恢复时的 hydrate 选项 */
export interface HydrateFromStorageOptions {
  storedQuestions?: ExerciseItem[]
  legacyCache?: Record<string, LegacyAnswerCacheItem>
}

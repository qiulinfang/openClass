/**
 * 题目领域模型绑定：初始化作答字段
 */

import type { ExerciseItem } from '@/types'
import { getQuestionStrategy } from '@/utils/business/question-strategies'

/** 初始化题目的作答结构化数据字段 */
export function initExerciseAnswerFields(exercise: ExerciseItem): void {
  if (!exercise.structuredContent) {
    const anyEx = exercise as ExerciseItem & { stem?: string }
    exercise.structuredContent = {
      stem: anyEx.stem || exercise.title || exercise.question || '',
      type: exercise.type || 'subjective',
    }
  }

  const structured = exercise.structuredContent

  if (structured.userAnswer === undefined) {
    structured.userAnswer = getQuestionStrategy(exercise.type).getDefaultAnswer()
  }

  // 仅对非主观题初始化单独的 boardData 字段以作向下兼容，主观题和新版填空题直接使用 userAnswer 内的画板字段
  if (structured.boardData === undefined && exercise.type !== 'subjective' && exercise.type !== 'fill_in_blank') {
    structured.boardData = { objects: [], history: [[]], historyIndex: 0 }
  }

  if (structured.imageData === undefined) {
    structured.imageData = null
  }

  if (exercise.subQuestions && Array.isArray(exercise.subQuestions)) {
    exercise.subQuestions.forEach((sub) => initExerciseAnswerFields(sub))
  }
}

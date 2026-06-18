/**
 * 题目展示格式化
 */

import type { ExerciseItem } from '@/types'
import { normalizeQuestionContent } from './parse-content'

/** 填空题占位符：[blank_1]、[blank_2] … */
const BLANK_PLACEHOLDER_REGEX = /\[blank_(\d+)\]/gi

/** 将填空题占位符替换为下划线（用于题干预览展示） */
export function replaceBlankPlaceholdersWithUnderscores(
  content: string,
  underscoreLength = 8,
): string {
  const underscores = '_'.repeat(underscoreLength)
  return content.replace(BLANK_PLACEHOLDER_REGEX, underscores)
}

function isFillBlankExercise(exercise: ExerciseItem): boolean {
  return (
    exercise.type === 'fill_in_blank' ||
    exercise.structuredContent?.type === 'fill_in_blank'
  )
}

function formatStemForDisplay(exercise: ExerciseItem, stem: string): string {
  const normalized = normalizeQuestionContent(stem)
  return isFillBlankExercise(exercise)
    ? replaceBlankPlaceholdersWithUnderscores(normalized)
    : normalized
}

/** 将结构化题目数据转换为格式化的 Markdown 纯文本 */
export function formatExerciseToMarkdown(exercise: ExerciseItem): string {
  if (!exercise.structuredContent) {
    const raw = normalizeQuestionContent(exercise.question || exercise.title || '')
    return isFillBlankExercise(exercise)
      ? replaceBlankPlaceholdersWithUnderscores(raw)
      : raw
  }

  const structured = exercise.structuredContent
  let md = ''

  if (exercise.material) {
    md += `${normalizeQuestionContent(exercise.material)}\n\n`
  }

  if (structured.stem) {
    md += `${formatStemForDisplay(exercise, structured.stem)}\n\n`
  }

  if (structured.options && structured.options.length > 0) {
    structured.options.forEach((opt) => {
      const label = opt.id || opt.label || ''
      const content = opt.content || opt.text || ''
      if (label && content) {
        md += `${label}. ${normalizeQuestionContent(content)}\n\n`
      } else if (content) {
        md += `${normalizeQuestionContent(content)}\n\n`
      }
    })
  }

  if (exercise.subQuestions && exercise.subQuestions.length > 0) {
    exercise.subQuestions.forEach((sub) => {
      const subMd = formatExerciseToMarkdown(sub)
      if (subMd) {
        md += `${subMd}\n\n`
      }
    })
  }

  return md.trim()
}

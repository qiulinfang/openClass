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

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
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
export function formatExerciseToMarkdown(exercise: ExerciseItem, excludeMaterial = false): string {
  if (!exercise.structuredContent) {
    const raw = normalizeQuestionContent(exercise.question || exercise.title || '')
    // 如果需要排除材料，且原始退化文本包含了材料，则将材料部分过滤掉
    let cleanedRaw = raw
    if (excludeMaterial && exercise.material) {
      const normalizedMaterial = normalizeQuestionContent(exercise.material)
      if (normalizedMaterial && cleanedRaw.includes(normalizedMaterial)) {
        cleanedRaw = cleanedRaw.replace(normalizedMaterial, '').trim()
      }
    }
    return isFillBlankExercise(exercise)
      ? replaceBlankPlaceholdersWithUnderscores(cleanedRaw)
      : cleanedRaw
  }

  const structured = exercise.structuredContent
  let md = ''

  if (exercise.material && !excludeMaterial) {
    md += `${normalizeQuestionContent(exercise.material)}\n\n`
  }

  if (structured.stem) {
    let cleanStem = structured.stem
    if (exercise.material && !excludeMaterial) {
      const normMaterial = normalizeQuestionContent(exercise.material)
      const normStem = normalizeQuestionContent(cleanStem)
      if (normMaterial && normStem.includes(normMaterial)) {
        // 从原始 stem 里过滤掉 material 对应的原文，避免重复
        // 为了安全匹配，尝试在原 stem 中查找材料字符串并去掉
        if (cleanStem.includes(exercise.material)) {
          cleanStem = cleanStem.replace(exercise.material, '').trim()
        } else {
          // 退化为归一化匹配过滤
          cleanStem = cleanStem.replace(new RegExp(escapeRegExp(exercise.material), 'i'), '').trim()
        }
      }
    }
    if (cleanStem) {
      md += `${formatStemForDisplay(exercise, cleanStem)}\n\n`
    }
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
      const subMd = formatExerciseToMarkdown(sub, true)
      if (subMd) {
        md += `${subMd}\n\n`
      }
    })
  }

  return md.trim()
}

/**
 * 题目内容解析（API / 存储边界共用）
 */

import type { StructuredOption, StructuredQuestionContent } from '@/types'

/** 标准化题目内容，移除常见的前缀标识符 */
export function normalizeQuestionContent(content?: string): string {
  if (!content) return ''
  let result = content.replace(/^\s*main\s*[:：]\s*/i, '')
  result = result.replace(/^\s*(?:[a-z]+[a-z0-9_]*?)\s*[:：]\s*/gim, '')
  return result
}

/** 解析题目结构化 JSON */
export function parseQuestionStructure(jsonStr?: string | object): StructuredQuestionContent | null {
  if (!jsonStr) return null
  try {
    const raw = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    const q = raw.status === 'success' && raw.question ? raw.question : raw
    if (!q) return null

    const options = (q.options || []) as Array<{ id?: string; content?: string }>

    return {
      id: q.id || '',
      subject: q.subject || '',
      score: q.score,
      type: q.type || 'subjective',
      stem: q.stem,
      analysis: q.analysis || '',
      options: options.map((opt) => ({
        id: opt.id || '',
        content: opt.content || '',
      })) as StructuredOption[],
      answer: q.answer,
      blanks: q.blanks,
    }
  } catch (e) {
    console.error('[ExerciseBoundary] Failed to parse questionStructureData:', e)
    return null
  }
}

/** 映射后端题目类型到前端组件类型 */
export function mapBackendTypeToFrontend(type: string): string {
  const map: Record<string, string> = {
    single_choice: 'single_choice',
    multiple_choice: 'multiple_choice',
    true_false: 'true_false',
    fill_in_blank: 'fill_in_blank',
    subjective: 'subjective',
    composite: 'composite',
  }
  return map[type] || 'subjective'
}

/** 从 questionStructureData 原始 JSON 中提取复合题字段 */
export function extractCompositeFields(questionStructureData: string | object): {
  material?: string
  subQuestions?: unknown[]
} {
  try {
    const raw =
      typeof questionStructureData === 'string'
        ? JSON.parse(questionStructureData)
        : questionStructureData
    const q = raw.status === 'success' && raw.question ? raw.question : raw
    return {
      material: q.material,
      subQuestions: Array.isArray(q.subQuestions) ? q.subQuestions : undefined,
    }
  } catch (e) {
    console.error('[ExerciseBoundary] Failed to extract composite fields:', e)
    return {}
  }
}

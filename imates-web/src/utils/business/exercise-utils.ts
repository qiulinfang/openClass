import type { HomeworkQuestionDetail, StructuredQuestionContent, ExerciseItem, StructuredOption } from '@/types'

/**
 * 标准化题目内容，移除常见的前缀标识符
 * @param content 原始题目内容
 * @returns 清洗后的内容
 */
export const normalizeQuestionContent = (content?: string): string => {
  // main: / main：
  // c1: c2: c3: 题干...
  // gc1_of_c1: gc1_of_c2: 题干...
  if (!content) return ''
  const withoutMain = content.replace(/^\s*main\s*[:：]\s*/i, '')
  return withoutMain.replace(/^\s*(?:(?:[a-z]+[a-z0-9_]*?)\s*[:：]\s*)+/i, '')
}

/**
 * 解析题目结构化数据
 * @param jsonStr 原始 JSON 字符串
 * @returns 结构化内容对象或 null
 */
export const parseQuestionStructure = (jsonStr?: string | object): StructuredQuestionContent | null => {
  if (!jsonStr) return null
  try {
    const raw = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    // 兼容多种返回格式，如果 status 为 success 且有 question 字段则使用该字段
    const q = (raw.status === 'success' && raw.question) ? raw.question : raw

    if (!q || !q.stem) return null
    
    return {
      id: q.id || '',
      subject: q.subject || '',
      score: q.score,
      type: q.type || 'essay',
      stem: q.stem,
      analysis: q.analysis || '',
      options: q.options?.map((opt: any) => ({
        label: opt.id || opt.label,
        text: opt.content || opt.text
      })) as StructuredOption[],
      answer: q.answer
    }
  } catch (e) {
    console.error('[ExerciseUtils] Failed to parse questionStructureData:', e)
    return null
  }
}

/**
 * 映射后端题目类型到前端组件类型
 * @param type 后端返回的类型字符串
 */
export const mapBackendTypeToFrontend = (type: string): string => {
  const map: Record<string, string> = {
    'single_choice': 'single_choice',
    'multiple_choice': 'multiple_choice',
    'judgment': 'judgment',
    'fill_in_the_blank': 'fill',
    'essay': 'essay',
    'subjective': 'essay'
  }
  return map[type] || 'essay'
}

/**
 * 将作业详情项转换为练习题目项
 */
export const mapHomeworkQuestionToExercise = (
  question: HomeworkQuestionDetail, 
  index: number, 
  subject: string
): ExerciseItem => {
  const bmNo = question.questionId || String(index + 1)
  const normalizedContent = normalizeQuestionContent(question.questionContent)
  
  const exercise: ExerciseItem = {
    id: question.questionId,
    bmNo,
    title: normalizedContent,
    question: normalizedContent,
    questionContent: question.questionContent, // 保留完整原始 HTML
    answer: question.questionAnswer || '',
    explanation: question.questionAnalysis || '',
    analysisData: question.questionAnalysis || '',
    subject: subject,
    questionStructureData: question.questionStructureData
  }

  // 处理结构化数据
  if (question.questionStructureData) {
    const structured = parseQuestionStructure(question.questionStructureData)
    if (structured) {
      exercise.structuredContent = structured
      exercise.type = mapBackendTypeToFrontend(structured.type)
      
      // 如果有结构化题干，也进行标准化处理
      if (structured.stem) {
        const normalizedStem = normalizeQuestionContent(structured.stem)
        exercise.title = normalizedStem
        exercise.question = normalizedStem
      }
      // 如果有结构化答案/解析，更新对应字段
      if (structured.answer) {
        exercise.answer = Array.isArray(structured.answer) ? structured.answer.join(', ') : structured.answer
      }
      if (structured.analysis) {
        exercise.explanation = structured.analysis
        exercise.analysisData = structured.analysis
      }
    }
  }

  return exercise
}

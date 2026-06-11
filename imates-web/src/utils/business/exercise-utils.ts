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

    // 复合题的 stem 可能为空字符串（题干在 material 中），不能仅以 stem 为空判断为无效
    if (!q) return null
    
    const options = (q.options || []) as Array<{ id?: string, content?: string }>
    
    return {
      id: q.id || '',
      subject: q.subject || '',
      score: q.score,
      type: q.type || 'subjective',
      stem: q.stem,
      analysis: q.analysis || '',
      options: options.map((opt) => ({
        id: opt.id || '',
        content: opt.content || ''
      })) as StructuredOption[],
      answer: q.answer,
      blanks: q.blanks
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
    'true_false': 'true_false',
    'fill_in_blank': 'fill_in_blank',
    'subjective': 'subjective',
    'composite': 'composite'
  }
  return map[type] || 'subjective'
}

/**
 * 将原始子题数据转换为 ExerciseItem（递归处理嵌套子题）
 */
const convertSubQuestionToExercise = (
  sub: any,
  parentId: string,
  index: number
): ExerciseItem => {
  const id = sub.id || `${parentId}_sub_${index}`
  const type = mapBackendTypeToFrontend(sub.type || 'subjective')

  const structuredContent: StructuredQuestionContent = {
    id,
    type: sub.type || 'subjective',
    stem: sub.stem || '',
    analysis: sub.analysis || '',
    options: (sub.options || []).map((opt: any) => ({
      id: opt.id || '',
      content: opt.content || ''
    })),
    answer: sub.answer,
    blanks: sub.blanks
  }

  const exercise: ExerciseItem = {
    id,
    bmNo: `${parentId}.${index + 1}`,
    type,
    structuredContent,
    question: sub.stem || '',
    title: sub.stem || '',
    material: sub.material || ''
  }

  // 递归处理嵌套子题
  if (sub.subQuestions && Array.isArray(sub.subQuestions)) {
    exercise.subQuestions = sub.subQuestions.map((nestedSub: any, nestedIdx: number) =>
      convertSubQuestionToExercise(nestedSub, id, nestedIdx)
    )
  }

  initExerciseAnswerFields(exercise)
  return exercise
}

/**
 * 初始化作业题目的作答结构化数据字段
 */
export const initExerciseAnswerFields = (exercise: ExerciseItem): void => {
  if (!exercise.structuredContent) {
    const anyEx = exercise as any
    exercise.structuredContent = {
      stem: anyEx.stem || exercise.title || exercise.question || '',
      type: exercise.type || 'subjective'
    }
  }
  
  const structured = exercise.structuredContent
  
  if (structured.userAnswer === undefined) {
    if (exercise.type === 'single_choice' || exercise.type === 'multiple_choice') {
      structured.userAnswer = []
    } else if (exercise.type === 'true_false') {
      structured.userAnswer = ''
    } else if (exercise.type === 'fill_in_blank') {
      structured.userAnswer = []
    } else if (exercise.type === 'composite') {
      structured.userAnswer = {}
    } else if (exercise.type === 'subjective') {
      structured.userAnswer = { type: 'text' }
    } else {
      structured.userAnswer = null
    }
  }
  
  if (structured.boardData === undefined) {
    structured.boardData = { objects: [], history: [[]], historyIndex: 0 }
  }
  
  if (structured.imageData === undefined) {
    structured.imageData = null
  }
  
  // 递归处理子题
  if (exercise.subQuestions && Array.isArray(exercise.subQuestions)) {
    exercise.subQuestions.forEach(sub => initExerciseAnswerFields(sub))
  }
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
    explanation: question.questionReason || question.questionAnalysis || '',
    analysisData: question.questionReason || question.questionAnalysis || '',
    subject: subject,
    questionReason: question.questionReason,
    questionChooseInfo: question.questionChooseInfo,
    questionChooseList: question.questionChooseList,
    questionStructureData: question.questionStructureData
  }

  // 处理结构化数据
  if (question.questionStructureData) {
    const structured = parseQuestionStructure(question.questionStructureData)
    if (structured) {
      exercise.structuredContent = structured
      exercise.type = mapBackendTypeToFrontend(structured.type || 'subjective')

      // 从原始 JSON 中提取复合题特有的 material 和 subQuestions（parseQuestionStructure 不返回这些字段）
      try {
        const raw = typeof question.questionStructureData === 'string'
          ? JSON.parse(question.questionStructureData)
          : question.questionStructureData
        const q = (raw.status === 'success' && raw.question) ? raw.question : raw

        if (q.material) {
          exercise.material = q.material
        }

        if (q.subQuestions && Array.isArray(q.subQuestions)) {
          exercise.subQuestions = q.subQuestions.map((sub: any, subIdx: number) =>
            convertSubQuestionToExercise(sub, exercise.id, subIdx)
          )
        }
      } catch (e) {
        console.error('[ExerciseUtils] Failed to extract composite fields:', e)
      }

      // 如果有结构化题干，也进行标准化处理
      if (structured.stem) {
        const normalizedStem = normalizeQuestionContent(structured.stem)
        exercise.title = normalizedStem
        exercise.question = normalizedStem
      }
      // 如果有结构化答案/解析，更新对应字段
      if (structured.answer !== undefined && structured.answer !== null) {
        if (typeof structured.answer === 'boolean') {
          exercise.answer = structured.answer ? '对' : '错'
        } else {
          exercise.answer = Array.isArray(structured.answer) ? structured.answer.join(', ') : String(structured.answer)
        }
      }
      if (structured.analysis) {
        exercise.explanation = structured.analysis
        exercise.analysisData = structured.analysis
      }
    }
  }

  initExerciseAnswerFields(exercise)
  return exercise
}

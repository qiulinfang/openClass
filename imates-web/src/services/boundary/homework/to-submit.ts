/**
 * 作业 API 出站边界：ExerciseItem → HomeworkQuestionAnswer
 */

import type { ExerciseItem, HomeworkQuestionAnswer } from '@/types'
import { getQuestionStrategy } from '@/utils/business/question-strategies'
import type { IntermediateQuestionAnswer } from './types'

function buildAnswerForQuestion(
  question: ExerciseItem,
  questionIndex: number,
  imageBuckets: Map<number, string[]>,
  parentUserAnswer?: unknown,
): IntermediateQuestionAnswer | null {
  if (!question) return null
  const structured = question.structuredContent
  if (!structured) return null

  const userAnswer = parentUserAnswer !== undefined ? parentUserAnswer : structured.userAnswer
  const type = question.type || ''
  let answers: string | string[] | IntermediateQuestionAnswer[] = ''

  if (type === 'composite') {
    const nestedAnswers: IntermediateQuestionAnswer[] = []
    if (question.subQuestions && Array.isArray(question.subQuestions)) {
      question.subQuestions.forEach((subQuestion, subIndex) => {
        const subUserAnswer =
          userAnswer && typeof userAnswer === 'object'
            ? (userAnswer as Record<string, unknown>)[subQuestion.id]
            : undefined
        const subAns = buildAnswerForQuestion(subQuestion, subIndex, imageBuckets, subUserAnswer)
        if (subAns) nestedAnswers.push(subAns)
      })
    }
    answers = nestedAnswers
  } else {
    answers = getQuestionStrategy(type).formatForSubmit(userAnswer, questionIndex, undefined, question)
  }

  const currentImages = imageBuckets.get(questionIndex) || []

  return {
    questionId: question.id || question.bmNo || '',
    type: question.type || 'subjective',
    answers,
    images: currentImages.length ? currentImages : undefined,
  }
}

/** 从题目列表提取提交用中间作答结构 */
export function prepareHomeworkSubmitAnswers(
  questions: ExerciseItem[],
  imageBuckets: Map<number, string[]> = new Map(),
): IntermediateQuestionAnswer[] {
  const questionAnswerList: IntermediateQuestionAnswer[] = []
  questions.forEach((question, questionIndex) => {
    const ans = buildAnswerForQuestion(question, questionIndex, imageBuckets)
    if (ans) questionAnswerList.push(ans)
  })
  return questionAnswerList
}

/** 将中间作答结构扁平化为后端 HomeworkQuestionAnswer 列表 */
export function flattenHomeworkSubmitAnswers(
  list: IntermediateQuestionAnswer[],
): HomeworkQuestionAnswer[] {
  const result: HomeworkQuestionAnswer[] = []

  const traverse = (item: IntermediateQuestionAnswer) => {
    if (item.type === 'composite') {
      if (Array.isArray(item.answers)) {
        item.answers.forEach((subItem) => {
          traverse(subItem as IntermediateQuestionAnswer)
        })
      }
      return
    }

    let answerData: string[] = []

    if (item.type === 'single_choice' || item.type === 'multiple_choice') {
      answerData = Array.isArray(item.answers)
        ? (item.answers as string[]).map(String)
        : item.answers !== undefined && item.answers !== null && item.answers !== ''
          ? [String(item.answers)]
          : []
    } else if (item.type === 'true_false' || item.type === 'judgment') {
      answerData =
        item.answers !== undefined && item.answers !== null && item.answers !== ''
          ? [String(item.answers)]
          : []
    } else if (item.type === 'fill_in_blank') {
      answerData = Array.isArray(item.answers)
        ? (item.answers as string[]).map(String)
        : item.answers !== undefined && item.answers !== null && item.answers !== ''
          ? [String(item.answers)]
          : []
    } else {
      answerData =
        item.answers !== undefined && item.answers !== null && item.answers !== ''
          ? [String(item.answers)]
          : []
    }

    result.push({ questionId: item.questionId, answerData })
  }

  list.forEach(traverse)
  return result
}

/** 判断作答字符串是否为待上传的 Base64 图片 */
export function isBase64ImageAnswer(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image')
}

/** 收集中间作答结构中所有 Base64 图片路径（用于上传前遍历） */
export function collectBase64ImageRefs(
  list: IntermediateQuestionAnswer[],
): Array<{ item: IntermediateQuestionAnswer; index?: number }> {
  const refs: Array<{ item: IntermediateQuestionAnswer; index?: number }> = []

  for (const qAns of list) {
    if (qAns.type === 'subjective' && isBase64ImageAnswer(qAns.answers)) {
      refs.push({ item: qAns })
    } else if (qAns.type === 'fill_in_blank' && Array.isArray(qAns.answers)) {
      qAns.answers.forEach((ansStr, i) => {
        if (isBase64ImageAnswer(ansStr)) {
          refs.push({ item: qAns, index: i })
        }
      })
    } else if (qAns.type === 'composite' && Array.isArray(qAns.answers)) {
      refs.push(
        ...collectBase64ImageRefs(qAns.answers as IntermediateQuestionAnswer[]),
      )
    }
  }

  return refs
}

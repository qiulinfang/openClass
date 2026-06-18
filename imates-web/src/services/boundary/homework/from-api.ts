/**
 * 作业 API 入站边界：HomeworkQuestionDetail → ExerciseItem
 */

import type { ExerciseItem, HomeworkQuestionDetail, StructuredQuestionContent } from '@/types'
import {
  initExerciseAnswerFields,
  extractCompositeFields,
  mapBackendTypeToFrontend,
  normalizeQuestionContent,
  parseQuestionStructure,
} from '../exercise'

function convertSubQuestionToExercise(
  sub: Record<string, unknown>,
  parentId: string,
  index: number,
): ExerciseItem {
  const id = (sub.id as string) || `${parentId}_sub_${index}`
  const type = mapBackendTypeToFrontend((sub.type as string) || 'subjective')

  const structuredContent: StructuredQuestionContent = {
    id,
    type: (sub.type as string) || 'subjective',
    stem: (sub.stem as string) || '',
    analysis: (sub.analysis as string) || '',
    options: ((sub.options as Array<Record<string, unknown>>) || []).map((opt) => ({
      id: (opt.id as string) || '',
      content: (opt.content as string) || '',
    })),
    answer: sub.answer as StructuredQuestionContent['answer'],
    blanks: sub.blanks as StructuredQuestionContent['blanks'],
  }

  const exercise: ExerciseItem = {
    id,
    bmNo: `${parentId}.${index + 1}`,
    type,
    structuredContent,
    question: (sub.stem as string) || '',
    title: (sub.stem as string) || '',
    material: (sub.material as string) || '',
  }

  const nestedSubs = sub.subQuestions as Array<Record<string, unknown>> | undefined
  if (nestedSubs && Array.isArray(nestedSubs)) {
    exercise.subQuestions = nestedSubs.map((nestedSub, nestedIdx) =>
      convertSubQuestionToExercise(nestedSub, id, nestedIdx),
    )
  }

  initExerciseAnswerFields(exercise)
  return exercise
}

/** 将单道作业 API 题目转换为 ExerciseItem */
export function mapHomeworkQuestionFromApi(
  question: HomeworkQuestionDetail,
  index: number,
  subject: string,
): ExerciseItem {
  const bmNo = question.questionId || String(index + 1)
  const normalizedContent = normalizeQuestionContent(question.questionContent)

  const exercise: ExerciseItem = {
    id: question.questionId,
    bmNo,
    title: normalizedContent,
    question: normalizedContent,
    questionContent: question.questionContent,
    answer: question.questionAnswer || '',
    explanation: question.questionReason || question.questionAnalysis || '',
    analysisData: question.questionReason || question.questionAnalysis || '',
    subject,
    questionReason: question.questionReason,
    questionChooseInfo: question.questionChooseInfo,
    questionChooseList: question.questionChooseList,
    questionStructureData: question.questionStructureData,
  }

  if (question.questionStructureData) {
    const structured = parseQuestionStructure(question.questionStructureData)
    if (structured) {
      exercise.structuredContent = structured
      exercise.type = mapBackendTypeToFrontend(structured.type || 'subjective')

      const { material, subQuestions } = extractCompositeFields(question.questionStructureData)
      if (material) {
        exercise.material = material
      }
      if (subQuestions) {
        exercise.subQuestions = subQuestions.map((sub, subIdx) =>
          convertSubQuestionToExercise(sub as Record<string, unknown>, exercise.id, subIdx),
        )
      }

      if (structured.stem) {
        const normalizedStem = normalizeQuestionContent(structured.stem)
        exercise.title = normalizedStem
        exercise.question = normalizedStem
      }

      if (structured.answer !== undefined && structured.answer !== null) {
        if (typeof structured.answer === 'boolean') {
          exercise.answer = structured.answer ? '对' : '错'
        } else {
          exercise.answer = Array.isArray(structured.answer)
            ? structured.answer.join(', ')
            : String(structured.answer)
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

/** 批量转换作业 API 题目列表 */
export function mapHomeworkQuestionsFromApi(
  questions: HomeworkQuestionDetail[],
  subject: string,
): ExerciseItem[] {
  return questions.map((question, index) => mapHomeworkQuestionFromApi(question, index, subject))
}

/**
 * 作业持久化出站边界：ExerciseItem → IndexedDB 载荷
 */

import type { ExerciseItem } from '@/types'
import type { HomeworkSubmissionPayload, LegacyAnswerCacheItem } from './types'

/** 将题目列表转换为 legacy answerDataCache 格式 */
export function buildLegacyAnswerCache(
  questionsList: ExerciseItem[],
): Record<string, LegacyAnswerCacheItem> {
  const legacyCache: Record<string, LegacyAnswerCacheItem> = {}

  questionsList.forEach((question) => {
    const key = question.bmNo || question.id
    if (!key) return

    const structured = question.structuredContent
    if (!structured) return

    const item: LegacyAnswerCacheItem = {}
    const type = question.type || ''

    if (type === 'single_choice' || type === 'multiple_choice') {
      item.chooseList = structured.userAnswer || []
    } else if (type === 'true_false') {
      item.judgmentValue = structured.userAnswer || ''
    } else if (type === 'fill_in_blank') {
      const rawList = structured.userAnswer || []
      item.fillList = rawList.map((ans: unknown) => {
        if (!ans) return ''
        if (typeof ans === 'string') return ans
        const obj = ans as Record<string, unknown>
        if (obj.type === 'photo') {
          return JSON.stringify({ type: 'photo', photoUrl: obj.photoUrl || '' })
        }
        return JSON.stringify({
          ...(obj.boardData as object),
          boardImg: obj.boardImg || null,
        })
      })
    } else if (type === 'composite') {
      item.compositeAnswers = structured.userAnswer || {}
    } else if (type === 'subjective') {
      item.subjectiveData = structured.userAnswer || { type: 'text' }
    }

    if (structured.boardData) item.boardData = structured.boardData
    if (structured.imageData !== undefined) item.imageData = structured.imageData

    legacyCache[String(key)] = item
  })

  return legacyCache
}

/** 组装写入 IndexedDB 的作业提交载荷 */
export function toHomeworkSubmissionPayload(params: {
  homeworkId: string
  homeworkName: string
  isSubmitted: boolean
  questions: ExerciseItem[]
  existingLegacyCache?: Record<string, LegacyAnswerCacheItem>
}): HomeworkSubmissionPayload {
  const legacyCache =
    params.existingLegacyCache ?? buildLegacyAnswerCache(params.questions)

  return {
    homeworkId: params.homeworkId,
    homeworkName: params.homeworkName,
    isSubmitted: params.isSubmitted,
    answerDataCache: legacyCache,
    questions: params.questions,
  }
}

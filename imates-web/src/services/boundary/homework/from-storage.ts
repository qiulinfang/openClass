/**
 * 作业持久化入站边界：IndexedDB legacy 缓存 → ExerciseItem
 */

import type { ExerciseItem } from '@/types'
import { initExerciseAnswerFields } from '../exercise'
import type { HydrateFromStorageOptions, LegacyAnswerCacheItem } from './types'

function isUserAnswerEmpty(userAnswer: unknown): boolean {
  if (userAnswer === undefined) return true
  if (Array.isArray(userAnswer)) return userAnswer.length === 0
  if (typeof userAnswer === 'object' && userAnswer !== null) {
    return Object.keys(userAnswer).length === 0
  }
  return false
}

function parseFillBlankCacheItem(str: unknown): Record<string, unknown> {
  if (!str) return { type: 'board', boardData: { objects: [] } }
  if (typeof str === 'object') return str as Record<string, unknown>
  try {
    const parsed = JSON.parse(String(str))
    if (parsed.type === 'photo') {
      return { type: 'photo', photoUrl: parsed.photoUrl || '' }
    }
    return {
      type: 'board',
      boardData: parsed,
      boardImg: parsed.boardImg || null,
    }
  } catch {
    return { type: 'board', boardData: { objects: [] } }
  }
}

function applyLegacyCacheToQuestion(
  question: ExerciseItem,
  cacheItem: LegacyAnswerCacheItem,
): void {
  const structured = question.structuredContent
  if (!structured) return

  const type = question.type || ''

  if (isUserAnswerEmpty(structured.userAnswer)) {
    if (type === 'single_choice' || type === 'multiple_choice') {
      structured.userAnswer = cacheItem.chooseList || []
    } else if (type === 'true_false') {
      structured.userAnswer = cacheItem.judgmentValue || ''
    } else if (type === 'fill_in_blank') {
      const rawList = cacheItem.fillList || []
      structured.userAnswer = rawList.map(parseFillBlankCacheItem)
    } else if (type === 'composite') {
      structured.userAnswer = cacheItem.compositeAnswers || {}
    } else if (type === 'subjective') {
      structured.userAnswer = cacheItem.subjectiveData || { type: 'text' }
    }
  }

  if (cacheItem.boardData) {
    structured.boardData = cacheItem.boardData
  }
  if (cacheItem.imageData !== undefined) {
    structured.imageData = cacheItem.imageData
  }
}

/** 将 legacy answerDataCache 合并到题目列表 */
export function mergeLegacyCacheIntoQuestions(
  questions: ExerciseItem[],
  legacyCache: Record<string, LegacyAnswerCacheItem>,
): void {
  questions.forEach((question) => {
    const key = question.bmNo || question.id
    if (!key) return
    const cacheItem = legacyCache[String(key)]
    if (cacheItem) {
      applyLegacyCacheToQuestion(question, cacheItem)
    }
  })
}

/**
 * 从存储层恢复题目并 hydrate 作答数据
 * @returns 已 hydrate 的题目列表（就地修改并返回同一引用）
 */
export function hydrateQuestionsFromStorage(
  questions: ExerciseItem[],
  options: HydrateFromStorageOptions = {},
): ExerciseItem[] {
  questions.forEach((q) => initExerciseAnswerFields(q))

  if (options.legacyCache && Object.keys(options.legacyCache).length > 0) {
    mergeLegacyCacheIntoQuestions(questions, options.legacyCache)
  } else if (options.storedQuestions?.length) {
    const storedCache = buildLegacyCacheFromQuestions(options.storedQuestions)
    mergeLegacyCacheIntoQuestions(questions, storedCache)
  }

  return questions
}

/** 从已存题目列表反向提取 legacy 缓存（用于仅有 questions 无 cache 的旧数据） */
function buildLegacyCacheFromQuestions(
  questionsList: ExerciseItem[],
): Record<string, LegacyAnswerCacheItem> {
  const legacyCache: Record<string, LegacyAnswerCacheItem> = {}
  questionsList.forEach((question) => {
    const key = question.bmNo || question.id
    if (!key || !question.structuredContent) return
    const structured = question.structuredContent
    const type = question.type || ''
    const item: LegacyAnswerCacheItem = {}

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
}

/**
 * 智能合并算法：将服务端获取的新题目列表与本地已有（IndexedDB或内存）的作答数据进行无损合并
 */
export function mergeApiQuestionsWithLocalStore(
  apiQuestions: ExerciseItem[],
  existingSubmission: {
    answerDataCache?: Record<string, LegacyAnswerCacheItem>
    questions?: ExerciseItem[]
  } | null,
): ExerciseItem[] {
  // 1. 先初始化所有新题目的作答结构
  apiQuestions.forEach((q) => initExerciseAnswerFields(q))

  if (!existingSubmission) {
    return apiQuestions
  }

  // 2. 构造本地题目的快捷查询 Map (以 bmNo 或 id 为 key)
  const existingQuestionsMap = new Map<string, ExerciseItem>()
  if (existingSubmission.questions && existingSubmission.questions.length > 0) {
    existingSubmission.questions.forEach((eq) => {
      const key = eq.bmNo || eq.id
      if (key) {
        existingQuestionsMap.set(String(key), eq)
      }
    })
  }

  const legacyCache = existingSubmission.answerDataCache || {}

  // 3. 将本地作答合并到新题目中
  apiQuestions.forEach((apiQ) => {
    const key = apiQ.bmNo || apiQ.id
    if (!key) return
    const keyStr = String(key)

    // A. 优先尝试从本地已有 ExerciseItem 节点直接克隆作答数据
    const existingQ = existingQuestionsMap.get(keyStr)
    if (existingQ && existingQ.structuredContent && apiQ.structuredContent) {
      if (!isUserAnswerEmpty(existingQ.structuredContent.userAnswer)) {
        apiQ.structuredContent.userAnswer = JSON.parse(JSON.stringify(existingQ.structuredContent.userAnswer))
      }
      if (existingQ.structuredContent.boardData) {
        apiQ.structuredContent.boardData = JSON.parse(JSON.stringify(existingQ.structuredContent.boardData))
      }
      if (existingQ.structuredContent.imageData !== undefined) {
        apiQ.structuredContent.imageData = existingQ.structuredContent.imageData
      }
    }

    // B. 若 LegacyCache 存在且当前作答仍为空，补充 legacyCache 数据
    const cacheItem = legacyCache[keyStr]
    if (cacheItem) {
      applyLegacyCacheToQuestion(apiQ, cacheItem)
    }
  })

  return apiQuestions
}


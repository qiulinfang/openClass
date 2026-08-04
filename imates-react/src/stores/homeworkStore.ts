import { create } from 'zustand'
import type { ExerciseItem, HomeworkUndoItem } from '@/types'
import { saveQuestionsToIndexedDB } from '@/services/storage/question-storage'
import { saveHomeworkSubmission, loadHomeworkSubmission } from '@/services/storage/homework-storage'
import { showMessage } from '@/utils'
import { apiService } from '@/services/http/api-service'

// 作业存储的 key 前缀（区别于习题）
const HOMEWORK_STORAGE_PREFIX = 'homework_'

interface HomeworkState {
  // 状态
  questions: ExerciseItem[]
  currentQuestionIndex: number
  homeworkName: string
  resubmitType: string
  answerDataCache: Record<string, unknown>
  homeworkListCache: Map<string, HomeworkUndoItem[]>
  currentHomeworkInfo: HomeworkUndoItem | null

  // 计算属性逻辑
  getCurrentQuestion: () => ExerciseItem | null
  getHasQuestions: () => boolean

  // 方法
  setHomeworkName: (name: string) => void
  setResubmitType: (type: string) => void
  setCurrentHomeworkInfo: (info: HomeworkUndoItem) => void
  selectQuestion: (index: number) => Promise<void>
  setQuestions: (newQuestions: ExerciseItem[], subject?: string) => Promise<void>
  clearCurrentQuestion: () => void
  fetchHomeworkList: (params: {
    pageNumber: number
    pageSize: number
    subject?: string
    date?: string
  }, forceRefresh?: boolean) => Promise<HomeworkUndoItem[]>
  clearHomeworkListCache: () => void
  clearHomeworkListCacheByCondition: (date?: string, subject?: string) => void
  saveCurrentHomeworkSubmission: (homeworkId: string, isSubmitted: boolean) => Promise<void>
  loadHomeworkSubmissionFromDB: (homeworkId: string) => Promise<{ isSubmitted: boolean } | null>
  resetAnswerState: () => void
}

export const useHomeworkStore = create<HomeworkState>((set, get) => ({
  // 状态
  questions: [],
  currentQuestionIndex: -1,
  homeworkName: '',
  resubmitType: '0',
  answerDataCache: {},
  homeworkListCache: new Map(),
  currentHomeworkInfo: null,

  // 计算属性逻辑
  getCurrentQuestion: () => {
    const { questions, currentQuestionIndex } = get()
    if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
      return questions[currentQuestionIndex]
    }
    return null
  },

  getHasQuestions: () => get().questions.length > 0,

  // 方法
  setHomeworkName: (name) => set({ homeworkName: name }),

  setResubmitType: (type) => set({ resubmitType: type }),

  setCurrentHomeworkInfo: (info) => set({ currentHomeworkInfo: info }),

  selectQuestion: async (index) => {
    const { questions } = get()
    if (index < 0 || index >= questions.length) {
      showMessage('无效的作业索引', 'error')
      return
    }
    set({ currentQuestionIndex: index })
  },

  setQuestions: async (newQuestions, subject) => {
    const deduplicated = deduplicateQuestions(newQuestions)
    set({ questions: deduplicated })
    
    if (subject) {
      const storageKey = `${HOMEWORK_STORAGE_PREFIX}${subject}`
      try {
        await saveQuestionsToIndexedDB(storageKey, deduplicated)
      } catch (error) {
      }
    }
  },

  clearCurrentQuestion: () => set({ currentQuestionIndex: -1 }),

  fetchHomeworkList: async (params, forceRefresh = false) => {
    const { homeworkListCache } = get()
    const cacheKey = `${params.date || ''}_${params.subject || ''}_${params.pageNumber}_${params.pageSize}`
    
    if (!forceRefresh && homeworkListCache.has(cacheKey)) {
      return homeworkListCache.get(cacheKey)!
    }
    
    try {
      const result = await apiService.getHomeworkUndoList(params)
      const newCache = new Map(homeworkListCache)
      newCache.set(cacheKey, result)
      set({ homeworkListCache: newCache })
      return result
    } catch (error) {
      throw error
    }
  },

  clearHomeworkListCache: () => {
    set({ homeworkListCache: new Map() })
  },

  clearHomeworkListCacheByCondition: (date, subject) => {
    const { homeworkListCache } = get()
    const newCache = new Map(homeworkListCache)
    let deletedCount = 0
    
    for (const key of newCache.keys()) {
      const [cachedDate, cachedSubject] = key.split('_')
      const shouldDelete = 
        (!date || cachedDate === date) && 
        (!subject || cachedSubject === subject)
      
      if (shouldDelete) {
        newCache.delete(key)
        deletedCount++
      }
    }
    
    set({ homeworkListCache: newCache })
  },

  saveCurrentHomeworkSubmission: async (homeworkId, isSubmitted) => {
    if (!homeworkId) {
      return
    }
    
    try {
      const { homeworkName, answerDataCache, questions } = get()
      await saveHomeworkSubmission({
        homeworkId,
        homeworkName,
        isSubmitted,
        answerDataCache,
        questions
      })
    } catch (error) {
    }
  },

  loadHomeworkSubmissionFromDB: async (homeworkId) => {
    if (!homeworkId) return null
    
    try {
      const data = await loadHomeworkSubmission(homeworkId)
      if (data) {
        set({
          answerDataCache: data.answerDataCache || {},
          homeworkName: data.homeworkName || '',
          questions: data.questions || []
        })
        return { isSubmitted: data.isSubmitted }
      }
    } catch (error) {
    }
    return null
  },

  resetAnswerState: () => {
    set({
      questions: [],
      currentQuestionIndex: -1,
      homeworkName: '',
      resubmitType: '0',
      currentHomeworkInfo: null,
      answerDataCache: {}
    })
  }
}))

function deduplicateQuestions(questionList: ExerciseItem[]): ExerciseItem[] {
  const uniqueMap = new Map<string, ExerciseItem>()
  for (const question of questionList) {
    const key = question.bmNo || question.id || question.title
    if (key && !uniqueMap.has(key)) {
      uniqueMap.set(key, question)
    }
  }
  return Array.from(uniqueMap.values())
}

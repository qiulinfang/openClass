import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ExerciseItem, HomeworkUndoItem } from '../types'
import { saveQuestionsToIndexedDB } from '../services/storage/question-storage'
import { saveHomeworkSubmission, loadHomeworkSubmission } from '../services/storage/homework-storage'
import { apiService } from '@/services'

const HOMEWORK_STORAGE_PREFIX = 'homework_'

export const useHomeworkStore = defineStore('homework', () => {
  const questions = ref<ExerciseItem[]>([])
  const currentQuestionIndex = ref(-1)
  const homeworkName = ref('')
  const resubmitType = ref('0')
  const answerDataCache = ref<Record<string, unknown>>({})
  const homeworkListCache = ref(new Map<string, HomeworkUndoItem[]>())
  const currentHomeworkInfo = ref<HomeworkUndoItem | null>(null)

  const currentQuestion = computed(() => {
    if (currentQuestionIndex.value >= 0 && currentQuestionIndex.value < questions.value.length) {
      return questions.value[currentQuestionIndex.value]
    }
    return null
  })
  
  const hasQuestions = computed(() => questions.value.length > 0)

  const setHomeworkName = (name: string): void => {
    homeworkName.value = name
  }

  const setResubmitType = (type: string): void => {
    resubmitType.value = type
  }

  const setCurrentHomeworkInfo = (info: HomeworkUndoItem): void => {
    currentHomeworkInfo.value = info
  }

  const selectQuestion = async (index: number): Promise<void> => {
    if (index < 0 || index >= questions.value.length) {
      console.error('[HOMEWORK] ❌ 无效的作业索引:', index)
      return
    }
    currentQuestionIndex.value = index
  }
  
  const setQuestions = async (newQuestions: ExerciseItem[], subject?: string): Promise<void> => {
    questions.value = deduplicateQuestions(newQuestions)
    
    if (subject) {
      const storageKey = `${HOMEWORK_STORAGE_PREFIX}${subject}`
      try {
        await saveQuestionsToIndexedDB(storageKey, questions.value)
      } catch (error) {
        console.error('[HOMEWORK] ❌ 保存作业列表到 IndexedDB 失败:', error)
      }
    }
  }
  
  const deduplicateQuestions = (questionList: ExerciseItem[]): ExerciseItem[] => {
    const uniqueMap = new Map<string, ExerciseItem>()
    for (const question of questionList) {
      const key = question.bmNo || question.id || question.title
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, question)
      }
    }
    return Array.from(uniqueMap.values())
  }
  
  const clearCurrentQuestion = (): void => {
    currentQuestionIndex.value = -1
  }
  
  const fetchHomeworkList = async (params: {
    pageNumber: number
    pageSize: number
    subject?: string
    date?: string
  }, forceRefresh: boolean = false): Promise<HomeworkUndoItem[]> => {
    const cacheKey = `${params.date || ''}_${params.subject || ''}_${params.pageNumber}_${params.pageSize}`
    
    if (!forceRefresh && homeworkListCache.value.has(cacheKey)) {
      return homeworkListCache.value.get(cacheKey)!
    }
    
    try {
      const result = await apiService.getHomeworkUndoList(params)
      homeworkListCache.value.set(cacheKey, result)
      return result
    } catch (error) {
      console.error('[HOMEWORK] ❌ 获取作业列表失败:', error)
      throw error
    }
  }
  
  const clearHomeworkListCache = (): void => {
    homeworkListCache.value.clear()
  }

  const saveCurrentHomeworkSubmission = async (homeworkId: string, isSubmitted: boolean): Promise<void> => {
    if (!homeworkId) return
    
    try {
      await saveHomeworkSubmission({
        homeworkId,
        homeworkName: homeworkName.value,
        isSubmitted,
        answerDataCache: answerDataCache.value,
        questions: questions.value
      })
    } catch (error) {
      console.error('[HOMEWORK_STORAGE] ❌ 持久化任务失败:', error)
    }
  }

  const loadHomeworkSubmissionFromDB = async (homeworkId: string): Promise<{ isSubmitted: boolean } | null> => {
    if (!homeworkId) return null
    
    try {
      const data = await loadHomeworkSubmission(homeworkId)
      if (data) {
        answerDataCache.value = data.answerDataCache
        homeworkName.value = data.homeworkName
        if (data.questions && data.questions.length > 0) {
          questions.value = data.questions
        }
        return { isSubmitted: data.isSubmitted }
      }
    } catch (error) {
      console.error('[HOMEWORK_STORAGE] ❌ 加载存储数据失败:', error)
    }
    return null
  }
  
  const clearHomeworkListCacheByCondition = (date?: string, subject?: string): void => {
    const keysToDelete: string[] = []
    for (const key of homeworkListCache.value.keys()) {
      const [cachedDate, cachedSubject] = key.split('_')
      const shouldDelete = (!date || cachedDate === date) && (!subject || cachedSubject === subject)
      if (shouldDelete) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => homeworkListCache.value.delete(key))
  }
  
  const resetAnswerState = (): void => {
    questions.value = []
    currentQuestionIndex.value = -1
    homeworkName.value = ''
    resubmitType.value = '0'
    currentHomeworkInfo.value = null
    answerDataCache.value = {}
  }
  
  return {
    questions,
    currentQuestionIndex,
    homeworkName,
    resubmitType,
    answerDataCache,
    currentHomeworkInfo,
    homeworkListCache,
    currentQuestion,
    hasQuestions,
    selectQuestion,
    setHomeworkName,
    setCurrentHomeworkInfo,
    setResubmitType,
    setQuestions,
    deduplicateQuestions,
    clearCurrentQuestion,
    fetchHomeworkList,
    clearHomeworkListCache,
    clearHomeworkListCacheByCondition,
    saveCurrentHomeworkSubmission,
    loadHomeworkSubmissionFromDB,
    resetAnswerState
  }
})

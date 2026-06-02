import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '@/services'
import type { ExerciseItem } from '../types'
import {
  saveQuestionsToIndexedDB,
  loadQuestionsFromIndexedDB,
  deleteQuestionsFromIndexedDB,
} from '../services/storage/question-storage'
import { normalizeSubject } from '@/constants/subjects'

export const useQuestionStore = defineStore('question', () => {
  const questions = ref<ExerciseItem[]>([])
  const similarQuestions = ref<ExerciseItem[]>([])
  const currentQuestionIndex = ref(-1)
  const isLoading = ref(false)
  const loadingSubjects = new Set<string>()

  const currentQuestion = computed(() => {
    if (currentQuestionIndex.value >= 0 && currentQuestionIndex.value < questions.value.length) {
      return questions.value[currentQuestionIndex.value]
    }
    return null
  })
  
  const hasQuestions = computed(() => questions.value.length > 0)

  const loadQuestionsFromLocal = async (subject: string): Promise<boolean> => {
    try {
      const loadedQuestions = await loadQuestionsFromIndexedDB(subject)
      if (loadedQuestions && Array.isArray(loadedQuestions) && loadedQuestions.length > 0) {
        const normalized = loadedQuestions.map((q) => ({
          ...q,
          subject: normalizeSubject((q as any).subject),
        }))
        questions.value = deduplicateQuestions(normalized)
        return true
      }
      return false
    } catch (error) {
      console.error('[QUESTION] ❌ 从 IndexedDB 加载题目列表失败:', error)
      return false
    }
  }

  const loadSingleSubjectFromLocal = async (subject: string): Promise<ExerciseItem[] | null> => {
    try {
      const loadedQuestions = await loadQuestionsFromIndexedDB(subject)
      if (loadedQuestions && Array.isArray(loadedQuestions) && loadedQuestions.length > 0) {
        const normalized = loadedQuestions.map((q) => ({
          ...q,
          subject: normalizeSubject((q as any).subject),
        }))
        return deduplicateQuestions(normalized)
      }
      return null
    } catch (error) {
      console.error(`[QUESTION] ❌ 从 IndexedDB 加载 ${subject} 科目题目失败:`, error)
      return null
    }
  }

  const fetchAllSubjectsQuestions = async (useLocalFirst: boolean = true): Promise<void> => {
    const allSubjects = ['math', 'biology', 'chemistry', 'physics', 'chinese', 'english']
    const allQuestions: ExerciseItem[] = []
    
    try {
      isLoading.value = true
      const loadPromises = allSubjects.map(async (subject) => {
        try {
          const questionList = await apiService.getExerciseList(subject)
          const convertedQuestions: ExerciseItem[] = questionList.map((q: any) => ({
            bmNo: q.bmNo || q.id || '',
            id: q.id || q.bmNo || '',
            title: q.title || '',
            question: q.content || q.question || q.title || '',
            answer: q.answer || '',
            explanation: q.explanation || '',
            analysisData: q.analysisData || '',
            subject: normalizeSubject(q.subject || subject),
          }))

          if (convertedQuestions.length > 0) {
            await deleteQuestionsFromIndexedDB(subject)
            await saveQuestionsToIndexedDB(subject, convertedQuestions)
          }
          return convertedQuestions
        } catch (error) {
          const loaded = await loadSingleSubjectFromLocal(subject)
          return loaded || []
        }
      })
      
      const subjectQuestionsArrays = await Promise.all(loadPromises)
      for (const subjectQuestions of subjectQuestionsArrays) {
        allQuestions.push(...subjectQuestions)
      }
      questions.value = deduplicateQuestions(allQuestions)
    } finally {
      isLoading.value = false
    }
  }

  const fetchQuestions = async (subject: string = 'math', useLocalFirst: boolean = true): Promise<void> => {
    if (loadingSubjects.has(subject)) return
    loadingSubjects.add(subject)
    
    try {
      isLoading.value = true
      const questionList = await apiService.getExerciseList(subject)
      const convertedQuestions: ExerciseItem[] = questionList.map((q: any) => ({
        bmNo: q.bmNo || '',
        id: q.id || '',
        title: q.title || '',
        question: q.content || q.question || q.title || '',
        answer: q.answer || '',
        explanation: q.explanation || '',
        analysisData: q.analysisData || '',
        subject: normalizeSubject(q.subject || subject),
      }))
      
      questions.value = deduplicateQuestions(convertedQuestions)
      await deleteQuestionsFromIndexedDB(subject)
      await saveQuestionsToIndexedDB(subject, questions.value)
    } catch (error) {
      if (!(await loadQuestionsFromLocal(subject))) {
        throw error
      }
    } finally {
      isLoading.value = false
      loadingSubjects.delete(subject)
    }
  }

  const selectQuestion = async (index: number): Promise<void> => {
    if (index < 0 || index >= questions.value.length) return
    currentQuestionIndex.value = index
  }

  const deleteQuestion = async (index: number, subject?: string): Promise<void> => {
    if (index < 0 || index >= questions.value.length) return
    questions.value.splice(index, 1)
    if (index === currentQuestionIndex.value) {
      currentQuestionIndex.value = -1
    } else if (index < currentQuestionIndex.value) {
      currentQuestionIndex.value--
    }
    if (subject) {
      await saveQuestionsToIndexedDB(subject, questions.value)
    }
  }

  const moveQuestionToTop = (index: number): void => {
    if (index <= 0 || index >= questions.value.length) return
    const question = questions.value.splice(index, 1)[0]
    questions.value.unshift(question)
    if (currentQuestionIndex.value === index) {
      currentQuestionIndex.value = 0
    } else if (currentQuestionIndex.value < index) {
      currentQuestionIndex.value++
    }
  }

  const moveQuestionToTopById = (questionId: string): void => {
    const index = questions.value.findIndex(q => q.id === questionId)
    if (index !== -1) moveQuestionToTop(index)
  }

  const findSimilarQuestions = async (questionId?: string, subject?: string): Promise<void> => {
    try {
      isLoading.value = true
      let targetQuestion: ExerciseItem | null = null
      if (questionId) {
        targetQuestion = questions.value.find(q => q.id === questionId || q.bmNo === questionId) || null
      } else if (currentQuestion.value) {
        targetQuestion = currentQuestion.value
      }
      
      if (!targetQuestion) {
        similarQuestions.value = []
        return
      }
      
      const targetSubject = subject || targetQuestion.subject || 'math'
      const similar = await apiService.findSimilarQuestions(targetQuestion, targetSubject)
      similarQuestions.value = similar
    } finally {
      isLoading.value = false
    }
  }

  const addSimilarQuestionToList = async (question: ExerciseItem, subject?: string): Promise<void> => {
    const exists = questions.value.some(q => q.bmNo === question.bmNo)
    if (exists) throw new Error('该题目已存在')

    const normalizedSub = subject || question.subject || 'math'
    const response = await apiService.addQuestionToList(question, normalizedSub)
    if (!response.success) throw new Error(response.message || '添加失败')

    await fetchQuestions(normalizedSub, false)
  }

  const setQuestions = async (newQuestions: ExerciseItem[], subject?: string): Promise<void> => {
    const normalized = (newQuestions || []).map((q) => ({
      ...q,
      subject: normalizeSubject((q as any).subject),
    }))
    questions.value = deduplicateQuestions(normalized)
    if (subject) {
      await saveQuestionsToIndexedDB(subject, questions.value)
    }
  }

  const deduplicateQuestions = (questionList: ExerciseItem[]): ExerciseItem[] => {
    const uniqueMap = new Map<string, ExerciseItem>()
    for (const question of questionList) {
      if (question.title && !uniqueMap.has(question.title)) {
        uniqueMap.set(question.title, question)
      }
    }
    return Array.from(uniqueMap.values())
  }

  const clearCurrentQuestion = (): void => {
    currentQuestionIndex.value = -1
  }

  return {
    questions,
    similarQuestions,
    currentQuestionIndex,
    isLoading,
    currentQuestion,
    hasQuestions,
    fetchQuestions,
    fetchAllSubjectsQuestions,
    loadQuestionsFromLocal,
    selectQuestion,
    deleteQuestion,
    moveQuestionToTop,
    moveQuestionToTopById,
    findSimilarQuestions,
    addSimilarQuestionToList,
    setQuestions,
    deduplicateQuestions,
    clearCurrentQuestion
  }
})

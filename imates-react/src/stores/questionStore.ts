import { create } from 'zustand'
import { apiService } from '@/services/http/api-service'
import type { ExerciseItem } from '@/types'
import {
  saveQuestionsToIndexedDB,
  loadQuestionsFromIndexedDB,
  deleteQuestionsFromIndexedDB,
} from '@/services/storage/question-storage'
import { showMessage } from '@/utils'
import { normalizeSubject } from '@/constants/subjects'

interface QuestionState {
  questions: ExerciseItem[]
  similarQuestions: ExerciseItem[]
  currentQuestionIndex: number
  isLoading: boolean
  loadingSubjects: Set<string>
  
  // Actions
  fetchQuestions: (subject?: string, useLocalFirst?: boolean) => Promise<void>
  fetchAllSubjectsQuestions: (useLocalFirst?: boolean) => Promise<void>
  loadQuestionsFromLocal: (subject: string) => Promise<boolean>
  loadSingleSubjectFromLocal: (subject: string) => Promise<ExerciseItem[] | null>
  selectQuestion: (index: number) => Promise<void>
  deleteQuestion: (index: number, subject?: string) => Promise<void>
  moveQuestionToTop: (index: number) => void
  moveQuestionToTopById: (questionId: string) => void
  findSimilarQuestions: (questionId?: string, subject?: string) => Promise<void>
  addSimilarQuestionToList: (question: ExerciseItem, subject?: string) => Promise<void>
  setQuestions: (newQuestions: ExerciseItem[], subject?: string) => Promise<void>
  clearCurrentQuestion: () => void
  
  // Getters
  getCurrentQuestion: () => ExerciseItem | null
  getHasQuestions: () => boolean
}

export const useQuestionStore = create<QuestionState>((set, get) => ({
  questions: [],
  similarQuestions: [],
  currentQuestionIndex: -1,
  isLoading: false,
  loadingSubjects: new Set(),

  getCurrentQuestion: () => {
    const { questions, currentQuestionIndex } = get()
    if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
      return questions[currentQuestionIndex]
    }
    return null
  },

  getHasQuestions: () => get().questions.length > 0,

  fetchQuestions: async (subject = 'math', useLocalFirst = true) => {
    const { loadingSubjects } = get()
    if (loadingSubjects.has(subject)) return
    
    set((state) => {
      const next = new Set(state.loadingSubjects)
      next.add(subject)
      return { loadingSubjects: next, isLoading: true }
    })

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

      const deduplicated = deduplicateQuestions(convertedQuestions)
      set({ questions: deduplicated, isLoading: false })

      try {
        await deleteQuestionsFromIndexedDB(subject)
        await saveQuestionsToIndexedDB(subject, deduplicated)
      } catch (error) {
        console.error('[QUESTION] 保存到 IndexedDB 失败:', error)
      }
    } catch (error) {
      console.error(`[QUESTION] 获取题目失败:`, error)
      if (useLocalFirst) {
        const localSuccess = await get().loadQuestionsFromLocal(subject)
        if (!localSuccess) {
          set({ isLoading: false })
          throw error
        }
      } else {
        set({ isLoading: false })
        throw error
      }
    } finally {
      set((state) => {
        const next = new Set(state.loadingSubjects)
        next.delete(subject)
        return { loadingSubjects: next }
      })
    }
  },

  loadSingleSubjectFromLocal: async (subject) => {
    try {
      const loaded = await loadQuestionsFromIndexedDB(subject)
      if (loaded && loaded.length > 0) {
        return deduplicateQuestions(loaded.map(q => ({
          ...q,
          subject: normalizeSubject(q.subject),
        })))
      }
      return null
    } catch (error) {
      console.error(`[QUESTION] ❌ 从 IndexedDB 加载 ${subject} 失败:`, error)
      return null
    }
  },

  fetchAllSubjectsQuestions: async (useLocalFirst = true) => {
    set({ isLoading: true })
    const allSubjects = ['math', 'biology', 'chemistry', 'physics', 'chinese', 'english']
    const allQuestions: ExerciseItem[] = []

    try {
      const loadPromises = allSubjects.map(async (subject) => {
        try {
          const questionList = await apiService.getExerciseList(subject)
          const converted: ExerciseItem[] = questionList.map((q: any) => ({
            bmNo: q.bmNo || q.id || '',
            id: q.id || q.bmNo || '',
            title: q.title || '',
            question: q.content || q.question || q.title || '',
            answer: q.answer || '',
            explanation: q.explanation || '',
            analysisData: q.analysisData || '',
            subject: normalizeSubject(q.subject || subject),
          }))

          if (converted.length > 0) {
            await deleteQuestionsFromIndexedDB(subject)
            await saveQuestionsToIndexedDB(subject, converted)
          }
          return converted
        } catch (error) {
          const loaded = await get().loadSingleSubjectFromLocal(subject)
          return loaded || []
        }
      })

      const arrays = await Promise.all(loadPromises)
      arrays.forEach(arr => allQuestions.push(...arr))
      set({ questions: deduplicateQuestions(allQuestions), isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  loadQuestionsFromLocal: async (subject: string) => {
    const loaded = await get().loadSingleSubjectFromLocal(subject)
    if (loaded) {
      set({ questions: loaded })
      return true
    }
    return false
  },

  selectQuestion: async (index) => {
    if (index < 0 || index >= get().questions.length) return
    set({ currentQuestionIndex: index })
  },

  deleteQuestion: async (index, subject) => {
    const { questions, currentQuestionIndex } = get()
    if (index < 0 || index >= questions.length) return
    
    const newQuestions = [...questions]
    newQuestions.splice(index, 1)
    
    let newIndex = currentQuestionIndex
    if (index === currentQuestionIndex) {
      newIndex = -1
    } else if (index < currentQuestionIndex) {
      newIndex--
    }

    set({ questions: newQuestions, currentQuestionIndex: newIndex })

    if (subject) {
      await saveQuestionsToIndexedDB(subject, newQuestions)
    }
  },

  moveQuestionToTop: (index) => {
    const { questions, currentQuestionIndex } = get()
    if (index <= 0 || index >= questions.length) return

    const newQuestions = [...questions]
    const [item] = newQuestions.splice(index, 1)
    newQuestions.unshift(item)

    let newIndex = currentQuestionIndex
    if (currentQuestionIndex === index) {
      newIndex = 0
    } else if (currentQuestionIndex < index) {
      newIndex++
    }

    set({ questions: newQuestions, currentQuestionIndex: newIndex })
  },

  moveQuestionToTopById: (id) => {
    const index = get().questions.findIndex(q => q.id === id)
    if (index !== -1) get().moveQuestionToTop(index)
  },

  findSimilarQuestions: async (questionId, subject) => {
    set({ isLoading: true })
    try {
      const { questions } = get()
      const currentQuestion = get().getCurrentQuestion()
      let target = questionId 
        ? (questions.find(q => q.id === questionId || q.bmNo === questionId) || null)
        : currentQuestion
      
      if (!target) {
        set({ similarQuestions: [], isLoading: false })
        return
      }

      const similar = await apiService.findSimilarQuestions(target, subject || target.subject || 'math')
      set({ similarQuestions: similar, isLoading: false })
    } catch (error) {
      set({ similarQuestions: [], isLoading: false })
    }
  },

  addSimilarQuestionToList: async (question, subject) => {
    if (get().questions.some(q => q.bmNo === question.bmNo)) {
      throw new Error('该题目已存在于题目列表中')
    }

    const normalizedSubject = subject || question.subject || 'math'
    const response = await apiService.addQuestionToList(question, normalizedSubject)
    if (!response.success) throw new Error(response.message || '添加失败')

    await get().fetchQuestions(normalizedSubject, false)
  },

  setQuestions: async (newQuestions, subject) => {
    const { questions } = get()
    // 快速检查内容是否相同，避免冗余更新导致无限循环
    if (newQuestions === questions || (newQuestions && questions && JSON.stringify(newQuestions) === JSON.stringify(questions))) {
      return
    }

    const normalized = (newQuestions || []).map(q => ({
      ...q,
      subject: normalizeSubject(q.subject),
    }))
    const deduplicated = deduplicateQuestions(normalized)
    set({ questions: deduplicated })
    if (subject) await saveQuestionsToIndexedDB(subject, deduplicated)
  },

  clearCurrentQuestion: () => set({ currentQuestionIndex: -1 }),
}))

function deduplicateQuestions(list: ExerciseItem[]): ExerciseItem[] {
  const map = new Map<string, ExerciseItem>()
  for (const q of list) {
    const key = q.bmNo || q.id || q.title
    if (key && !map.has(key)) map.set(key, q)
  }
  return Array.from(map.values())
}

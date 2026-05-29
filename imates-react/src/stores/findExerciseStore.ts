import { create } from 'zustand'
import { apiService } from '../services/http/api-service'
import type {
  ExerciseItem,
  FindSimilarQuestionByKnowledgeRequest,
  AddQuestionRequest,
  FindExerciseConfig
} from '../types'

interface FindExerciseState {
  config: FindExerciseConfig | null
  isLoading: boolean
  questionsInFavor: ExerciseItem[]
  similarQuestions: ExerciseItem[]
  pagination: {
    currentPage: number
    pageSize: number
    totalCount: number
  }
  hasEmptyPage: boolean
  selectedQuestionIds: string[]
  
  // Actions
  initializeStore: (newConfig: FindExerciseConfig) => void
  fetchQuestionList: () => Promise<void>
  findSimilarQuestions: (withLoading?: boolean) => Promise<void>
  loadMoreQuestions: () => Promise<boolean>
  resetPagination: () => void
  toggleQuestionSelection: (questionId: string) => void
  toggleSelectAll: () => void
  addSelectedQuestionsToList: () => Promise<boolean>
  resetState: () => void
  partialResetState: () => void
  
  // Derived state (helper methods since Zustand doesn't have computed)
  hasSelectedQuestions: () => boolean
  getSelectedQuestions: () => ExerciseItem[]
  canLoadMore: () => boolean
}

export const useFindExerciseStore = create<FindExerciseState>((set, get) => ({
  config: null,
  isLoading: false,
  questionsInFavor: [],
  similarQuestions: [],
  pagination: {
    currentPage: 0,
    pageSize: 10,
    totalCount: 0
  },
  hasEmptyPage: false,
  selectedQuestionIds: [],

  hasSelectedQuestions: () => {
    const { selectedQuestionIds, similarQuestions } = get()
    const manuallySelected = selectedQuestionIds.length > 0
    const favoritedQuestions = similarQuestions.some(q => q.atUserList)
    return manuallySelected || favoritedQuestions
  },

  getSelectedQuestions: () => {
    const { selectedQuestionIds, similarQuestions } = get()
    return similarQuestions.filter(q => 
      selectedQuestionIds.includes(q.bmNo) || q.atUserList
    )
  },

  canLoadMore: () => {
    const { hasEmptyPage, similarQuestions, pagination } = get()
    if (hasEmptyPage) return false
    return similarQuestions.length < pagination.totalCount
  },

  initializeStore: (newConfig) => {
    set({
      config: newConfig,
      pagination: {
        currentPage: 0,
        pageSize: 10,
        totalCount: 0
      }
    })
  },

  fetchQuestionList: async () => {
    const { config, findSimilarQuestions } = get()
    if (!config) return
    
    try {
      set({ isLoading: true })
      const subjectName = (config.subject || 'math').toString()
      const questions = await apiService.getExerciseList(subjectName)
      set({ questionsInFavor: questions })
      
      await findSimilarQuestions(false)
    } catch (error) {
      console.error('获取题目列表失败:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  findSimilarQuestions: async (withLoading = true) => {
    const { config, questionsInFavor, pagination } = get()
    if (!config) return
    
    try {
      if (withLoading) set({ isLoading: true })
      
      const uniqueExerciseIds = [...new Set(questionsInFavor.map(q => q.bmNo).filter(id => id))].join(',')
      const bmNoList = (config.bmNoList || '').trim()
      const knowledgeList = (config.knowledgeList || '').trim()
      const type = (config.subject || 'math').toString()
      const size = Math.max(1, pagination.pageSize)
      const current = Math.max(1, pagination.currentPage + 1)
      
      if (bmNoList) {
        const request = {
          bmNoList,
          exercisesId: uniqueExerciseIds,
          type,
          size,
          current,
        }
        const result = await apiService.findSimilarQuestionsByBmNoList(request)
        
        result.questions.forEach((question: any) => {
          question.atUserList = questionsInFavor.some(fav => fav.bmNo === question.bmNo)
        })
        
        set((state) => {
          const nextSimilarQuestions = state.pagination.currentPage === 0 
            ? result.questions 
            : [...state.similarQuestions, ...result.questions]
          
          const isEmptyPage = result.questions.length === 0 && state.pagination.currentPage > 0
          
          return {
            similarQuestions: nextSimilarQuestions,
            hasEmptyPage: isEmptyPage,
            pagination: {
              ...state.pagination,
              totalCount: result.totalCount,
              pageSize: result.pageSize,
              currentPage: result.currentPage - 1
            }
          }
        })
        return
      }
      
      if (!knowledgeList) {
        console.error('知识点列表不能为空')
        return
      }
      
      const request: FindSimilarQuestionByKnowledgeRequest = {
        knowledgeNo: knowledgeList,
        exercisesId: uniqueExerciseIds,
        type,
        size,
        current,
      }
      
      const result = await apiService.findSimilarQuestionsByKnowledge(request)
      
      result.questions.forEach(question => {
        question.atUserList = questionsInFavor.some(fav => fav.bmNo === question.bmNo)
      })
      
      set((state) => {
        const nextSimilarQuestions = state.pagination.currentPage === 0 
          ? result.questions 
          : [...state.similarQuestions, ...result.questions]
        
        const isEmptyPage = result.questions.length === 0 && state.pagination.currentPage > 0
        
        return {
          similarQuestions: nextSimilarQuestions,
          hasEmptyPage: isEmptyPage,
          pagination: {
            ...state.pagination,
            totalCount: result.totalCount,
            pageSize: result.pageSize,
            currentPage: result.currentPage - 1
          }
        }
      })
    } catch (error) {
      console.error('查找相似题目失败:', error)
    } finally {
      if (withLoading) set({ isLoading: false })
    }
  },

  loadMoreQuestions: async () => {
    const { config, hasEmptyPage, similarQuestions, pagination, findSimilarQuestions } = get()
    if (!config || hasEmptyPage || similarQuestions.length >= pagination.totalCount) {
      return false
    }
    
    try {
      set({ isLoading: true })
      set((state) => ({
        pagination: {
          ...state.pagination,
          currentPage: state.pagination.currentPage + 1
        }
      }))
      
      await findSimilarQuestions(false)
      return true
    } catch (error) {
      console.error('加载更多题目失败:', error)
      set((state) => ({
        pagination: {
          ...state.pagination,
          currentPage: Math.max(0, state.pagination.currentPage - 1)
        }
      }))
      return false
    } finally {
      set({ isLoading: false })
    }
  },

  resetPagination: () => {
    set((state) => ({
      pagination: {
        ...state.pagination,
        currentPage: 0,
        totalCount: 0
      },
      hasEmptyPage: false
    }))
  },

  toggleQuestionSelection: (questionId) => {
    set((state) => {
      const index = state.selectedQuestionIds.indexOf(questionId)
      const nextSelected = [...state.selectedQuestionIds]
      if (index > -1) {
        nextSelected.splice(index, 1)
      } else {
        nextSelected.push(questionId)
      }
      return { selectedQuestionIds: nextSelected }
    })
  },

  toggleSelectAll: () => {
    const { similarQuestions, selectedQuestionIds } = get()
    const selectableQuestions = similarQuestions.filter(q => !q.atUserList)
    const allSelectableSelected = selectableQuestions.every(q => selectedQuestionIds.includes(q.bmNo))
    
    if (allSelectableSelected) {
      set({ selectedQuestionIds: [] })
    } else {
      set({ selectedQuestionIds: selectableQuestions.map(q => q.bmNo) })
    }
  },

  addSelectedQuestionsToList: async () => {
    const { config, selectedQuestionIds, questionsInFavor } = get()
    if (!config) {
      console.error('[findExerciseStore] 配置为空，无法添加题目')
      return false
    }
    
    const manuallySelectedIds = selectedQuestionIds.filter(id => id)
    if (manuallySelectedIds.length === 0) {
      return false
    }
    
    try {
      const subjectName = (config.subject || 'math').toString()
      const uniqueSelectedIds = [...new Set(manuallySelectedIds)].join(',')
      const uniqueExerciseIds = [...new Set(questionsInFavor.map(q => q.bmNo).filter(id => id))].join(',')
      const request: AddQuestionRequest = {
        bmNo: uniqueSelectedIds,
        type: subjectName,
        exercisesId: uniqueExerciseIds
      }
      
      const response = await apiService.addQuestionToList(request, subjectName)
      return response.success
    } catch (error) {
      console.error('[findExerciseStore] ❌ 添加题目失败，发生异常:', error)
      return false
    }
  },

  resetState: () => {
    set({
      questionsInFavor: [],
      similarQuestions: [],
      selectedQuestionIds: [],
      pagination: {
        currentPage: 0,
        pageSize: 10,
        totalCount: 0
      },
      hasEmptyPage: false
    })
  },

  partialResetState: () => {
    set({
      questionsInFavor: [],
      similarQuestions: [],
      pagination: {
        currentPage: 0,
        pageSize: 10,
        totalCount: 0
      },
      hasEmptyPage: false
    })
  }
}))

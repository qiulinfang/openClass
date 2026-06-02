/**
 * 习题查找页面状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/http/api-service'
import type { ExerciseItem } from '../types'

export interface FindExerciseConfig {
  subject: string
  bmNoList?: string
  knowledgeList?: string
}

export const useFindExerciseStore = defineStore('findExercise', () => {
  // ==================== 响应式状态定义 ====================
  
  const config = ref<FindExerciseConfig | null>(null)
  const isLoading = ref(false)
  const questionsInFavor = ref<ExerciseItem[]>([])
  const similarQuestions = ref<ExerciseItem[]>([])
  const pagination = ref({
    currentPage: 0,
    pageSize: 10,
    totalCount: 0
  })
  const hasEmptyPage = ref(false)
  const selectedQuestionIds = ref<string[]>([])
  
  // ==================== 计算属性 ====================
  
  const hasSelectedQuestions = computed(() => {
    const manuallySelected = selectedQuestionIds.value.length > 0
    const favoritedQuestions = similarQuestions.value.some(q => q.atUserList)
    return manuallySelected || favoritedQuestions
  })
  
  const selectedQuestions = computed(() => 
    similarQuestions.value.filter(q => 
      selectedQuestionIds.value.includes(q.bmNo || '') || q.atUserList
    )
  )
  
  // ==================== 方法定义 ====================
  
  const initializeStore = async (newConfig: FindExerciseConfig) => {
    config.value = newConfig
    pagination.value.currentPage = 0
  }
  
  const fetchQuestionList = async () => {
    if (!config.value) return
    
    isLoading.value = true
    try {
      const subjectName = config.value.subject || 'math'
      const questions = await apiService.getExerciseList(subjectName)
      questionsInFavor.value = questions
      await findSimilarQuestions()
    } catch (error) {
      console.error('获取题目列表失败:', error)
    } finally {
      isLoading.value = false
    }
  }
  
  const findSimilarQuestions = async () => {
    if (!config.value) return
    
    try {
      const uniqueExerciseIds = [...new Set(questionsInFavor.value.map(q => q.bmNo).filter(id => id))].join(',')
      const bmNoList = (config.value.bmNoList || '').trim()
      const knowledgeList = (config.value.knowledgeList || '').trim()
      const type = config.value.subject || 'math'
      const size = pagination.value.pageSize
      const current = pagination.value.currentPage + 1
      
      let result: any
      if (bmNoList) {
        result = await apiService.findSimilarQuestionsByBmNoList({
          bmNoList,
          exercisesId: uniqueExerciseIds,
          type,
          size,
          current,
        })
      } else if (knowledgeList) {
        result = await apiService.findSimilarQuestionsByKnowledge({
          knowledgeNo: knowledgeList,
          exercisesId: uniqueExerciseIds,
          type,
          size,
          current,
        })
      }

      if (result) {
        result.questions.forEach((question: any) => {
          question.atUserList = questionsInFavor.value.some(fav => fav.bmNo === question.bmNo)
        })
        
        pagination.value.totalCount = result.totalCount
        if (pagination.value.currentPage === 0) {
          similarQuestions.value = result.questions
        } else {
          similarQuestions.value.push(...result.questions)
        }
      }
    } catch (error) {
      console.error('查找相似题目失败:', error)
    }
  }

  const loadMoreQuestions = async (): Promise<boolean> => {
    if (!config.value || isLoading.value) return false
    if (similarQuestions.value.length >= pagination.value.totalCount) return false
    
    isLoading.value = true
    pagination.value.currentPage += 1
    try {
      await findSimilarQuestions()
      return true
    } catch (error) {
      pagination.value.currentPage -= 1
      return false
    } finally {
      isLoading.value = false
    }
  }

  const toggleQuestionSelection = (questionId: string) => {
    const index = selectedQuestionIds.value.indexOf(questionId)
    if (index > -1) {
      selectedQuestionIds.value.splice(index, 1)
    } else {
      selectedQuestionIds.value.push(questionId)
    }
  }
  
  const addSelectedQuestionsToList = async (): Promise<boolean> => {
    if (!config.value) return false
    const manuallySelectedIds = selectedQuestionIds.value.filter(id => id)
    if (manuallySelectedIds.length === 0) return false
    
    try {
      const subjectName = config.value.subject || 'math'
      const uniqueSelectedIds = [...new Set(manuallySelectedIds)].join(',')
      const uniqueExerciseIds = [...new Set(questionsInFavor.value.map(q => q.bmNo).filter(id => id))].join(',')
      
      const response = await apiService.addQuestionToList({
        bmNo: uniqueSelectedIds,
        type: subjectName,
        exercisesId: uniqueExerciseIds
      }, subjectName)
      
      return response.success
    } catch (error) {
      console.error('添加题目失败:', error)
      return false
    }
  }
  
  const resetState = () => {
    questionsInFavor.value = []
    similarQuestions.value = []
    selectedQuestionIds.value = []
    pagination.value = {
      currentPage: 0,
      pageSize: 10,
      totalCount: 0
    }
    hasEmptyPage.value = false
  }

  return {
    config,
    isLoading,
    questionsInFavor,
    similarQuestions,
    pagination,
    selectedQuestionIds,
    hasEmptyPage,
    hasSelectedQuestions,
    selectedQuestions,
    initializeStore,
    fetchQuestionList,
    findSimilarQuestions,
    loadMoreQuestions,
    toggleQuestionSelection,
    addSelectedQuestionsToList,
    resetState
  }
})

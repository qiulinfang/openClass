/**
 * 题目管理 Store
 * 职责：管理题目列表、题目选择、相似题目
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/api-service'
import type { ExerciseItem } from '../types'

export const useQuestionStore = defineStore('question', () => {
  // ==================== 状态定义 ====================
  
  /** 题目列表 */
  const questions = ref<ExerciseItem[]>([])
  
  /** 相似题目列表 */
  const similarQuestions = ref<ExerciseItem[]>([])
  
  /** 当前选中的题目索引 */
  const currentQuestionIndex = ref(-1)
  
  /** 加载状态 */
  const isLoading = ref(false)
  
  // ==================== 计算属性 ====================
  
  /** 当前选中的题目 */
  const currentQuestion = computed(() => {
    if (currentQuestionIndex.value >= 0 && currentQuestionIndex.value < questions.value.length) {
      return questions.value[currentQuestionIndex.value]
    }
    return null
  })
  
  /** 是否有题目数据 */
  const hasQuestions = computed(() => questions.value.length > 0)
  
  // ==================== 方法 ====================
  
  /**
   * 获取题目列表
   * 第1步：调用API获取题目
   * 第2步：去重并更新状态
   */
  const fetchQuestions = async (): Promise<void> => {
    try {
      isLoading.value = true
      const fetchedQuestions = await apiService.fetchQuestions()
      
      // 去重
      questions.value = deduplicateQuestions(fetchedQuestions)
      
      console.log('[QUESTION] ✅ 获取题目:', questions.value.length)
    } catch (error) {
      console.error('[QUESTION] ❌ 获取题目失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * 选择题目
   * 第1步：更新当前题目索引
   * 第2步：标记题目为已查看
   */
  const selectQuestion = async (index: number): Promise<void> => {
    if (index < 0 || index >= questions.value.length) {
      console.error('[QUESTION] ❌ 无效的题目索引:', index)
      return
    }
    
    currentQuestionIndex.value = index
    
    // 标记为已查看
    if (questions.value[index]) {
      questions.value[index].isViewed = true
    }
    
    console.log('[QUESTION] ✅ 选择题目:', index)
  }
  
  /**
   * 删除题目
   */
  const deleteQuestion = async (index: number): Promise<void> => {
    if (index < 0 || index >= questions.value.length) {
      console.error('[QUESTION] ❌ 无效的题目索引:', index)
      return
    }
    
    questions.value.splice(index, 1)
    
    // 如果删除的是当前题目，重置索引
    if (index === currentQuestionIndex.value) {
      currentQuestionIndex.value = -1
    } else if (index < currentQuestionIndex.value) {
      currentQuestionIndex.value--
    }
    
    console.log('[QUESTION] ✅ 删除题目:', index)
  }
  
  /**
   * 移动题目到顶部
   */
  const moveQuestionToTop = (index: number): void => {
    if (index <= 0 || index >= questions.value.length) {
      return
    }
    
    const question = questions.value.splice(index, 1)[0]
    questions.value.unshift(question)
    
    // 更新当前索引
    if (currentQuestionIndex.value === index) {
      currentQuestionIndex.value = 0
    } else if (currentQuestionIndex.value < index) {
      currentQuestionIndex.value++
    }
    
    console.log('[QUESTION] ✅ 移动题目到顶部:', index)
  }
  
  /**
   * 根据ID移动题目到顶部
   */
  const moveQuestionToTopById = (questionId: string): void => {
    const index = questions.value.findIndex(q => q.id === questionId)
    if (index !== -1) {
      moveQuestionToTop(index)
    }
  }
  
  /**
   * 查找相似题目
   */
  const findSimilarQuestions = async (questionId: string): Promise<void> => {
    try {
      isLoading.value = true
      const similar = await apiService.findSimilarQuestions(questionId)
      similarQuestions.value = similar
      console.log('[QUESTION] ✅ 查找相似题目:', similar.length)
    } catch (error) {
      console.error('[QUESTION] ❌ 查找相似题目失败:', error)
      similarQuestions.value = []
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * 添加相似题目到列表
   */
  const addSimilarQuestionToList = (question: ExerciseItem): void => {
    // 检查是否已存在
    const exists = questions.value.some(q => q.id === question.id)
    if (!exists) {
      questions.value.push(question)
      console.log('[QUESTION] ✅ 添加相似题目到列表')
    }
  }
  
  /**
   * 设置题目列表
   */
  const setQuestions = (newQuestions: ExerciseItem[]): void => {
    questions.value = deduplicateQuestions(newQuestions)
    console.log('[QUESTION] ✅ 设置题目列表:', questions.value.length)
  }
  
  /**
   * 题目去重算法
   * 使用 Map 实现高效去重
   */
  const deduplicateQuestions = (questionList: ExerciseItem[]): ExerciseItem[] => {
    const uniqueMap = new Map<string, ExerciseItem>()
    
    for (const question of questionList) {
      if (question.id && !uniqueMap.has(question.id)) {
        uniqueMap.set(question.id, question)
      }
    }
    
    return Array.from(uniqueMap.values())
  }
  
  // ==================== 返回接口 ====================
  
  return {
    // 状态
    questions,
    similarQuestions,
    currentQuestionIndex,
    isLoading,
    
    // 计算属性
    currentQuestion,
    hasQuestions,
    
    // 方法
    fetchQuestions,
    selectQuestion,
    deleteQuestion,
    moveQuestionToTop,
    moveQuestionToTopById,
    findSimilarQuestions,
    addSimilarQuestionToList,
    setQuestions,
    deduplicateQuestions
  }
})


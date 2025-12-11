/**
 * 作业管理 Store
 * 职责：管理作业列表、作业选择
 * 与 questionStore 结构类似，但数据来源和持久化 key 不同
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ExerciseItem } from '../types'
import { saveQuestionsToIndexedDB } from '../services/storage/question-storage'
import { showMessage } from '@/utils'

// 作业存储的 key 前缀（区别于习题）
const HOMEWORK_STORAGE_PREFIX = 'homework_'

export const useHomeworkStore = defineStore('homework', () => {
  // ==================== 状态定义 ====================
  
  /** 作业列表 */
  const questions = ref<ExerciseItem[]>([])
  
  /** 当前选中的作业索引 */
  const currentQuestionIndex = ref(-1)
  
  /** 当前作业名称（来自 MyHomeworkView 选中的那份作业） */
  const homeworkName = ref('')

  /** 每道题的作答数据缓存：key = 题目唯一标识，value = DrawingBoard.saveData() 返回的数据 */
  const answerDataCache = ref<Record<string, unknown>>({})
  
  // ==================== 计算属性 ====================
  
  /** 当前选中的作业 */
  const currentQuestion = computed(() => {
    if (currentQuestionIndex.value >= 0 && currentQuestionIndex.value < questions.value.length) {
      return questions.value[currentQuestionIndex.value]
    }
    return null
  })
  
  /** 是否有作业数据 */
  const hasQuestions = computed(() => questions.value.length > 0)

  // ==================== 方法 ====================

  /**
   * 设置当前作业名称
   */
  const setHomeworkName = (name: string): void => {
    homeworkName.value = name
  }

  /**
   * 选择作业
   * @param index 作业索引
   */
  const selectQuestion = async (index: number): Promise<void> => {
    if (index < 0 || index >= questions.value.length) {
      console.error('[HOMEWORK] ❌ 无效的作业索引:', index)
      showMessage('无效的作业索引', 'error')
      return
    }
    
    currentQuestionIndex.value = index
  }
  
  /**
   * 设置作业列表
   * @param newQuestions 新的作业列表
   * @param subject 科目类型（可选，用于保存到 IndexedDB）
   */
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
  
  /**
   * 作业去重算法
   */
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
  
  /**
   * 清空当前选中的作业
   */
  const clearCurrentQuestion = (): void => {
    currentQuestionIndex.value = -1
  }
  
  // ==================== 返回接口 ====================
  
  return {
    // 状态
    questions,
    currentQuestionIndex,
    homeworkName,
    answerDataCache,
    
    // 计算属性
    currentQuestion,
    hasQuestions,
    
    // 方法
    selectQuestion,
    setHomeworkName,
    setQuestions,
    deduplicateQuestions,
    clearCurrentQuestion
  }
})

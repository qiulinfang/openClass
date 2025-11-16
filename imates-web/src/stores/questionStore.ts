/**
 * 题目管理 Store
 * 职责：管理题目列表、题目选择、相似题目
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiService } from '../services/api-service'
import type { ExerciseItem } from '../types'
import {
  saveQuestionsToIndexedDB,
  loadQuestionsFromIndexedDB
} from '../services/question-storage'

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
  
  /** 正在加载的科目（防止重复调用） */
  const loadingSubjects = new Set<string>()
  
  // ==================== 计算属性 ====================
  
  /** 当前选中的题目 */
  const currentQuestion = computed(() => {
    if (currentQuestionIndex.value >= 0 && currentQuestionIndex.value < questions.value.length) {
      console.log('当前选中的题目', questions.value[currentQuestionIndex.value])
      return questions.value[currentQuestionIndex.value]
    }
    console.log('当前没有选中的题目')
    return null
  })
  
  /** 是否有题目数据 */
  const hasQuestions = computed(() => questions.value.length > 0)

  /**
   * 从 IndexedDB 加载题目列表
   * @param subject 科目类型（math 或 biology）
   * @returns 是否成功加载
   */
  const loadQuestionsFromLocal = async (subject: string): Promise<boolean> => {
    try {
      const loadedQuestions = await loadQuestionsFromIndexedDB(subject)
      
      if (loadedQuestions && Array.isArray(loadedQuestions) && loadedQuestions.length > 0) {
        questions.value = deduplicateQuestions(loadedQuestions)
        return true
      }
      
      return false
    } catch (error) {
      console.error('[QUESTION] ❌ 从 IndexedDB 加载题目列表失败:', error)
      return false
    }
  }
  
  // ==================== 方法 ====================
  
  /**
   * 从 IndexedDB 加载单个学科的题目（不修改全局状态）
   * @param subject 科目类型
   * @returns 题目列表，如果没有数据则返回 null
   */
  const loadSingleSubjectFromLocal = async (subject: string): Promise<ExerciseItem[] | null> => {
    try {
      const loadedQuestions = await loadQuestionsFromIndexedDB(subject)
      
      if (loadedQuestions && Array.isArray(loadedQuestions) && loadedQuestions.length > 0) {
        const deduplicated = deduplicateQuestions(loadedQuestions)
        return deduplicated
      }
      
      return null
    } catch (error) {
      console.error(`[QUESTION] ❌ 从 IndexedDB 加载 ${subject} 科目题目失败:`, error)
      return null
    }
  }

  /**
   * 获取所有学科的题目列表
   * 合并所有学科的题目到一个列表中
   */
  const fetchAllSubjectsQuestions = async (useLocalFirst: boolean = true): Promise<void> => {
    const fetchStartTime = performance.now()
    
    const allSubjects = ['math', 'biology', 'chemistry', 'physics', 'chinese', 'english']
    const allQuestions: ExerciseItem[] = []
    
    try {
      isLoading.value = true
      
      // 并行加载所有学科的题目
      const loadPromises = allSubjects.map(async (subject) => {
        try {
          
          // 第1步：优先从 IndexedDB 加载
          if (useLocalFirst) {
            const loaded = await loadSingleSubjectFromLocal(subject)
            if (loaded && loaded.length > 0) {
              return loaded
            }
          }
          
          // 第2步：从API获取题目
          const apiService = ApiService.getInstance()
          const questionList = await apiService.getExerciseList(subject)
          
          // 转换 API 响应的 ExerciseItem 类型
          const convertedQuestions: ExerciseItem[] = questionList.map((q: unknown) => {
            const question = q as Record<string, unknown>
            return {
              id: (question.id as string) || (question.bmNo as string) || '',
              bmNo: (question.bmNo as string) || (question.id as string) || '',
              title: (question.title as string) || '',
              question: (question.content as string) || (question.question as string) || (question.title as string) || '',
              answer: (question.answer as string) || '',
              explanation: (question.explanation as string) || '',
              analysisData: (question.analysisData as string) || '',
              subject: (question.subject as string) || subject.toLowerCase(),
            }
          })
          
          // 保存到 IndexedDB（直接调用底层方法，避免修改全局状态）
          // 只有当有题目时才保存，避免保存空数组
          if (convertedQuestions.length > 0) {
            try {
              await saveQuestionsToIndexedDB(subject, convertedQuestions)
            } catch (error) {
              console.error(`[QUESTION] 保存 ${subject} 科目题目到 IndexedDB 失败:`, error)
            }
          } else {
          }
          return convertedQuestions
        } catch (error) {
          console.error(`[QUESTION] ❌ 获取 ${subject} 科目题目失败:`, error)
          // 如果API失败，尝试使用 IndexedDB 的数据
          const loaded = await loadSingleSubjectFromLocal(subject)
          if (loaded && loaded.length > 0) {
            return loaded
          }
          return []
        }
      })
      
      const subjectQuestionsArrays = await Promise.all(loadPromises)
      
      // 合并所有学科的题目
      for (const subjectQuestions of subjectQuestionsArrays) {
        allQuestions.push(...subjectQuestions)
      }
      
      // 去重并更新状态
      questions.value = deduplicateQuestions(allQuestions)
      
    } catch (error) {
      const fetchDuration = performance.now() - fetchStartTime
      console.error(`[QUESTION] ❌ 获取所有学科题目失败 (耗时: ${fetchDuration.toFixed(2)}ms):`, error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 获取题目列表
   * 第1步：尝试从本地存储加载
   * 第2步：如果本地没有数据，调用API获取题目
   * 第3步：保存到本地存储
   * 第4步：去重并更新状态
   */
  const fetchQuestions = async (subject: string = 'math', useLocalFirst: boolean = true): Promise<void> => {
    // 防重复调用：如果该科目正在加载，直接返回
    if (loadingSubjects.has(subject)) {
      return
    }
    
    
    loadingSubjects.add(subject)
    
    try {
      isLoading.value = true
      
      // 第1步：优先从 IndexedDB 加载
      if (useLocalFirst) {
        const loaded = await loadQuestionsFromLocal(subject)
        
        if (loaded) {
          return
        }
      }
      
      // 第2步：从API获取题目
      const apiService = ApiService.getInstance()
      const questionList = await apiService.getExerciseList(subject)
      
      // 转换 API 响应的 ExerciseItem 类型
      const convertedQuestions: ExerciseItem[] = questionList.map((q: unknown) => {
        const question = q as Record<string, unknown>
        return {
          id: (question.id as string) || (question.bmNo as string) || '',
          bmNo: (question.bmNo as string) || (question.id as string) || '',
          title: (question.title as string) || '',
          question: (question.content as string) || (question.question as string) || (question.title as string) || '',
          answer: (question.answer as string) || '',
          explanation: (question.explanation as string) || '',
          analysisData: (question.analysisData as string) || '',
          subject: (question.subject as string) || subject.toLowerCase(),
        }
      })
      
      // 第3步：去重并更新状态
      questions.value = deduplicateQuestions(convertedQuestions)
      // 第4步：保存到 IndexedDB
      try {
        await saveQuestionsToIndexedDB(subject, questions.value)
      } catch (error) {
        console.error('[QUESTION] ❌ 保存题目列表到 IndexedDB 失败:', error)
      }
      
    } catch (error) {
      console.error(`[QUESTION] ❌ 获取题目失败:`, error)
      // 如果API失败，尝试使用 IndexedDB 的数据
      if (await loadQuestionsFromLocal(subject)) {
      } else {
        throw error
      }
    } finally {
      isLoading.value = false
      loadingSubjects.delete(subject)
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
    console.log('选择题目到 questionStore 成功', questions.value, currentQuestionIndex.value)
    
    // 标记为已查看（如果类型支持）
    if (questions.value[index]) {
      // 动态添加 isViewed 属性（如果类型允许）
      ;(questions.value[index] as ExerciseItem & { isViewed?: boolean }).isViewed = true
    }
  }
  
  /**
   * 删除题目
   * @param index 题目索引
   * @param subject 科目类型（可选，用于保存到 IndexedDB）
   */
  const deleteQuestion = async (index: number, subject?: string): Promise<void> => {
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
    
    // 如果提供了科目，保存到 IndexedDB
    if (subject) {
      try {
        await saveQuestionsToIndexedDB(subject, questions.value)
      } catch (error) {
        console.error('[QUESTION] ❌ 保存题目列表到 IndexedDB 失败:', error)
      }
    }
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
   * @param questionId 题目ID（可选，如果不提供则使用当前题目）
   * @param subject 科目类型（可选，如果不提供则从题目中推断）
   */
  const findSimilarQuestions = async (questionId?: string, subject?: string): Promise<void> => {
    try {
      isLoading.value = true
      const apiService = ApiService.getInstance()
      
      // 确定要查找的题目
      let targetQuestion: ExerciseItem | null = null
      
      if (questionId) {
        // 根据 questionId 查找题目
        targetQuestion = questions.value.find(q => q.id === questionId || q.bmNo === questionId) || null
      } else if (currentQuestion.value) {
        // 使用当前题目
        targetQuestion = currentQuestion.value
      }
      
      if (!targetQuestion) {
        console.error('[QUESTION] ❌ 找不到要查找相似题目的题目')
        similarQuestions.value = []
        return
      }
      
      // 确定科目类型
      const targetSubject = subject || targetQuestion.subject || 'math'
      
      // 调用 API 查找相似题目
      const similar = await apiService.findSimilarQuestions(targetQuestion, targetSubject)
      similarQuestions.value = similar
    } catch (error) {
      console.error('[QUESTION] ❌ 查找相似题目失败:', error)
      similarQuestions.value = []
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * 添加相似题目到列表
   * @param question 题目
   * @param subject 科目类型（可选，用于保存到 IndexedDB）
   */
  const addSimilarQuestionToList = async (question: ExerciseItem, subject?: string): Promise<void> => {
    // 检查是否已存在
    const exists = questions.value.some(q => q.bmNo === question.bmNo)
    if (!exists) {
      question.subject = subject
      question.id = Date.now().toString()
      questions.value.unshift(question)
      // 如果提供了科目，保存到 IndexedDB
      if (subject) {
        try {
          await saveQuestionsToIndexedDB(subject, questions.value)
        } catch (error) {
          console.error('[QUESTION] ❌ 保存题目列表到 IndexedDB 失败:', error)
        }
      }
    } else{
      throw new Error('该题目已存在于题目列表中，无法重复添加')
    }
  }
  
  /**
   * 设置题目列表
   * @param newQuestions 新的题目列表
   * @param subject 科目类型（可选，用于保存到 IndexedDB）
   */
  const setQuestions = async (newQuestions: ExerciseItem[], subject?: string): Promise<void> => {
    questions.value = deduplicateQuestions(newQuestions)
    // 如果提供了科目，保存到 IndexedDB
    if (subject) {
      try {
        await saveQuestionsToIndexedDB(subject, questions.value)
      } catch (error) {
        console.error('[QUESTION] ❌ 保存题目列表到 IndexedDB 失败:', error)
      }
    }
  }
  
  /**
   * 题目去重算法
   * 使用 Map 实现高效去重
   */
  const deduplicateQuestions = (questionList: ExerciseItem[]): ExerciseItem[] => {
    const uniqueMap = new Map<string, ExerciseItem>()
    
    for (const question of questionList) {
      if (question.title && !uniqueMap.has(question.title)) {
        uniqueMap.set(question.title, question)
      }
    }
    
    return Array.from(uniqueMap.values())
  }
  
  /**
   * 清空当前选中的题目
   * 用于离开练习页面时重置状态
   */
  const clearCurrentQuestion = (): void => {
    currentQuestionIndex.value = -1
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
    fetchAllSubjectsQuestions,
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


/**
 * 题目管理 Store
 * 使用 Zustand 实现状态管理
 * 职责：管理题目列表、题目选择、相似题目
 */

import { create } from 'zustand'
import { apiService } from '../services/apiService'
import { StorageService } from '../services/storageService'
import type { ExerciseItem } from '../types/exercise'

interface QuestionState {
  // 状态定义
  questions: ExerciseItem[]
  similarQuestions: ExerciseItem[]
  currentQuestionIndex: number
  isLoading: boolean
  
  // 方法定义
  fetchQuestions: (subject?: string, useLocalFirst?: boolean) => Promise<void>
  selectQuestion: (index: number) => Promise<void>
  deleteQuestion: (questionId: string, subject?: string) => Promise<void>
  moveQuestionToTop: (questionId: string) => void
  setQuestions: (newQuestions: ExerciseItem[], subject?: string) => Promise<void>
  
  // 计算属性（通过 getter 实现）
  getCurrentQuestion: () => ExerciseItem | null
  getHasQuestions: () => boolean
}

/**
 * 题目管理 Store
 * 使用 Zustand 创建，支持持久化
 */
export const useQuestionStore = create<QuestionState>((set, get) => ({
  // 初始状态
  questions: [], // 题目列表
  similarQuestions: [], // 相似题目列表
  currentQuestionIndex: -1, // 当前题目索引
  isLoading: false, // 加载状态

  /**
   * 获取题目列表
   * 第1步：尝试从本地存储加载
   * 第2步：如果本地没有数据，调用API获取题目
   * 第3步：保存到本地存储
   * 第4步：去重并更新状态
   */
  fetchQuestions: async (subject: string = 'math', useLocalFirst: boolean = true) => {
    const fetchStartTime = Date.now()
    
    set({ isLoading: true })
    
    try {
      // 第1步：优先从本地存储加载
      if (useLocalFirst) {
        try {
          const storedKey = `questions_${subject}`
          const storedQuestions = await StorageService.getItem<ExerciseItem[]>(storedKey)
          
          if (storedQuestions && Array.isArray(storedQuestions) && storedQuestions.length > 0) {
            set({ 
              questions: deduplicateQuestions(storedQuestions),
              isLoading: false 
            })
            return
          }
        } catch (error) {
          console.error('[QUESTION] ❌ 从本地存储加载失败:', error)
        }
      }
      
      // 第2步：从API获取题目
      const questionList = await apiService.getExerciseList(subject)
      
      // 转换 API 响应的 ExerciseItem 类型
      const convertedQuestions: ExerciseItem[] = questionList.map((q: any) => ({
        id: q.id || q.bmNo || '',
        bmNo: q.bmNo || q.id || '',
        title: q.title || '',
        question: q.content || q.question || q.title || '',
        answer: q.answer || '',
        explanation: q.explanation || '',
        analysisData: q.analysisData || '',
        subject: q.subject || subject.toLowerCase(),
      }))
      
      // 第3步：去重并更新状态
      const uniqueQuestions = deduplicateQuestions(convertedQuestions)
      set({ questions: uniqueQuestions, isLoading: false })
      
      // 第4步：保存到本地存储
      try {
        const storedKey = `questions_${subject}`
        await StorageService.setItem(storedKey, uniqueQuestions)
      } catch (error) {
        console.error('[QUESTION] ❌ 保存题目列表到本地存储失败:', error)
      }
    } catch (error) {
      console.error('[QUESTION] ❌ 获取题目失败:', error)
      set({ isLoading: false })
      throw error
    }
  },

  /**
   * 选择题目
   * 第1步：更新当前题目索引
   * 第2步：标记题目为已查看
   */
  selectQuestion: async (index: number) => {
    const { questions } = get()
    
    if (index < 0 || index >= questions.length) {
      console.error('[QUESTION] ❌ 无效的题目索引:', index)
      return
    }
    
    set({ currentQuestionIndex: index })
  },

  /**
   * 删除题目
   * @param questionId 题目ID
   * @param subject 科目类型（可选，用于保存到本地存储）
   */
  deleteQuestion: async (questionId: string, subject?: string) => {
    const { questions } = get()
    const question = questions.find(q => q.id === questionId || q.bmNo === questionId)
    
    if (!question) {
      console.error('[QUESTION] ❌ 找不到题目:', questionId)
      return
    }
    
    // 调用 API 删除
    const targetSubject = subject || question.subject || 'math'
    const success = await apiService.deleteExercise(questionId, targetSubject)
    
    if (success) {
      // 从列表中移除
      const newQuestions = questions.filter(q => q.id !== questionId && q.bmNo !== questionId)
      const currentIndex = get().currentQuestionIndex
      
      // 更新索引
      let newIndex = currentIndex
      if (currentIndex >= 0) {
        const removedIndex = questions.findIndex(q => q.id === questionId || q.bmNo === questionId)
        if (removedIndex >= 0) {
          if (removedIndex === currentIndex) {
            newIndex = -1
          } else if (removedIndex < currentIndex) {
            newIndex = currentIndex - 1
          }
        }
      }
      
      set({ questions: newQuestions, currentQuestionIndex: newIndex })
      
      // 保存到本地存储
      if (subject || question.subject) {
        const storedKey = `questions_${targetSubject}`
        await StorageService.setItem(storedKey, newQuestions)
      }
    }
  },

  /**
   * 移动题目到顶部
   */
  moveQuestionToTop: (questionId: string) => {
    const { questions, currentQuestionIndex } = get()
    const index = questions.findIndex(q => q.id === questionId || q.bmNo === questionId)
    
    if (index <= 0) return
    
    const question = questions[index]
    const newQuestions = [...questions]
    newQuestions.splice(index, 1)
    newQuestions.unshift(question)
    
    // 更新索引
    let newIndex = currentQuestionIndex
    if (currentQuestionIndex === index) {
      newIndex = 0
    } else if (currentQuestionIndex < index) {
      newIndex = currentQuestionIndex + 1
    }
    
    set({ questions: newQuestions, currentQuestionIndex: newIndex })
  },

  /**
   * 设置题目列表
   * @param newQuestions 新的题目列表
   * @param subject 科目类型（可选，用于保存到本地存储）
   */
  setQuestions: async (newQuestions: ExerciseItem[], subject?: string) => {
    const uniqueQuestions = deduplicateQuestions(newQuestions)
    set({ questions: uniqueQuestions })
    
    // 保存到本地存储
    if (subject) {
      const storedKey = `questions_${subject}`
      await StorageService.setItem(storedKey, uniqueQuestions)
    }
  },

  /**
   * 获取当前选中的题目
   */
  getCurrentQuestion: () => {
    const { questions, currentQuestionIndex } = get()
    if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
      return questions[currentQuestionIndex]
    }
    return null
  },

  /**
   * 是否有题目数据
   */
  getHasQuestions: () => {
    return get().questions.length > 0
  },
}))

/**
 * 题目去重算法
 * 使用 Map 实现高效去重
 */
function deduplicateQuestions(questionList: ExerciseItem[]): ExerciseItem[] {
  const uniqueMap = new Map<string, ExerciseItem>()
  
  for (const question of questionList) {
    const key = question.id || question.bmNo || question.title
    if (key && !uniqueMap.has(key)) {
      uniqueMap.set(key, question)
    }
  }
  
  return Array.from(uniqueMap.values())
}


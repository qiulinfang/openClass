/**
 * 作业管理 Store
 * 职责：管理作业列表、作业选择
 * 与 questionStore 结构类似，但数据来源和持久化 key 不同
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ExerciseItem, HomeworkUndoItem } from '../types'
import { saveQuestionsToIndexedDB } from '../services/storage/question-storage'
import { saveHomeworkSubmission, loadHomeworkSubmission } from '../services/storage/homework-storage'
import { showMessage } from '@/utils'
import { apiService } from '@/services/http/api-service'

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

  /** 当前作业是否允许重复提交：'0' 不允许，'1' 允许 */
  const resubmitType = ref('0')

  /** 每道题的作答数据缓存：key = 题目唯一标识，value = DrawingBoard.saveData() 返回的数据 */
  const answerDataCache = ref<Record<string, unknown>>({})
  
  /** 作业列表缓存：key = 查询条件，value = 作业列表数据 */
  const homeworkListCache = ref(new Map<string, HomeworkUndoItem[]>())
  
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
   * 设置当前作业的重复提交类型
   */
  const setResubmitType = (type: string): void => {
    resubmitType.value = type
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
  
  /**
   * 获取作业列表（带缓存）
   * @param params 查询参数
   * @param forceRefresh 是否强制刷新（忽略缓存）
   * @returns 作业列表
   */
  const fetchHomeworkList = async (params: {
    pageNumber: number
    pageSize: number
    subject?: string
    date?: string
  }, forceRefresh: boolean = false): Promise<HomeworkUndoItem[]> => {
    // 生成缓存键
    const cacheKey = `${params.date || ''}_${params.subject || ''}_${params.pageNumber}_${params.pageSize}`
    
    // 检查缓存（除非强制刷新）
    if (!forceRefresh && homeworkListCache.value.has(cacheKey)) {
      console.log('[HOMEWORK] 📦 从缓存获取作业列表', { cacheKey })
      return homeworkListCache.value.get(cacheKey)!
    }
    
    try {
      console.log('[HOMEWORK] 🌐 请求作业列表', { params, forceRefresh })
      const result = await apiService.getHomeworkUndoList(params)
      
      // 缓存结果
      homeworkListCache.value.set(cacheKey, result)
      console.log('[HOMEWORK] 💾 缓存作业列表', { cacheKey, count: result.length })
      
      return result
    } catch (error) {
      console.error('[HOMEWORK] ❌ 获取作业列表失败:', error)
      throw error
    }
  }
  
  /**
   * 清空作业列表缓存
   */
  const clearHomeworkListCache = (): void => {
    homeworkListCache.value.clear()
    console.log('[HOMEWORK] 🗑️ 已清空作业列表缓存')
  }

  /**
   * 保存当前作业的所有内容到 IndexedDB
   */
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
      console.log('[HOMEWORK] 💾 已持久化作业提交数据', { homeworkId, isSubmitted })
    } catch (error) {
      console.error('[HOMEWORK] ❌ 持久化作业提交数据失败:', error)
    }
  }

  /**
   * 从 IndexedDB 加载指定作业的内容
   */
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
        console.log('[HOMEWORK] 📦 已从 IndexedDB 加载作业数据', { homeworkId })
        return { isSubmitted: data.isSubmitted }
      }
    } catch (error) {
      console.error('[HOMEWORK] ❌ 从 IndexedDB 加载作业数据失败:', error)
    }
    return null
  }
  
  /**
   * 清空指定条件的作业列表缓存
   * @param date 日期
   * @param subject 学科
   */
  const clearHomeworkListCacheByCondition = (date?: string, subject?: string): void => {
    const keysToDelete: string[] = []
    
    for (const key of homeworkListCache.value.keys()) {
      const [cachedDate, cachedSubject] = key.split('_')
      const shouldDelete = 
        (!date || cachedDate === date) && 
        (!subject || cachedSubject === subject)
      
      if (shouldDelete) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => homeworkListCache.value.delete(key))
    console.log('[HOMEWORK] 🗑️ 已清空指定条件的缓存', { date, subject, deletedCount: keysToDelete.length })
  }
  
  /**
   * 重置作业作答相关状态
   */
  const resetAnswerState = (): void => {
    questions.value = []
    currentQuestionIndex.value = -1
    homeworkName.value = ''
    resubmitType.value = '0'
    answerDataCache.value = {}
    console.log('[HOMEWORK] 🧹 已重置作业作答状态')
  }
  
  // ==================== 返回接口 ====================
  
  return {
    // 状态
    questions,
    currentQuestionIndex,
    homeworkName,
    resubmitType,
    answerDataCache,
    homeworkListCache,
    
    // 计算属性
    currentQuestion,
    hasQuestions,
    
    // 方法
    selectQuestion,
    setHomeworkName,
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

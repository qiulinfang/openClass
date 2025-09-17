/**
 * 习题查找页面状态管理
 * 对应Android FindExerciseActivity的功能
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiService } from '../services/api-service'
import type { 
  ExerciseItem, 
  FindSimilarQuestionByKnowledgeRequest, 
  AddQuestionRequest, 
  FindExerciseConfig 
} from '../types'
import { Subject } from '../types'

export const useFindExerciseStore = defineStore('findExercise', () => {
  // ==================== 响应式状态定义 ====================
  
  /** 配置信息 */
  const config = ref<FindExerciseConfig | null>(null)
  
  /** 加载状态 */
  const isLoading = ref(false)
  
  /** 用户收藏的题目列表 */
  const questionsInFavor = ref<ExerciseItem[]>([])
  
  /** 相似题目列表 */
  const similarQuestions = ref<ExerciseItem[]>([])
  
  /** 分页信息 */
  const pagination = ref({
    currentPage: 0,
    pageSize: 5,
    totalCount: 0
  })
  
  /** 选中的题目ID列表 */
  const selectedQuestionIds = ref<string[]>([])
  
  // ==================== 计算属性 ====================
  
  /** 是否有选中的题目 */
  const hasSelectedQuestions = computed(() => {
    // 包括手动选中的题目和已收藏的题目
    const manuallySelected = selectedQuestionIds.value.length > 0
    const favoritedQuestions = similarQuestions.value.some(q => q.atUserList)
    return manuallySelected || favoritedQuestions
  })
  
  /** 选中的题目列表 */
  const selectedQuestions = computed(() => 
    similarQuestions.value.filter(q => 
      selectedQuestionIds.value.includes(q.bmNo) || q.atUserList
    )
  )
  
  // ==================== 方法定义 ====================
  
  /**
   * 初始化store
   * 对应Android中的initData方法
   */
  const initializeStore = async (newConfig: FindExerciseConfig) => {
    // 初始化应用配置（包括设置基础URL）
    const { initializeAppConfig } = await import('../utils/config/config-utils')
    await initializeAppConfig(newConfig)
    
    config.value = newConfig
    pagination.value.currentPage = 0
    
    // 创建API服务实例
    ApiService.getInstance()
  }
  
  /**
   * 获取题目列表
   * 对应Android中的fetchQuestionList方法
   */
  const fetchQuestionList = async () => {
    if (!config.value) return
    
    try {
      // 设置加载状态，避免显示空状态
      isLoading.value = true
      const apiService = ApiService.getInstance()
      
      // 获取用户收藏的题目列表
      const subjectName = config.value.subject === Subject.SUBJECT_MATH ? 'math' : 'biology'
      const questions = await apiService.getExerciseList(subjectName)
      questionsInFavor.value = questions
      
      // 自动查找相似题目
      await findSimilarQuestions()
    } catch (error) {
      console.error('获取题目列表失败:', error)
      // 静默处理错误
    } finally {
      // 确保加载状态被正确清除
      isLoading.value = false
    }
  }
  
  /**
   * 查找相似题目（内部方法，不设置加载状态）
   * 对应Android中的findSimilarKnowledgeQuestion方法
   */
  const findSimilarQuestions = async () => {
    if (!config.value) return
    
    try {
      // 不设置加载状态，因为调用方已经设置了
      const apiService = ApiService.getInstance()
      
      // 构建请求参数 - 去重 exercisesId
      const uniqueExerciseIds = [...new Set(questionsInFavor.value.map(q => q.bmNo).filter(id => id))].join(',')
      
      // 参数验证
      if (!config.value.knowledgeList || config.value.knowledgeList.trim() === '') {
        console.error('知识点列表不能为空')
        return
      }
      
      if (!uniqueExerciseIds || uniqueExerciseIds.trim() === '') {
        console.error('习题ID列表不能为空')
        return
      }
      
      const request: FindSimilarQuestionByKnowledgeRequest = {
        knowledgeNo: config.value.knowledgeList,
        exercisesId: uniqueExerciseIds,
        type: config.value.subject === Subject.SUBJECT_MATH ? 'math' : 'biology',
        size: Math.max(1, pagination.value.pageSize),        // 确保size至少为1
        current: Math.max(1, pagination.value.currentPage + 1)  // 确保current至少为1
      }
      
      // 调试日志：打印请求参数
      console.log('🔍 查找相似题目请求参数:', JSON.stringify(request, null, 2))
      
      // 调用API查找相似题目
      const questions = await apiService.findSimilarQuestionsByKnowledge(request)
      
      // 标记题目是否已在用户列表中
      questions.forEach(question => {
        question.atUserList = questionsInFavor.value.some(fav => fav.bmNo === question.bmNo)
      })
      
      // 如果是第一页，清空现有列表；否则追加
      if (pagination.value.currentPage === 0) {
        similarQuestions.value = questions
      } else {
        similarQuestions.value.push(...questions)
      }
      
      pagination.value.currentPage = request.current - 1  // 修复：current 是1-based，需要转换为0-based
    } catch (error) {
      console.error('查找相似题目失败:', error)
      // 静默处理错误
    }
  }

  /**
   * 查找相似题目（公开方法，设置加载状态）
   * 用于独立的相似题目查找操作
   */
  const findSimilarQuestionsWithLoading = async () => {
    if (!config.value) return
    
    try {
      // 设置加载状态
      isLoading.value = true
      await findSimilarQuestions()
    } catch (error) {
      console.error('查找相似题目失败:', error)
    } finally {
      // 确保加载状态被正确清除
      isLoading.value = false
    }
  }
  
  /**
   * 切换题目选中状态
   */
  const toggleQuestionSelection = (questionId: string) => {
    const index = selectedQuestionIds.value.indexOf(questionId)
    if (index > -1) {
      selectedQuestionIds.value.splice(index, 1)
    } else {
      selectedQuestionIds.value.push(questionId)
    }
  }
  
  /**
   * 全选/取消全选
   */
  const toggleSelectAll = () => {
    // 获取可选择的题目（排除已在用户列表中的题目）
    const selectableQuestions = similarQuestions.value.filter(q => !q.atUserList)
    
    // 检查是否所有可选择的题目都已选中
    const allSelectableSelected = selectableQuestions.every(q => selectedQuestionIds.value.includes(q.bmNo))
    
    if (allSelectableSelected) {
      // 如果所有可选择的题目都已选中，则取消全选
      selectedQuestionIds.value = []
    } else {
      // 否则全选所有可选择的题目
      selectedQuestionIds.value = selectableQuestions.map(q => q.bmNo)
    }
  }
  
  /**
   * 添加选中的题目到练习列表
   * 对应Android中的addSelectedQuestionToList方法
   */
  const addSelectedQuestionsToList = async (): Promise<boolean> => {
    if (!config.value) {
      return false
    }
    
    // 获取所有需要添加的题目ID（包括手动选中的和已收藏的）
    const manuallySelectedIds = selectedQuestionIds.value.filter(id => id)
    const favoritedIds = similarQuestions.value
      .filter(q => q.atUserList)
      .map(q => q.bmNo)  // 修复：使用bmNo而不是id
      .filter(id => id)
    
    const allSelectedIds = [...manuallySelectedIds, ...favoritedIds]
    
    if (allSelectedIds.length === 0) {
      return false
    }
    
    try {
      // 不设置全局加载状态，避免显示"正在查找相似题目..."
      const apiService = ApiService.getInstance()
      
      // 构建请求参数 - 去重 ID 列表
      const uniqueSelectedIds = [...new Set(allSelectedIds)].join(',')
      const uniqueExerciseIds = [...new Set(questionsInFavor.value.map(q => q.bmNo).filter(id => id))].join(',')
      
      const request: AddQuestionRequest = {
        bmNo: uniqueSelectedIds,
        type: config.value.subject === Subject.SUBJECT_MATH ? 'math' : 'biology',
        exercisesId: uniqueExerciseIds
      }
      
      // 调用API添加题目
      const subjectName = config.value.subject === Subject.SUBJECT_MATH ? 'math' : 'biology'
      const success = await apiService.addQuestionToList(request, subjectName)
      
      if (success) {
        // 将成功添加的题目标记为已添加到练习列表
        // 不清空选中状态，保持用户的选择
        console.log('题目已成功添加到练习列表，保持选中状态')
      }
      
      return success
    } catch (error) {
      console.error('添加题目失败:', error)
      return false
    }
  }
  
  /**
   * 重置状态
   */
  const resetState = () => {
    questionsInFavor.value = []
    similarQuestions.value = []
    selectedQuestionIds.value = []
    pagination.value = {
      currentPage: 0,
      pageSize: 5,
      totalCount: 0
    }
  }
  
  /**
   * 部分重置状态（保留选中状态）
   * 用于从练习页面返回时保持用户的选择
   */
  const partialResetState = () => {
    // 只重置题目列表，保留选中状态
    questionsInFavor.value = []
    similarQuestions.value = []
    pagination.value = {
      currentPage: 0,
      pageSize: 5,
      totalCount: 0
    }
    // 注意：不重置 selectedQuestionIds.value
  }
  
  return {
    // 状态
    config,
    isLoading,
    questionsInFavor,
    similarQuestions,
    pagination,
    selectedQuestionIds,
    
    // 计算属性
    hasSelectedQuestions,
    selectedQuestions,
    
    // 方法
    initializeStore,
    fetchQuestionList,
    findSimilarQuestions: findSimilarQuestionsWithLoading, // 使用带加载状态的方法
    toggleQuestionSelection,
    toggleSelectAll,
    addSelectedQuestionsToList,
    resetState,
    partialResetState
  }
})

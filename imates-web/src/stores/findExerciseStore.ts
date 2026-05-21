/**
 * 习题查找页面状态管理
 * 对应Android FindExerciseActivity的功能
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiService } from '../services/http/api-service'
import type {
  ExerciseItem,
  FindSimilarQuestionByKnowledgeRequest,
  AddQuestionRequest,
  FindExerciseConfig
} from '../types'

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
    pageSize: 10,
    totalCount: 0
  })
  
  /** 是否遇到空页面（用于防止无限加载） */
  const hasEmptyPage = ref(false)
  
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
    config.value = newConfig
    pagination.value.currentPage = 0
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
      const subjectName = (config.value.subject || 'math').toString()
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
      
      const bmNoList = (config.value.bmNoList || '').trim()
      const knowledgeList = (config.value.knowledgeList || '').trim()
      const type = (config.value.subject || 'math').toString()
      const size = Math.max(1, pagination.value.pageSize)
      const current = Math.max(1, pagination.value.currentPage + 1)
      
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
          question.atUserList = questionsInFavor.value.some(fav => fav.bmNo === question.bmNo)
        })
        
        pagination.value.totalCount = result.totalCount
        pagination.value.pageSize = result.pageSize
        
        if (result.questions.length === 0 && pagination.value.currentPage > 0) {
          hasEmptyPage.value = true
        }
        
        if (pagination.value.currentPage === 0) {
          similarQuestions.value = result.questions
          hasEmptyPage.value = false
        } else {
          similarQuestions.value.push(...result.questions)
        }
        
        pagination.value.currentPage = result.currentPage - 1
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
      
      // 标记题目是否已在用户列表中
      result.questions.forEach(question => {
        question.atUserList = questionsInFavor.value.some(fav => fav.bmNo === question.bmNo)
      })
      
      // 更新分页信息
      pagination.value.totalCount = result.totalCount
      pagination.value.pageSize = result.pageSize
      
      // 检测是否遇到空页面
      if (result.questions.length === 0 && pagination.value.currentPage > 0) {
        hasEmptyPage.value = true
      }
      
      // 如果是第一页，清空现有列表；否则追加
      if (pagination.value.currentPage === 0) {
        similarQuestions.value = result.questions
        hasEmptyPage.value = false  // 重置空页面状态
      } else {
        similarQuestions.value.push(...result.questions)
      }
      
      pagination.value.currentPage = result.currentPage - 1  // 修复：current 是1-based，需要转换为0-based
    } catch (error) {
      console.error('查找相似题目失败:', error)
      // 静默处理错误
    }
  }

  /**
   * 加载更多题目（分页加载）
   * 对应Android中的上拉加载更多功能
   */
  const loadMoreQuestions = async (): Promise<boolean> => {
    if (!config.value) return false
    
    // 检查是否遇到空页面
    if (hasEmptyPage.value) {
      return false
    }
    
    // 检查是否还有更多数据
    if (similarQuestions.value.length >= pagination.value.totalCount) {
      return false
    }
    
    try {
      // 设置加载更多状态
      isLoading.value = true
      
      // 增加页码
      pagination.value.currentPage += 1
      
      // 调用API获取下一页数据
      await findSimilarQuestions()
      return true
    } catch (error) {
      console.error('加载更多题目失败:', error)
      // 如果加载失败，回退页码
      if (pagination.value.currentPage > 0) {
        pagination.value.currentPage -= 1
      }
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 检查是否可以加载更多
   */
  const canLoadMore = computed(() => {
    // 如果遇到空页面，则不能加载更多
    if (hasEmptyPage.value) {
      return false
    }
    // 如果已加载的题目数量达到总数，则不能加载更多
    return similarQuestions.value.length < pagination.value.totalCount
  })

  /**
   * 重置分页状态
   */
  const resetPagination = () => {
    pagination.value.currentPage = 0
    pagination.value.totalCount = 0
    hasEmptyPage.value = false
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
      console.error('[findExerciseStore] 配置为空，无法添加题目')
      return false
    }
    
    // 获取所有需要添加的题目ID（只包括手动选中的，不包括已收藏的）
    // 已收藏的题目已经在列表中，不需要再次添加
    const manuallySelectedIds = selectedQuestionIds.value.filter(id => id)
    
    if (manuallySelectedIds.length === 0) {
      console.warn('[findExerciseStore] 没有手动选中的题目需要添加')
      return false
    }
    
    try {
      // 不设置全局加载状态，避免显示"正在查找相似题目..."
      const apiService = ApiService.getInstance()

      const subjectName = (config.value.subject || 'math').toString()
      
      // 构建请求参数 - 去重 ID 列表
      const uniqueSelectedIds = [...new Set(manuallySelectedIds)].join(',')
      const uniqueExerciseIds = [...new Set(questionsInFavor.value.map(q => q.bmNo).filter(id => id))].join(',')
      const request: AddQuestionRequest = {
        bmNo: uniqueSelectedIds,
        type: subjectName,
        exercisesId: uniqueExerciseIds
      }
      
      // 调用API添加题目
      const response = await apiService.addQuestionToList(request, subjectName)
      
      if (response.success) {
      } else {
        console.error('[findExerciseStore] ❌ 添加题目失败，API返回失败:', response.message)
      }
      
      return response.success
    } catch (error) {
      console.error('[findExerciseStore] ❌ 添加题目失败，发生异常:', error)
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
      pageSize: 10,
      totalCount: 0
    }
    hasEmptyPage.value = false
  }
  
  /**
   * 部分重置状态（保留选中状态）
   * 用于从练习页面返回时保持用户的选择
   */
  const partialResetState = () => {
    // 只重置题目列表，保留选中状态
    questionsInFavor.value = []
    similarQuestions.value = []
    resetPagination()  // 这会重置 hasEmptyPage.value
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
    hasEmptyPage,
    
    // 计算属性
    hasSelectedQuestions,
    selectedQuestions,
    canLoadMore,
    
    // 方法
    initializeStore,
    fetchQuestionList,
    findSimilarQuestions: findSimilarQuestionsWithLoading, // 使用带加载状态的方法
    loadMoreQuestions,
    toggleQuestionSelection,
    toggleSelectAll,
    addSelectedQuestionsToList,
    resetState,
    partialResetState,
    resetPagination
  }
})

/**
 * 错题管理 Store
 * 职责：管理错题列表、错题选择、持久化同步
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ExerciseItem } from '../types'
import { 
  getAllMistakes, 
  deleteMistake as deleteMistakeFromDB, 
  type MistakeItem 
} from '../services/storage/mistake-storage'
import { showMessage } from '@/utils'
import { useRouter } from 'vue-router'
import { normalizeSubject } from '@/constants/subjects'
import { watch } from 'vue'

export const useMistakeStore = defineStore('mistake', () => {
  const router = useRouter()

  // ==================== 状态定义 ====================
  
  /** 原始错题列表 */
  const mistakes = ref<MistakeItem[]>([])
  
  /** 当前选中的错题 bmNo */
  const currentMistakeBmNo = ref<string | null>(null)

  /** 当前选中的错题在过滤后列表中的索引 */
  const currentMistakeIndex = computed(() => {
    return filteredMistakes.value.findIndex(m => m.bmNo === currentMistakeBmNo.value)
  })
  
  /** 加载状态 */
  const isLoading = ref(false)

  /** 过滤器状态 */
  const filters = ref({
    subject: '全部学科',
    source: '全部来源'
  })

  // ==================== 计算属性 ====================
  
  /** 过滤后的错题列表 */
  const filteredMistakes = computed(() => {
    return mistakes.value.filter(item => {
      // 1. 学科过滤
      if (filters.value.subject !== '全部学科') {
        const itemSubject = normalizeSubject(item.questionData.subject)
        const filterSubject = normalizeSubject(filters.value.subject)
        if (itemSubject !== filterSubject) return false
      }
      
      // 2. 来源过滤
      if (filters.value.source !== '全部来源') {
        const hasHomework = (item.practiceHistory || []).some(h => h.homeworkId)
        if (filters.value.source === '随堂练习' && hasHomework) return false
        if (filters.value.source === '课后作业' && !hasHomework) return false
      }
      
      return true
    })
  })

  /** 纯题目列表（用于 QuestionList 展示） */
  const questions = computed(() => filteredMistakes.value.map(m => m.questionData))
  
  /** 当前选中的错题元数据 */
  const currentMistake = computed(() => {
    return mistakes.value.find(m => m.bmNo === currentMistakeBmNo.value) || null
  })

  /** 当前选中的题目详情 */
  const currentQuestion = computed(() => currentMistake.value?.questionData || null)
  
  /** 是否有错题数据 */
  const hasQuestions = computed(() => filteredMistakes.value.length > 0)

  // 监听过滤列表变化，如果当前选中的题目不在过滤后的列表中，则默认选中第一项
  watch(filteredMistakes, (newList) => {
    if (newList.length > 0) {
      const isCurrentInList = newList.some(m => m.bmNo === currentMistakeBmNo.value)
      if (!isCurrentInList) {
        currentMistakeBmNo.value = newList[0].bmNo
      }
    } else {
      currentMistakeBmNo.value = null
    }
  })

  // ==================== 方法 ====================

  /**
   * 从 IndexedDB 加载错题列表
   */
  const fetchMistakes = async (): Promise<void> => {
    try {
      isLoading.value = true
      const loadedMistakes = await getAllMistakes()
      mistakes.value = loadedMistakes
      
      // 默认选中第一道题
      if (loadedMistakes.length > 0 && !currentMistakeBmNo.value) {
        currentMistakeBmNo.value = loadedMistakes[0].bmNo
      }
    } catch (error) {
      console.error('[MISTAKE_STORE] ❌ 获取错题列表失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 选择错题
   */
  const selectMistake = (index: number): void => {
    const target = filteredMistakes.value[index]
    if (target) {
      currentMistakeBmNo.value = target.bmNo
    }
  }

  /**
   * 根据 bmNo 选择错题
   */
  const selectMistakeByBmNo = (bmNo: string): void => {
    currentMistakeBmNo.value = bmNo
  }

  /**
   * 删除错题
   */
  const deleteMistake = async (index: number): Promise<void> => {
    const target = filteredMistakes.value[index]
    if (!target) return

    try {
      await deleteMistakeFromDB(target.bmNo)
      
      const originalIndex = mistakes.value.findIndex(m => m.bmNo === target.bmNo)
      if (originalIndex !== -1) {
        mistakes.value.splice(originalIndex, 1)
      }
      
      if (currentMistakeBmNo.value === target.bmNo) {
        const next = filteredMistakes.value[index] || filteredMistakes.value[index - 1]
        currentMistakeBmNo.value = next ? next.bmNo : null
      }
      
      showMessage('已从错题本移除', 'success')
    } catch (error) {
      console.error('[MISTAKE_STORE] ❌ 删除错题失败:', error)
      showMessage('移除失败', 'error')
    }
  }

  /** 溯源跳转：跳转到作业详情页 */
  const jumpToSource = (homeworkId?: string) => {
    if (!homeworkId) return
    router.push({
      name: 'homeworkAnswer',
      params: { homeworkId }
    })
  }

  /**
   * 清空状态
   */
  const clearState = (): void => {
    mistakes.value = []
    currentMistakeBmNo.value = null
    isLoading.value = false
    filters.value = {
      subject: '全部学科',
      source: '全部来源'
    }
  }

  return {
    mistakes,
    currentMistakeBmNo,
    currentMistakeIndex,
    isLoading,
    filters,
    filteredMistakes,
    questions,
    currentMistake,
    currentQuestion,
    hasQuestions,
    fetchMistakes,
    selectMistake,
    selectMistakeByBmNo,
    deleteMistake,
    jumpToSource,
    clearState
  }
})

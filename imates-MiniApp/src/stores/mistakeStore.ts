import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { 
  getAllMistakes, 
  deleteMistake as deleteMistakeFromDB, 
  type MistakeItem 
} from '../services/storage/mistake-storage'
import { normalizeSubject } from '@/constants/subjects'

export const useMistakeStore = defineStore('mistake', () => {
  const mistakes = ref<MistakeItem[]>([])
  const currentMistakeBmNo = ref<string | null>(null)
  const isLoading = ref(false)
  const filters = ref({
    subject: '全部学科',
    source: '全部来源'
  })

  const currentMistakeIndex = computed(() => {
    return filteredMistakes.value.findIndex(m => m.bmNo === currentMistakeBmNo.value)
  })

  const filteredMistakes = computed(() => {
    return mistakes.value.filter(item => {
      if (filters.value.subject !== '全部学科') {
        const itemSubject = normalizeSubject(item.questionData.subject)
        const filterSubject = normalizeSubject(filters.value.subject)
        if (itemSubject !== filterSubject) return false
      }
      
      if (filters.value.source !== '全部来源') {
        const hasHomework = (item.practiceHistory || []).some(h => h.homeworkId)
        if (filters.value.source === '随堂练习' && hasHomework) return false
        if (filters.value.source === '课后作业' && !hasHomework) return false
      }
      
      return true
    })
  })

  const questions = computed(() => filteredMistakes.value.map(m => m.questionData))
  
  const currentMistake = computed(() => {
    return mistakes.value.find(m => m.bmNo === currentMistakeBmNo.value) || null
  })

  const currentQuestion = computed(() => currentMistake.value?.questionData || null)
  
  const hasQuestions = computed(() => filteredMistakes.value.length > 0)

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

  const fetchMistakes = async (): Promise<void> => {
    try {
      isLoading.value = true
      const loadedMistakes = await getAllMistakes()
      mistakes.value = loadedMistakes
      
      if (loadedMistakes.length > 0 && !currentMistakeBmNo.value) {
        currentMistakeBmNo.value = loadedMistakes[0].bmNo
      }
    } catch (error) {
      console.error('[MISTAKE_STORE] ❌ 获取错题列表失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  const selectMistake = (index: number): void => {
    const target = filteredMistakes.value[index]
    if (target) {
      currentMistakeBmNo.value = target.bmNo
    }
  }

  const selectMistakeByBmNo = (bmNo: string): void => {
    currentMistakeBmNo.value = bmNo
  }

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
      
      uni.showToast({ title: '已从错题本移除', icon: 'success' })
    } catch (error) {
      console.error('[MISTAKE_STORE] ❌ 删除错题失败:', error)
      uni.showToast({ title: '移除失败', icon: 'none' })
    }
  }

  const jumpToSource = (homeworkId?: string) => {
    if (!homeworkId) return
    uni.navigateTo({
      url: `/pages/homework/detail?homeworkId=${homeworkId}`
    })
  }

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

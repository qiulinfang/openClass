import { create } from 'zustand'
import { 
  getAllMistakes, 
  deleteMistake as deleteMistakeFromDB, 
  type MistakeItem 
} from '../services/storage/mistake-storage'
import { showMessage } from '@/utils'
import { normalizeSubject } from '@/constants/subjects'
import type { ExerciseItem } from '../types'

interface MistakeFilters {
  subject: string
  source: string
}

interface MistakeState {
  mistakes: MistakeItem[]
  currentMistakeBmNo: string | null
  isLoading: boolean
  filters: MistakeFilters

  // 计算属性逻辑
  getFilteredMistakes: () => MistakeItem[]
  getQuestions: () => ExerciseItem[]
  getCurrentMistake: () => MistakeItem | null
  getCurrentQuestion: () => ExerciseItem | null
  getCurrentMistakeIndex: () => number
  getHasQuestions: () => boolean

  // 方法
  fetchMistakes: () => Promise<void>
  selectMistake: (index: number) => void
  selectMistakeByBmNo: (bmNo: string | null) => void
  deleteMistake: (index: number) => Promise<void>
  setFilters: (filters: Partial<MistakeFilters>) => void
  jumpToSource: (homeworkId?: string) => void
  clearState: () => void
}

export const useMistakeStore = create<MistakeState>((set, get) => ({
  mistakes: [],
  currentMistakeBmNo: null,
  isLoading: false,
  filters: {
    subject: '全部学科',
    source: '全部来源'
  },

  getFilteredMistakes: () => {
    const { mistakes, filters } = get()
    return mistakes.filter(item => {
      // 1. 学科过滤
      if (filters.subject !== '全部学科') {
        const itemSubject = normalizeSubject(item.questionData.subject)
        const filterSubject = normalizeSubject(filters.subject)
        if (itemSubject !== filterSubject) return false
      }
      
      // 2. 来源过滤
      if (filters.source !== '全部来源') {
        const hasHomework = (item.practiceHistory || []).some(h => h.homeworkId)
        if (filters.source === '随堂练习' && hasHomework) return false
        if (filters.source === '课后作业' && !hasHomework) return false
      }
      
      return true
    })
  },

  getQuestions: () => {
    return get().getFilteredMistakes().map(m => m.questionData)
  },

  getCurrentMistake: () => {
    const { mistakes, currentMistakeBmNo } = get()
    return mistakes.find(m => m.bmNo === currentMistakeBmNo) || null
  },

  getCurrentQuestion: () => {
    return get().getCurrentMistake()?.questionData || null
  },

  getCurrentMistakeIndex: () => {
    const filtered = get().getFilteredMistakes()
    const { currentMistakeBmNo } = get()
    return filtered.findIndex(m => m.bmNo === currentMistakeBmNo)
  },

  getHasQuestions: () => {
    return get().getFilteredMistakes().length > 0
  },

  fetchMistakes: async () => {
    set({ isLoading: true })
    try {
      const loadedMistakes = await getAllMistakes()
      set({ mistakes: loadedMistakes })
      
      // 默认选中第一道题
      if (loadedMistakes.length > 0 && !get().currentMistakeBmNo) {
        // 考虑到可能的过滤，我们需要获取当前过滤后的第一项
        const filtered = get().getFilteredMistakes()
        if (filtered.length > 0) {
          set({ currentMistakeBmNo: filtered[0].bmNo })
        }
      }
    } catch (error) {
      console.error('[MISTAKE_STORE] ❌ 获取错题列表失败:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  selectMistake: (index: number) => {
    const filtered = get().getFilteredMistakes()
    const target = filtered[index]
    if (target) {
      set({ currentMistakeBmNo: target.bmNo })
    }
  },

  selectMistakeByBmNo: (bmNo: string | null) => {
    set({ currentMistakeBmNo: bmNo })
  },

  deleteMistake: async (index: number) => {
    const filtered = get().getFilteredMistakes()
    const target = filtered[index]
    if (!target) return

    try {
      await deleteMistakeFromDB(target.bmNo)
      
      const { mistakes, currentMistakeBmNo } = get()
      const newMistakes = mistakes.filter(m => m.bmNo !== target.bmNo)
      
      let nextBmNo = currentMistakeBmNo
      if (currentMistakeBmNo === target.bmNo) {
        const nextFiltered = filtered.filter(m => m.bmNo !== target.bmNo)
        const next = nextFiltered[index] || nextFiltered[index - 1]
        nextBmNo = next ? next.bmNo : null
      }
      
      set({ 
        mistakes: newMistakes,
        currentMistakeBmNo: nextBmNo
      })
      
      showMessage('已从错题本移除', 'success')
    } catch (error) {
      console.error('[MISTAKE_STORE] ❌ 删除错题失败:', error)
      showMessage('移除失败', 'error')
    }
  },

  setFilters: (newFilters: Partial<MistakeFilters>) => {
    const { filters } = get()
    const updatedFilters = { ...filters, ...newFilters }
    set({ filters: updatedFilters })
    
    // 过滤条件改变后，检查当前选中项是否还在列表中
    const filtered = get().getFilteredMistakes()
    const currentBmNo = get().currentMistakeBmNo
    if (filtered.length > 0) {
      const isCurrentInList = filtered.some(m => m.bmNo === currentBmNo)
      if (!isCurrentInList) {
        set({ currentMistakeBmNo: filtered[0].bmNo })
      }
    } else {
      set({ currentMistakeBmNo: null })
    }
  },

  jumpToSource: (homeworkId?: string) => {
    if (!homeworkId) return
    // 在 React 中，路由通常由组件通过 useNavigate() 调用，
    // 这里如果要在 store 中跳转，可能需要一个全局 history 对象或者通过外部注入
    // 暂时打印警告或执行 window.location（不推荐）
    console.warn('[MISTAKE_STORE] jumpToSource not fully implemented for React Router in Store')
  },

  clearState: () => {
    set({
      mistakes: [],
      currentMistakeBmNo: null,
      isLoading: false,
      filters: {
        subject: '全部学科',
        source: '全部来源'
      }
    })
  }
}))

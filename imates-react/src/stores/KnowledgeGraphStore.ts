import { create } from 'zustand'
import type { ChapterNode, TextbookOption } from '@/types'

/**
 * 章节状态接口
 */
export interface ChapterState {
  expandedGraphId: string | null  // 展开的知识图谱ID
  rotationAngle: number          // 旋转角度（度）
}

/**
 * 页面状态接口
 */
export interface PageState {
  selectedSubject: string
  selectedTextbook: string
  selectedChapterIndex: number
  selectedChapterDetails: ChapterNode | null
  chapters: string[]
  chapterStructure: ChapterNode[]
  textbookOptions?: TextbookOption[] // 教材选项列表（可选，用于向后兼容）
  timestamp: number
}

interface KnowledgeGraphState {
  // 状态数据
  states: Map<string, Map<number, ChapterState>>
  currentTextbookId: string
  currentChapterIndex: number
  pageState: PageState | null
  currentSubject: string

  // 方法
  setCurrentTextbook: (textbookId: string) => void
  setCurrentChapter: (chapterIndex: number) => void
  getCurrentTextbook: () => string
  getCurrentChapter: () => number
  getCurrentSubject: () => string
  setCurrentSubject: (subject: string) => void
  getCurrentSubjectLowercase: () => 'math' | 'biology'
  
  getChapterState: (chapterIndex: number) => ChapterState
  getChapterStateSafe: (chapterIndex: number) => ChapterState | null
  getChapterRotation: (chapterIndex: number) => number
  setChapterRotation: (chapterIndex: number, angle: number) => void
  
  getCurrentChapterExpandedGraph: () => string | null
  setCurrentChapterExpandedGraph: (graphId: string | null) => void
  
  clearTextbookStates: (textbookId: string) => void
  initializeChapterStates: (
    textbookId: string, 
    chapterData: ChapterNode[], 
    getSubChapters?: (chapter: ChapterNode) => ChapterNode[]
  ) => void
  ensureChapterState: (chapterIndex: number) => ChapterState
  
  getAllStates: () => Map<string, Map<number, ChapterState>>
  resetAllStates: () => void
  savePageState: (state: Omit<PageState, 'timestamp'>) => void
  restorePageState: () => PageState | null
  clearPageState: () => void
  hasPageState: () => boolean
}

export const useKnowledgeGraphStore = create<KnowledgeGraphState>((set, get) => {
  const getCurrentTextbookChapterStates = () => {
    const { currentTextbookId, states } = get()
    if (!states.has(currentTextbookId)) {
      states.set(currentTextbookId, new Map())
    }
    return states.get(currentTextbookId)!
  }

  return {
    // 初始状态
    states: new Map(),
    currentTextbookId: '',
    currentChapterIndex: 0,
    pageState: null,
    currentSubject: '',

    // 方法实现
    setCurrentTextbook: (textbookId) => set({ currentTextbookId: textbookId }),

    setCurrentChapter: (chapterIndex) => set({ currentChapterIndex: chapterIndex }),

    getCurrentTextbook: () => get().currentTextbookId,

    getCurrentChapter: () => get().currentChapterIndex,

    getCurrentSubject: () => {
      const { pageState, currentSubject } = get()
      if (pageState?.selectedSubject) {
        return pageState.selectedSubject
      }
      if (currentSubject) {
        return currentSubject
      }
      return 'math'
    },

    setCurrentSubject: (subject) => {
      if (!subject) return
      set({ currentSubject: subject })
    },

    getCurrentSubjectLowercase: () => {
      const subject = get().getCurrentSubject()
      if (subject.toLowerCase() === 'biology' || subject.toLowerCase() === '生物') {
        return 'biology'
      }
      return 'math'
    },

    getChapterState: (chapterIndex) => {
      const states = getCurrentTextbookChapterStates()
      if (!states.has(chapterIndex)) {
        states.set(chapterIndex, { expandedGraphId: null, rotationAngle: 0 })
      }
      return states.get(chapterIndex)!
    },

    getChapterStateSafe: (chapterIndex) => {
      const { currentTextbookId, states } = get()
      return states.get(currentTextbookId)?.get(chapterIndex) || null
    },

    getChapterRotation: (chapterIndex) => {
      const state = get().getChapterStateSafe(chapterIndex)
      return state ? state.rotationAngle : 0
    },

    setChapterRotation: (chapterIndex, angle) => {
      const states = getCurrentTextbookChapterStates()
      let chapterState = states.get(chapterIndex)
      
      if (!chapterState) {
        chapterState = { expandedGraphId: null, rotationAngle: 0 }
      }
      
      chapterState.rotationAngle = angle
      states.set(chapterIndex, { ...chapterState })
      
      // Zustand 需要返回新对象来触发更新，Map 的内容变化不会自动触发
      set((state) => ({ states: new Map(state.states) }))
    },

    getCurrentChapterExpandedGraph: () => {
      const { currentChapterIndex } = get()
      const state = get().getChapterStateSafe(currentChapterIndex)
      return state ? state.expandedGraphId : null
    },

    setCurrentChapterExpandedGraph: (graphId) => {
      const states = getCurrentTextbookChapterStates()
      const { currentChapterIndex } = get()
      let chapterState = states.get(currentChapterIndex)
      
      if (!chapterState) {
        chapterState = { expandedGraphId: null, rotationAngle: 0 }
      }
      
      chapterState.expandedGraphId = graphId
      states.set(currentChapterIndex, { ...chapterState })
      
      set((state) => ({ states: new Map(state.states) }))
    },

    clearTextbookStates: (textbookId) => {
      const { states } = get()
      if (states.has(textbookId)) {
        states.get(textbookId)!.clear()
        set({ states: new Map(states) })
      }
    },

    initializeChapterStates: (textbookId, chapterData) => {
      get().setCurrentTextbook(textbookId)
      const { states } = get()
      if (!states.has(textbookId)) {
        states.set(textbookId, new Map())
      }
      const textbookStates = states.get(textbookId)!
      
      chapterData.forEach((_, index) => {
        if (!textbookStates.has(index)) {
          textbookStates.set(index, {
            expandedGraphId: null,
            rotationAngle: 0
          })
        }
      })
      
      set({ states: new Map(states) })
    },

    ensureChapterState: (chapterIndex) => {
      return get().getChapterState(chapterIndex)
    },
getAllStates: () => get().states,

    
    resetAllStates: () => set({
      states: new Map(),
      currentTextbookId: '',
      currentChapterIndex: 0,
      pageState: null,
      currentSubject: ''
    }),

    savePageState: (state) => set({
      pageState: {
        ...state,
        timestamp: Date.now()
      }
    }),

    restorePageState: () => {
      const { pageState } = get()
      if (!pageState) return null
      
      const now = Date.now()
      const stateAge = now - pageState.timestamp
      const STATE_EXPIRE_TIME = 24 * 60 * 60 * 1000 // 24小时
      
      if (stateAge > STATE_EXPIRE_TIME) {
        set({ pageState: null })
        return null
      }
      return pageState
    },

    clearPageState: () => set({ pageState: null }),

    hasPageState: () => get().pageState !== null
  }
})

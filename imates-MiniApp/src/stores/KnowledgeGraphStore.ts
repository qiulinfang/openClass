import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChapterNode, TextbookOption } from '../types'

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
  textbookOptions?: TextbookOption[] // 教材选项列表
  timestamp: number
}

/**
 * 知识图谱状态管理
 */
export const useKnowledgeGraphStore = defineStore('knowledgeGraph', () => {
  // 各教材的各章节的状态存储
  const states = ref<Map<string, Map<number, ChapterState>>>(new Map())
  
  // 当前选中的教材ID
  const currentTextbookId = ref<string>('')
  
  // 当前选中的章节索引
  const currentChapterIndex = ref<number>(0)
  
  // 页面状态存储
  const pageState = ref<PageState | null>(null)
  
  // 当前入口设置的科目
  const currentSubject = ref<string>('')

  /**
   * 设置当前教材ID
   */
  const setCurrentTextbook = (textbookId: string) => {
    currentTextbookId.value = textbookId
  }

  /**
   * 设置当前章节索引
   */
  const setCurrentChapter = (chapterIndex: number) => {
    currentChapterIndex.value = chapterIndex
  }

  /**
   * 获取当前教材ID
   */
  const getCurrentTextbook = () => currentTextbookId.value

  /**
   * 获取当前章节索引
   */
  const getCurrentChapter = () => currentChapterIndex.value

  /**
   * 获取当前科目
   */
  const getCurrentSubject = () => {
    if (pageState.value?.selectedSubject) {
      return pageState.value.selectedSubject
    }
    if (currentSubject.value) {
      return currentSubject.value
    }
    return 'math'
  }

  /**
   * 设置当前科目
   */
  const setCurrentSubject = (subject: string) => {
    if (!subject) return
    currentSubject.value = subject
  }

  /**
   * 获取当前科目（小写）
   */
  const getCurrentSubjectLowercase = (): 'math' | 'biology' => {
    const subject = getCurrentSubject()
    if (subject.toLowerCase() === 'biology' || subject.toLowerCase() === '生物') {
      return 'biology'
    }
    return 'math'
  }

  /**
   * 获取当前教材的章节状态Map
   */
  const getCurrentTextbookChapterStates = (): Map<number, ChapterState> => {
    const textbookId = currentTextbookId.value
    if (!states.value.has(textbookId)) {
      states.value.set(textbookId, new Map())
    }
    return states.value.get(textbookId)!
  }

  /**
   * 获取指定章节的状态
   */
  const getChapterState = (chapterIndex: number): ChapterState => {
    const textbookStates = getCurrentTextbookChapterStates()
    if (!textbookStates.has(chapterIndex)) {
      textbookStates.set(chapterIndex, { expandedGraphId: null, rotationAngle: 0 })
    }
    return textbookStates.get(chapterIndex)!
  }

  /**
   * 安全获取指定章节的状态（不自动创建）
   */
  const getChapterStateSafe = (chapterIndex: number): ChapterState | null => {
    const textbookStates = getCurrentTextbookChapterStates()
    return textbookStates.get(chapterIndex) || null
  }

  /**
   * 获取旋转角度
   */
  const getChapterRotation = (chapterIndex: number): number => {
    const state = getChapterStateSafe(chapterIndex)
    return state ? state.rotationAngle : 0
  }

  /**
   * 设置旋转角度
   */
  const setChapterRotation = (chapterIndex: number, angle: number) => {
    const textbookStates = getCurrentTextbookChapterStates()
    let state = textbookStates.get(chapterIndex)
    if (!state) {
      state = { expandedGraphId: null, rotationAngle: 0 }
    }
    state.rotationAngle = angle
    textbookStates.set(chapterIndex, state)
  }

  /**
   * 获取当前章节展开状态
   */
  const getCurrentChapterExpandedGraph = (): string | null => {
    const state = getChapterStateSafe(currentChapterIndex.value)
    return state ? state.expandedGraphId : null
  }

  /**
   * 设置当前章节展开状态
   */
  const setCurrentChapterExpandedGraph = (graphId: string | null) => {
    const textbookStates = getCurrentTextbookChapterStates()
    let state = textbookStates.get(currentChapterIndex.value)
    if (!state) {
      state = { expandedGraphId: null, rotationAngle: 0 }
    }
    state.expandedGraphId = graphId
    textbookStates.set(currentChapterIndex.value, state)
  }

  /**
   * 初始化章节状态
   */
  const initializeChapterStates = (textbookId: string, chapterData: ChapterNode[]) => {
    setCurrentTextbook(textbookId)
    const textbookStates = getCurrentTextbookChapterStates()
    chapterData.forEach((_, index) => {
      if (!textbookStates.has(index)) {
        textbookStates.set(index, { expandedGraphId: null, rotationAngle: 0 })
      }
    })
  }

  /**
   * 重置所有状态
   */
  const resetAllStates = () => {
    states.value.clear()
    currentTextbookId.value = ''
    currentChapterIndex.value = 0
    pageState.value = null
    currentSubject.value = ''
  }

  /**
   * 保存页面状态
   */
  const savePageState = (state: Omit<PageState, 'timestamp'>) => {
    pageState.value = {
      ...state,
      timestamp: Date.now()
    }
  }

  /**
   * 恢复页面状态
   */
  const restorePageState = (): PageState | null => {
    if (!pageState.value) return null
    const now = Date.now()
    if (now - pageState.value.timestamp > 24 * 60 * 60 * 1000) {
      pageState.value = null
      return null
    }
    return pageState.value
  }

  return {
    currentTextbookId,
    currentChapterIndex,
    pageState,
    setCurrentTextbook,
    setCurrentChapter,
    getCurrentTextbook,
    getCurrentChapter,
    getCurrentSubject,
    setCurrentSubject,
    getCurrentSubjectLowercase,
    getChapterState,
    getChapterStateSafe,
    getChapterRotation,
    setChapterRotation,
    getCurrentChapterExpandedGraph,
    setCurrentChapterExpandedGraph,
    initializeChapterStates,
    resetAllStates,
    savePageState,
    restorePageState
  }
})

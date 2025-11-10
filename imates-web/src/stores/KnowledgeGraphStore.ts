import { ref, computed } from 'vue'
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

/**
 * 知识图谱状态管理类
 * 统一管理各教材的各章节状态，包括展开状态和旋转角度
 */
export class KnowledgeGraphStore {
  // 各教材的各章节的状态存储
  private states = ref<Map<string, Map<number, ChapterState>>>(new Map())
  
  // 当前选中的教材ID
  private currentTextbookId = ref<string>('')
  
  // 当前选中的章节索引
  private currentChapterIndex = ref<number>(0)
  
  // 页面状态存储
  private pageState = ref<PageState | null>(null)

  /**
   * 设置当前教材ID
   */
  setCurrentTextbook(textbookId: string): void {
    this.currentTextbookId.value = textbookId
  }

  /**
   * 设置当前章节索引
   */
  setCurrentChapter(chapterIndex: number): void {
    this.currentChapterIndex.value = chapterIndex
  }

  /**
   * 获取当前教材ID
   */
  getCurrentTextbook(): string {
    return this.currentTextbookId.value
  }

  /**
   * 获取当前章节索引
   */
  getCurrentChapter(): number {
    return this.currentChapterIndex.value
  }

  /**
   * 获取当前科目（从页面状态中获取）
   * @returns 科目字符串，如 'math' 或 'biology'
   */
  getCurrentSubject(): string {
    if (this.pageState.value?.selectedSubject) {
      return this.pageState.value.selectedSubject
    }
    return 'math' // 默认返回数学
  }

  /**
   * 获取当前科目（转换为小写格式）
   * @returns 科目字符串，如 'math' 或 'biology'
   */
  getCurrentSubjectLowercase(): 'math' | 'biology' {
    const subject = this.getCurrentSubject()
    // 将科目转换为小写格式
    if (subject.toLowerCase() === 'biology' || subject.toLowerCase() === '生物') {
      return 'biology'
    }
    return 'math'
  }

  /**
   * 获取当前教材的章节状态Map
   */
  private getCurrentTextbookChapterStates(): Map<number, ChapterState> {
    const textbookId = this.currentTextbookId.value
    if (!this.states.value.has(textbookId)) {
      this.states.value.set(textbookId, new Map())
    }
    return this.states.value.get(textbookId)!
  }

  /**
   * 获取指定章节的状态，如果不存在则返回默认状态
   */
  getChapterState(chapterIndex: number): ChapterState {
    const states = this.getCurrentTextbookChapterStates()
    if (!states.has(chapterIndex)) {
      // 只有在明确需要时才创建新状态，避免意外重置
      states.set(chapterIndex, { expandedGraphId: null, rotationAngle: 0 })
    }
    return states.get(chapterIndex)!
  }

  /**
   * 安全获取指定章节的状态，如果不存在则返回null（不自动创建）
   */
  getChapterStateSafe(chapterIndex: number): ChapterState | null {
    const states = this.getCurrentTextbookChapterStates()
    return states.get(chapterIndex) || null
  }

  /**
   * 获取指定章节的旋转角度
   */
  getChapterRotation(chapterIndex: number): number {
    const state = this.getChapterStateSafe(chapterIndex)
    return state ? state.rotationAngle : 0
  }

  /**
   * 设置指定章节的旋转角度
   */
  setChapterRotation(chapterIndex: number, angle: number): void {
    const states = this.getCurrentTextbookChapterStates()
    let state = states.get(chapterIndex)
    
    // 如果状态不存在，创建新状态
    if (!state) {
      state = { expandedGraphId: null, rotationAngle: 0 }
      states.set(chapterIndex, state)
    }
    
    state.rotationAngle = angle
    // 更新状态到Map中
    states.set(chapterIndex, state)
  }

  /**
   * 获取当前章节的展开状态
   */
  getCurrentChapterExpandedGraph(): string | null {
    const state = this.getChapterStateSafe(this.currentChapterIndex.value)
    return state ? state.expandedGraphId : null
  }

  /**
   * 设置当前章节的展开状态
   */
  setCurrentChapterExpandedGraph(graphId: string | null): void {
    const states = this.getCurrentTextbookChapterStates()
    let state = states.get(this.currentChapterIndex.value)
    
    // 如果状态不存在，创建新状态
    if (!state) {
      state = { expandedGraphId: null, rotationAngle: 0 }
      states.set(this.currentChapterIndex.value, state)
    }
    
    // 记录收缩日志（从非null变为null时）
    const previousGraphId = state.expandedGraphId
    if (previousGraphId !== null && graphId === null) {
      
    }
    
    state.expandedGraphId = graphId
    states.set(this.currentChapterIndex.value, state)
  }

  /**
   * 清空指定教材的所有章节状态
   */
  clearTextbookStates(textbookId: string): void {
    if (this.states.value.has(textbookId)) {
      this.states.value.get(textbookId)!.clear()
    }
  }

  /**
   * 初始化章节状态
   * @param textbookId 教材ID
   * @param chapterData 章节数据
   * @param getSubChapters 获取子章节的函数
   */
  initializeChapterStates(
    textbookId: string, 
    chapterData: ChapterNode[], 
    getSubChapters: (chapter: ChapterNode) => ChapterNode[]
  ): void {
    // 设置当前教材
    this.setCurrentTextbook(textbookId)
    
    // 为每个章节初始化状态
    chapterData.forEach((chapter, index) => {
      const states = this.getCurrentTextbookChapterStates()
      
      // 如果章节状态不存在，则初始化
      if (!states.has(index)) {
        // 初始状态下所有目录都是收起状态，不自动展开任何知识图谱
        const expandedGraphId: string | null = null
        
        // 创建章节状态
        const chapterState: ChapterState = {
          expandedGraphId,
          rotationAngle: 0
        }
        
        states.set(index, chapterState)
      } else {
      }
    })
  }

  /**
   * 确保章节状态存在（用于初始化时）
   */
  ensureChapterState(chapterIndex: number): ChapterState {
    const states = this.getCurrentTextbookChapterStates()
    if (!states.has(chapterIndex)) {
      const state: ChapterState = { expandedGraphId: null, rotationAngle: 0 }
      states.set(chapterIndex, state)
    }
    return states.get(chapterIndex)!
  }

  /**
   * 获取所有状态数据（用于调试）
   */
  getAllStates(): Map<string, Map<number, ChapterState>> {
    return this.states.value
  }

  /**
   * 重置所有状态
   */
  resetAllStates(): void {
    this.states.value.clear()
    this.currentTextbookId.value = ''
    this.currentChapterIndex.value = 0
    this.pageState.value = null
  }

  /**
   * 保存页面状态
   * @param state 页面状态数据
   */
  savePageState(state: Omit<PageState, 'timestamp'>): void {
    this.pageState.value = {
      ...state,
      timestamp: Date.now()
    }
  }

  /**
   * 恢复页面状态
   * @returns 页面状态数据，如果不存在则返回null
   */
  restorePageState(): PageState | null {
    if (!this.pageState.value) {
      return null
    }
    
    // 检查状态是否过期（24小时）
    const now = Date.now()
    const stateAge = now - this.pageState.value.timestamp
    const STATE_EXPIRE_TIME = 24 * 60 * 60 * 1000 // 24小时
    
    if (stateAge > STATE_EXPIRE_TIME) {
      this.pageState.value = null
      return null
    }
    return this.pageState.value
  }

  /**
   * 清除页面状态
   */
  clearPageState(): void {
    this.pageState.value = null
  }

  /**
   * 检查是否有保存的页面状态
   */
  hasPageState(): boolean {
    return this.pageState.value !== null
  }
}

// 创建全局单例实例
export const knowledgeGraphStore = new KnowledgeGraphStore()

// 导出响应式状态（用于模板中使用）
export const useKnowledgeGraphStore = () => {
  return {
    // 状态管理方法
    setCurrentTextbook: knowledgeGraphStore.setCurrentTextbook.bind(knowledgeGraphStore),
    setCurrentChapter: knowledgeGraphStore.setCurrentChapter.bind(knowledgeGraphStore),
    getCurrentTextbook: knowledgeGraphStore.getCurrentTextbook.bind(knowledgeGraphStore),
    getCurrentChapter: knowledgeGraphStore.getCurrentChapter.bind(knowledgeGraphStore),
    
    // 科目状态方法
    getCurrentSubject: knowledgeGraphStore.getCurrentSubject.bind(knowledgeGraphStore),
    getCurrentSubjectLowercase: knowledgeGraphStore.getCurrentSubjectLowercase.bind(knowledgeGraphStore),
    
    // 章节状态方法
    getChapterState: knowledgeGraphStore.getChapterState.bind(knowledgeGraphStore),
    getChapterStateSafe: knowledgeGraphStore.getChapterStateSafe.bind(knowledgeGraphStore),
    ensureChapterState: knowledgeGraphStore.ensureChapterState.bind(knowledgeGraphStore),
    getChapterRotation: knowledgeGraphStore.getChapterRotation.bind(knowledgeGraphStore),
    setChapterRotation: knowledgeGraphStore.setChapterRotation.bind(knowledgeGraphStore),
    
    // 展开状态方法
    getCurrentChapterExpandedGraph: knowledgeGraphStore.getCurrentChapterExpandedGraph.bind(knowledgeGraphStore),
    setCurrentChapterExpandedGraph: knowledgeGraphStore.setCurrentChapterExpandedGraph.bind(knowledgeGraphStore),
    
    // 页面状态方法
    savePageState: knowledgeGraphStore.savePageState.bind(knowledgeGraphStore),
    restorePageState: knowledgeGraphStore.restorePageState.bind(knowledgeGraphStore),
    clearPageState: knowledgeGraphStore.clearPageState.bind(knowledgeGraphStore),
    hasPageState: knowledgeGraphStore.hasPageState.bind(knowledgeGraphStore),
    
    // 工具方法
    clearTextbookStates: knowledgeGraphStore.clearTextbookStates.bind(knowledgeGraphStore),
    initializeChapterStates: knowledgeGraphStore.initializeChapterStates.bind(knowledgeGraphStore),
    resetAllStates: knowledgeGraphStore.resetAllStates.bind(knowledgeGraphStore),
    
    // 响应式状态
    currentTextbookId: computed(() => knowledgeGraphStore.getCurrentTextbook()),
    currentChapterIndex: computed(() => knowledgeGraphStore.getCurrentChapter()),
    allStates: computed(() => knowledgeGraphStore.getAllStates())
  }
}








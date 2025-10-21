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
  timestamp: number
}

/**
 * 教材章节状态管理类
 * 统一管理各教材的各章节状态，包括展开状态和旋转角度
 */
export class TextbookChapterStateManager {
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
    console.log(`设置章节 ${chapterIndex} 旋转角度: ${angle.toFixed(2)}度 (当前章节: ${this.currentChapterIndex.value})`)
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
    console.log('初始化章节状态:', textbookId, chapterData.length)
    
    // 设置当前教材
    this.setCurrentTextbook(textbookId)
    
    // 为每个章节初始化状态
    chapterData.forEach((chapter, index) => {
      const states = this.getCurrentTextbookChapterStates()
      
      // 如果章节状态不存在，则初始化
      if (!states.has(index)) {
        const subChapters = getSubChapters(chapter)
        let expandedGraphId: string | null = null
        
        if (subChapters.length > 0) {
          // 展开第一个子章节
          const firstSubChapter = subChapters[0]
          expandedGraphId = firstSubChapter.id
          console.log(`章节 ${index} 自动展开第一个知识图谱:`, firstSubChapter.id)
        } else {
          // 如果没有子章节，设置为null
          expandedGraphId = null
          console.log(`章节 ${index} 无子章节，设置为null`)
        }
        
        // 创建章节状态
        const chapterState: ChapterState = {
          expandedGraphId,
          rotationAngle: 0
        }
        
        states.set(index, chapterState)
        console.log(`📝 [状态初始化] 为章节 ${index} 创建初始状态，旋转角度: 0°`)
      } else {
        console.log(`📋 [状态检查] 章节 ${index} 状态已存在，旋转角度: ${states.get(index)!.rotationAngle.toFixed(2)}°`)
      }
    })
    
    console.log('章节状态初始化完成:', {
      states: Array.from(this.getCurrentTextbookChapterStates().entries()).map(([index, state]) => ({
        chapterIndex: index,
        expandedGraphId: state.expandedGraphId,
        rotationAngle: state.rotationAngle
      }))
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
      console.log(`📝 [状态初始化] 为章节 ${chapterIndex} 创建初始状态`)
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
    console.log('📝 [状态保存] 页面状态已保存:', this.pageState.value)
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
      console.log('⏰ [状态恢复] 页面状态已过期，清除状态')
      this.pageState.value = null
      return null
    }
    
    console.log('🔄 [状态恢复] 恢复页面状态:', this.pageState.value)
    return this.pageState.value
  }

  /**
   * 清除页面状态
   */
  clearPageState(): void {
    this.pageState.value = null
    console.log('🗑️ [状态清除] 页面状态已清除')
  }

  /**
   * 检查是否有保存的页面状态
   */
  hasPageState(): boolean {
    return this.pageState.value !== null
  }
}

// 创建全局单例实例
export const textbookChapterStateManager = new TextbookChapterStateManager()

// 导出响应式状态（用于模板中使用）
export const useTextbookChapterState = () => {
  return {
    // 状态管理方法
    setCurrentTextbook: textbookChapterStateManager.setCurrentTextbook.bind(textbookChapterStateManager),
    setCurrentChapter: textbookChapterStateManager.setCurrentChapter.bind(textbookChapterStateManager),
    getCurrentTextbook: textbookChapterStateManager.getCurrentTextbook.bind(textbookChapterStateManager),
    getCurrentChapter: textbookChapterStateManager.getCurrentChapter.bind(textbookChapterStateManager),
    
    // 章节状态方法
    getChapterState: textbookChapterStateManager.getChapterState.bind(textbookChapterStateManager),
    getChapterStateSafe: textbookChapterStateManager.getChapterStateSafe.bind(textbookChapterStateManager),
    ensureChapterState: textbookChapterStateManager.ensureChapterState.bind(textbookChapterStateManager),
    getChapterRotation: textbookChapterStateManager.getChapterRotation.bind(textbookChapterStateManager),
    setChapterRotation: textbookChapterStateManager.setChapterRotation.bind(textbookChapterStateManager),
    
    // 展开状态方法
    getCurrentChapterExpandedGraph: textbookChapterStateManager.getCurrentChapterExpandedGraph.bind(textbookChapterStateManager),
    setCurrentChapterExpandedGraph: textbookChapterStateManager.setCurrentChapterExpandedGraph.bind(textbookChapterStateManager),
    
    // 页面状态方法
    savePageState: textbookChapterStateManager.savePageState.bind(textbookChapterStateManager),
    restorePageState: textbookChapterStateManager.restorePageState.bind(textbookChapterStateManager),
    clearPageState: textbookChapterStateManager.clearPageState.bind(textbookChapterStateManager),
    hasPageState: textbookChapterStateManager.hasPageState.bind(textbookChapterStateManager),
    
    // 工具方法
    clearTextbookStates: textbookChapterStateManager.clearTextbookStates.bind(textbookChapterStateManager),
    initializeChapterStates: textbookChapterStateManager.initializeChapterStates.bind(textbookChapterStateManager),
    resetAllStates: textbookChapterStateManager.resetAllStates.bind(textbookChapterStateManager),
    
    // 响应式状态
    currentTextbookId: computed(() => textbookChapterStateManager.getCurrentTextbook()),
    currentChapterIndex: computed(() => textbookChapterStateManager.getCurrentChapter()),
    allStates: computed(() => textbookChapterStateManager.getAllStates())
  }
}

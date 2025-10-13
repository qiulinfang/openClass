import { ref, computed } from 'vue'
import type { ChapterNode } from '@/types'

/**
 * 章节状态接口
 */
export interface ChapterState {
  expandedGraphId: string | null  // 展开的知识图谱ID
  rotationAngle: number          // 旋转角度（度）
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
      states.set(chapterIndex, { expandedGraphId: null, rotationAngle: 0 })
    }
    return states.get(chapterIndex)!
  }

  /**
   * 获取指定章节的旋转角度
   */
  getChapterRotation(chapterIndex: number): number {
    return this.getChapterState(chapterIndex).rotationAngle
  }

  /**
   * 设置指定章节的旋转角度
   */
  setChapterRotation(chapterIndex: number, angle: number): void {
    const state = this.getChapterState(chapterIndex)
    state.rotationAngle = angle
    this.getCurrentTextbookChapterStates().set(chapterIndex, state)
  }

  /**
   * 获取当前章节的展开状态
   */
  getCurrentChapterExpandedGraph(): string | null {
    return this.getChapterState(this.currentChapterIndex.value).expandedGraphId
  }

  /**
   * 设置当前章节的展开状态
   */
  setCurrentChapterExpandedGraph(graphId: string | null): void {
    const state = this.getChapterState(this.currentChapterIndex.value)
    state.expandedGraphId = graphId
    this.getCurrentTextbookChapterStates().set(this.currentChapterIndex.value, state)
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
    getChapterRotation: textbookChapterStateManager.getChapterRotation.bind(textbookChapterStateManager),
    setChapterRotation: textbookChapterStateManager.setChapterRotation.bind(textbookChapterStateManager),
    
    // 展开状态方法
    getCurrentChapterExpandedGraph: textbookChapterStateManager.getCurrentChapterExpandedGraph.bind(textbookChapterStateManager),
    setCurrentChapterExpandedGraph: textbookChapterStateManager.setCurrentChapterExpandedGraph.bind(textbookChapterStateManager),
    
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

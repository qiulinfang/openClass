/**
 * 错题本策略
 * 绑定 mistakeStore，处理错题本相关逻辑
 */

import type { ExerciseItem } from '@/types'
import type { QuestionListStrategy } from '@/components/question/strategies/QuestionListStrategy'
import type { FetchQuestionsOptions, DeleteQuestionOptions } from '@/components/question/strategies/types'
import { useMistakeStore } from '@/stores/mistakeStore'

export class MistakeStrategy implements QuestionListStrategy {
  // ==================== 数据获取 ====================
  
  getQuestions(): ExerciseItem[] {
    return useMistakeStore.getState().getQuestions()
  }
  
  getCurrentQuestion(): ExerciseItem | null {
    return useMistakeStore.getState().getCurrentQuestion()
  }
  
  getCurrentQuestionIndex(): number {
    return useMistakeStore.getState().getCurrentMistakeIndex()
  }
  
  isLoading(): boolean {
    return useMistakeStore.getState().isLoading
  }
  
  hasQuestions(): boolean {
    return useMistakeStore.getState().getHasQuestions()
  }
  
  // ==================== 数据操作 ====================
  
  async fetchQuestions(options?: FetchQuestionsOptions): Promise<void> {
    // 错题本不需要学科过滤，直接拉取全部
    await useMistakeStore.getState().fetchMistakes()
  }
  
  async fetchAllSubjectsQuestions(useLocalFirst?: boolean): Promise<void> {
    await useMistakeStore.getState().fetchMistakes()
  }
  
  async selectQuestion(index: number): Promise<void> {
    useMistakeStore.getState().selectMistake(index)
  }
  
  async deleteQuestion(index: number, options?: DeleteQuestionOptions): Promise<void> {
    await useMistakeStore.getState().deleteMistake(index)
  }
  
  async setQuestions(questions: ExerciseItem[], subject?: string): Promise<void> {
    // 错题本通常不由外部直接设置，但为了兼容性保留
    return
  }
  
  async loadQuestionsFromLocal(subject: string): Promise<boolean> {
    await useMistakeStore.getState().fetchMistakes()
    return true
  }
  
  // ==================== 场景特有功能 ====================
  
  /** 错题本是否支持发送给 AI (根据业务需求确定，目前暂不支持) */
  canSendToAi(): boolean {
    return false
  }
  
  /** 错题不支持微课 */
  canOpenMiniClass(): boolean {
    return false
  }
  
  /** 错题不支持置顶 */
  canMoveToTop(): boolean {
    return false
  }
  
  /** 错题不支持收藏 (已经是错题了) */
  canFavorite(): boolean {
    return false
  }

  /** 错题支持删除 */
  canDelete(): boolean {
    return true
  }
  
  /** 错题不支持拍照搜题 */
  canPhotoSearch(): boolean {
    return false
  }
  
  // ==================== UI 文案 ====================
  
  getEmptyText(): string {
    return '错题本空空如也'
  }
  
  getNoResultText(): string {
    return '未找到匹配的错题'
  }
  
  getListTitle(): string {
    return '错题本'
  }

  cleanup(): void {
    // 离开时不需要清空，保持缓存
  }
}

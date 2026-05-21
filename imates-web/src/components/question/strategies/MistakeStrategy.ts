/**
 * 错题本策略
 * 绑定 mistakeStore，处理错题本相关逻辑
 */

import type { ExerciseItem } from '../../../types'
import type { QuestionListStrategy } from './QuestionListStrategy'
import type { FetchQuestionsOptions, DeleteQuestionOptions } from './types'
import { useMistakeStore } from '../../../stores/mistakeStore'

export class MistakeStrategy implements QuestionListStrategy {
  private store = useMistakeStore()
  
  // ==================== 数据获取 ====================
  
  getQuestions(): ExerciseItem[] {
    return this.store.questions
  }
  
  getCurrentQuestion(): ExerciseItem | null {
    return this.store.currentQuestion
  }
  
  getCurrentQuestionIndex(): number {
    return this.store.currentMistakeIndex
  }
  
  isLoading(): boolean {
    return this.store.isLoading
  }
  
  hasQuestions(): boolean {
    return this.store.hasQuestions
  }
  
  // ==================== 数据操作 ====================
  
  async fetchQuestions(options?: FetchQuestionsOptions): Promise<void> {
    // 错题本不需要学科过滤，直接拉取全部
    await this.store.fetchMistakes()
  }
  
  async fetchAllSubjectsQuestions(useLocalFirst?: boolean): Promise<void> {
    await this.store.fetchMistakes()
  }
  
  async selectQuestion(index: number): Promise<void> {
    this.store.selectMistake(index)
  }
  
  async deleteQuestion(index: number, options?: DeleteQuestionOptions): Promise<void> {
    await this.store.deleteMistake(index)
  }
  
  async setQuestions(questions: ExerciseItem[], subject?: string): Promise<void> {
    // 错题本通常不由外部直接设置，但为了兼容性保留
    return
  }
  
  async loadQuestionsFromLocal(subject: string): Promise<boolean> {
    await this.store.fetchMistakes()
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

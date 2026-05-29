/**
 * 我的习题策略
 * 绑定 questionStore，处理习题相关逻辑
 */

import type { ExerciseItem } from '@/types'
import type { QuestionListStrategy } from '@/components/question/strategies/QuestionListStrategy'
import type { FetchQuestionsOptions, DeleteQuestionOptions } from '@/components/question/strategies/types'
import { useQuestionStore } from '@/stores/questionStore'

export class MyExerciseStrategy implements QuestionListStrategy {
  // ==================== 数据获取 ====================
  
  getQuestions(): ExerciseItem[] {
    return useQuestionStore.getState().questions
  }
  
  getCurrentQuestion(): ExerciseItem | null {
    return useQuestionStore.getState().getCurrentQuestion()
  }
  
  getCurrentQuestionIndex(): number {
    return useQuestionStore.getState().currentQuestionIndex
  }
  
  isLoading(): boolean {
    return useQuestionStore.getState().isLoading
  }
  
  hasQuestions(): boolean {
    return useQuestionStore.getState().getHasQuestions()
  }
  
  // ==================== 数据操作 ====================
  
  async fetchQuestions(options?: FetchQuestionsOptions): Promise<void> {
    const subject = options?.subject || 'math'
    const useLocalFirst = options?.useLocalFirst ?? true
    await useQuestionStore.getState().fetchQuestions(subject, useLocalFirst)
  }
  
  async fetchAllSubjectsQuestions(useLocalFirst?: boolean): Promise<void> {
    await useQuestionStore.getState().fetchAllSubjectsQuestions(useLocalFirst ?? true)
  }
  
  async selectQuestion(index: number): Promise<void> {
    await useQuestionStore.getState().selectQuestion(index)
  }
  
  async deleteQuestion(index: number, options?: DeleteQuestionOptions): Promise<void> {
    await useQuestionStore.getState().deleteQuestion(index, options?.subject)
  }
  
  async setQuestions(questions: ExerciseItem[], subject?: string): Promise<void> {
    await useQuestionStore.getState().setQuestions(questions, subject)
  }
  
  async loadQuestionsFromLocal(subject: string): Promise<boolean> {
    return await useQuestionStore.getState().loadQuestionsFromLocal(subject)
  }
  
  // ==================== 场景特有功能 ====================
  
  /** 习题支持发送给 AI */
  canSendToAi(): boolean {
    return true
  }
  
  /** 习题支持微课 */
  canOpenMiniClass(): boolean {
    return true
  }
  
  /** 习题支持置顶 */
  canMoveToTop(): boolean {
    return true
  }
  
  /** 习题支持收藏 */
  canFavorite(): boolean {
    return true
  }

  /** 习题支持删除 */
  canDelete(): boolean {
    return true
  }
  
  /** 习题支持拍照搜题 */
  canPhotoSearch(): boolean {
    return true
  }
  
  // ==================== UI 文案 ====================
  
  getEmptyText(): string {
    return '暂无题目'
  }
  
  getNoResultText(): string {
    return '未找到匹配的题目'
  }
  
  getListTitle(): string {
    return '我的习题'
  }
}

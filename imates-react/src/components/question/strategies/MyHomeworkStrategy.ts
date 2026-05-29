/**
 * 我的作业策略
 * 绑定 homeworkStore，处理作业相关逻辑
 */

import type { ExerciseItem } from '@/types'
import type { QuestionListStrategy } from '@/components/question/strategies/QuestionListStrategy'
import type { FetchQuestionsOptions, DeleteQuestionOptions } from '@/components/question/strategies/types'
import { useHomeworkStore } from '@/stores/homeworkStore'

export class MyHomeworkStrategy implements QuestionListStrategy {
  // ==================== 数据获取 ====================
  
  getQuestions(): ExerciseItem[] {
    return useHomeworkStore.getState().questions
  }
  
  getCurrentQuestion(): ExerciseItem | null {
    return useHomeworkStore.getState().getCurrentQuestion()
  }
  
  getCurrentQuestionIndex(): number {
    return useHomeworkStore.getState().currentQuestionIndex
  }
  
  isLoading(): boolean {
    // homeworkStore 不再维护加载状态，固定返回 false
    return false
  }
  
  hasQuestions(): boolean {
    return useHomeworkStore.getState().getHasQuestions()
  }
  
  // ==================== 数据操作 ====================
  
  // 作业场景下题目列表由上游页面（如 MyHomeworkView）提前写入 homeworkStore
  // 这里的加载方法保持异步 no-op，仅用于满足 QuestionList 的调用约定

  async fetchQuestions(options?: FetchQuestionsOptions): Promise<void> {
    // 不主动拉取作业列表，依赖外部通过 setQuestions 写入
    return
  }
  
  async fetchAllSubjectsQuestions(useLocalFirst?: boolean): Promise<void> {
    // 不主动拉取所有学科作业
    return
  }
  
  async selectQuestion(index: number): Promise<void> {
    await useHomeworkStore.getState().selectQuestion(index)
  }
  
  async deleteQuestion(index: number, options?: DeleteQuestionOptions): Promise<void> {
    // homeworkStore 已不再提供删除接口，这里保持兼容但不做任何操作
    return
  }
  
  async setQuestions(questions: ExerciseItem[], subject?: string): Promise<void> {
    await useHomeworkStore.getState().setQuestions(questions, subject)
  }
  
  async loadQuestionsFromLocal(subject: string): Promise<boolean> {
    // 不再从本地单独加载作业列表
    return false
  }
  
  // ==================== 场景特有功能 ====================
  
  /** 作业支持发送给 AI */
  canSendToAi(): boolean {
    return true
  }
  
  /** 作业不支持微课（作业场景通常没有微课） */
  canOpenMiniClass(): boolean {
    return true
  }
  
  /** 作业不支持置顶（作业按时间排序） */
  canMoveToTop(): boolean {
    return true
  }
  
  /** 作业不支持收藏 */
  canFavorite(): boolean {
    return true
  }
  
  /** 作业支持拍照发给老师 */
  canTakePicture(): boolean {
    return false
  }
  
  /** 作业支持删除 */
  canDelete(): boolean {
    return false
  }
  
  /** 作业不支持拍照搜题（作业场景不需要） */
  canPhotoSearch(): boolean {
    return false
  }
  
  // ==================== UI 文案 ====================
  
  getEmptyText(): string {
    return '暂无作业'
  }
  
  getNoResultText(): string {
    return '未找到匹配的作业'
  }
  
  getListTitle(): string {
    return '我的作业'
  }
}

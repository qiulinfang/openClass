/**
 * QuestionList 策略接口
 * 定义题目列表组件需要的所有方法，不同场景（习题/作业）各自实现
 */

import type { ExerciseItem } from '../../../types'
import type { FetchQuestionsOptions, DeleteQuestionOptions } from './types'

export interface QuestionListStrategy {
  // ==================== 数据获取 ====================
  
  /** 获取题目列表 */
  getQuestions(): ExerciseItem[]
  
  /** 获取当前选中的题目 */
  getCurrentQuestion(): ExerciseItem | null
  
  /** 获取当前选中的题目索引 */
  getCurrentQuestionIndex(): number
  
  /** 是否正在加载 */
  isLoading(): boolean
  
  /** 是否有题目数据 */
  hasQuestions(): boolean
  
  // ==================== 数据操作 ====================
  
  /** 加载题目列表（单学科） */
  fetchQuestions(options?: FetchQuestionsOptions): Promise<void>
  
  /** 加载所有学科题目 */
  fetchAllSubjectsQuestions(useLocalFirst?: boolean): Promise<void>
  
  /** 选择题目 */
  selectQuestion(index: number): Promise<void>
  
  /** 删除题目 */
  deleteQuestion(index: number, options?: DeleteQuestionOptions): Promise<void>
  
  /** 设置题目列表 */
  setQuestions(questions: ExerciseItem[], subject?: string): Promise<void>
  
  /** 从本地加载题目 */
  loadQuestionsFromLocal(subject: string): Promise<boolean>
  
  // ==================== 场景特有功能（能力查询） ====================
  
  /** 是否支持发送给 AI */
  canSendToAi(): boolean
  
  /** 是否支持微课 */
  canOpenMiniClass(): boolean
  
  /** 是否支持置顶 */
  canMoveToTop(): boolean
  
  /** 是否支持收藏 */
  canFavorite(): boolean

  /** 是否支持删除 */
  canDelete(): boolean
  
  /** 是否支持拍照搜题 */
  canPhotoSearch(): boolean
  
  // ==================== UI 文案 ====================
  
  /** 获取空状态文案 */
  getEmptyText(): string
  
  /** 获取搜索无结果文案 */
  getNoResultText(): string
  
  /** 获取列表标题 */
  getListTitle(): string
  
  // ==================== 清理 ====================
  
  /** 清理资源（可选） */
  cleanup?(): void
}

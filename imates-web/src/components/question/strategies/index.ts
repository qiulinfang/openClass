/**
 * QuestionList 策略模式 - 导出入口
 */

export type { QuestionListStrategy } from './QuestionListStrategy'
export type { QuestionListType, FetchQuestionsOptions, DeleteQuestionOptions } from './types'

export { MyExerciseStrategy } from './MyExerciseStrategy'
export { MyHomeworkStrategy } from './MyHomeworkStrategy'

import type { QuestionListStrategy } from './QuestionListStrategy'
import type { QuestionListType } from './types'
import { MyExerciseStrategy } from './MyExerciseStrategy'
import { MyHomeworkStrategy } from './MyHomeworkStrategy'

/**
 * 根据类型创建对应的策略实例
 * @param type 题目列表类型
 * @returns 策略实例
 */
export function createQuestionListStrategy(type: QuestionListType): QuestionListStrategy {
  switch (type) {
    case 'exercise':
      return new MyExerciseStrategy()
    case 'homework':
      return new MyHomeworkStrategy()
    default:
      console.warn(`[QuestionListStrategy] 未知的类型: ${type}，使用默认的习题策略`)
      return new MyExerciseStrategy()
  }
}

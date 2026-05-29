/**
 * QuestionList 策略模式 - 导出入口
 */

export type { QuestionListStrategy } from '@/components/question/strategies/QuestionListStrategy'
export type { QuestionListType, FetchQuestionsOptions, DeleteQuestionOptions } from '@/components/question/strategies/types'

export { MyExerciseStrategy } from '@/components/question/strategies/MyExerciseStrategy'
export { MyHomeworkStrategy } from '@/components/question/strategies/MyHomeworkStrategy'
export { MistakeStrategy } from '@/components/question/strategies/MistakeStrategy'

import type { QuestionListStrategy } from '@/components/question/strategies/QuestionListStrategy'
import type { QuestionListType } from '@/components/question/strategies/types'
import { MyExerciseStrategy } from '@/components/question/strategies/MyExerciseStrategy'
import { MyHomeworkStrategy } from '@/components/question/strategies/MyHomeworkStrategy'
import { MistakeStrategy } from '@/components/question/strategies/MistakeStrategy'

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
    case 'mistake':
      return new MistakeStrategy()
    default:
      console.warn(`[QuestionListStrategy] 未知的类型: ${type}，使用默认的习题策略`)
      return new MyExerciseStrategy()
  }
}

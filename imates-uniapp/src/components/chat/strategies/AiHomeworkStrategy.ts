/**
 * AI 作业对话策略 (imates-uniapp)
 */

import { AiExerciseStrategy } from './AiExerciseStrategy'

export class AiHomeworkStrategy extends AiExerciseStrategy {
  getWelcomeMessage(): string {
    return '关于这项作业，你有什么疑问或需要辅导的步骤吗？'
  }

  getPlaceholderText(hasSelectedQuestion: boolean): string {
    return hasSelectedQuestion ? '输入作业疑问...' : '请先选择作业题目'
  }
}

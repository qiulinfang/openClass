/**
 * 聊天策略工厂 (imates-uniapp 适配版)
 * 根据对话类型创建对应的策略实例
 */

import type { ChatStrategy, ChatViewInterface } from './ChatStrategy'
import { AiGeneralStrategy } from './AiGeneralStrategy'
import { AiExerciseStrategy } from './AiExerciseStrategy'
import { AiTextbookStrategy } from './AiTextbookStrategy'
import { AiHomeworkStrategy } from './AiHomeworkStrategy'
import { TeacherStrategy } from './TeacherStrategy'
import { UserClientStrategy } from './UserClientStrategy'
import type { ChatType } from '@/types/chat'

export interface ChatStrategyFactoryOptions {
  subject?: string
  chatView?: ChatViewInterface
}

export class ChatStrategyFactory {
  /**
   * 创建聊天策略实例
   */
  static create(type: ChatType, options?: ChatStrategyFactoryOptions): ChatStrategy {
    let strategy: ChatStrategy

    switch (type) {
      case 'ai-general':
        strategy = new AiGeneralStrategy()
        break

      case 'ai-exercise':
        strategy = new AiExerciseStrategy()
        break

      case 'ai-homework':
        strategy = new AiHomeworkStrategy()
        break

      case 'ai-textbook':
        strategy = new AiTextbookStrategy()
        break

      case 'teacher':
        strategy = new TeacherStrategy()
        break

      case 'user-client':
        strategy = new UserClientStrategy()
        break

      default:
        strategy = new AiGeneralStrategy()
    }

    if (options?.chatView && strategy.setChatView) {
      strategy.setChatView(options.chatView)
    }

    return strategy
  }
}

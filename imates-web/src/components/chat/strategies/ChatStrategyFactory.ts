/**
 * 聊天策略工厂（场景独立Store版本）
 * 根据对话类型创建对应的策略实例
 */

import type { ChatStrategy } from './ChatStrategy'
import type { TeacherSessionInfo } from './types'
import { AiGeneralStrategy } from './AiGeneralStrategy'
import { AiExerciseStrategy } from './AiExerciseStrategy'
import { AiTextbookStrategy } from './AiTextbookStrategy'
import { AiHomeworkStrategy } from './AiHomeworkStrategy'
import { TeacherStrategy } from './TeacherStrategy'
import { UserClientStrategy } from './UserClientStrategy'

export type ChatType = 'ai-general' | 'ai-exercise' | 'ai-homework' | 'ai-textbook' | 'teacher' | 'user-client'

export interface ChatStrategyFactoryOptions {
  subject?: string
  session?: TeacherSessionInfo
  chatView?: import('./ChatStrategy').ChatViewInterface
}

export class ChatStrategyFactory {
  /**
   * 创建聊天策略实例
   * 每个策略内部会获取自己需要的Store
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
        // TeacherStrategy 现在直接从 store 读取 session 信息，不需要构造函数参数
        strategy = new TeacherStrategy()
        break

      case 'user-client':
        strategy = new UserClientStrategy()
        break

      default:
        // 默认返回AI通用策略
        strategy = new AiGeneralStrategy()
    }

    // 如果提供了ChatView接口，设置给策略
    if (options?.chatView && strategy.setChatView) {
      strategy.setChatView(options.chatView)
    }

    return strategy
  }
}

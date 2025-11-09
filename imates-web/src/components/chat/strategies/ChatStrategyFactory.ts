/**
 * 聊天策略工厂（场景独立Store版本）
 * 根据对话类型创建对应的策略实例
 */

import type { ChatStrategy } from './ChatStrategy'
import type { TeacherSessionInfo } from './types'
import { AiGeneralStrategy } from './AiGeneralStrategy'
import { AiExerciseStrategy } from './AiExerciseStrategy'
import { AiTextbookStrategy } from './AiTextbookStrategy'
import { TeacherGeneralStrategy } from './TeacherGeneralStrategy'
import { TeacherExerciseStrategy } from './TeacherExerciseStrategy'

export type ChatType = 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher-general' | 'teacher-exercise'

export interface ChatStrategyFactoryOptions {
  subject?: string
  session?: TeacherSessionInfo
}

export class ChatStrategyFactory {
  /**
   * 创建聊天策略实例
   * 每个策略内部会获取自己需要的Store
   */
  static create(type: ChatType, options?: ChatStrategyFactoryOptions): ChatStrategy {
    switch (type) {
      case 'ai-general':
        return new AiGeneralStrategy()
      
      case 'ai-exercise':
        return new AiExerciseStrategy()
      
      case 'ai-textbook':
        return new AiTextbookStrategy()
      
      case 'teacher-general':
        // TeacherGeneralStrategy 现在直接从 store 读取 session 信息，不需要构造函数参数
        return new TeacherGeneralStrategy()
      
      case 'teacher-exercise':
        return new TeacherExerciseStrategy()
      
      default:
        // 默认返回AI通用策略
        return new AiGeneralStrategy()
    }
  }
}

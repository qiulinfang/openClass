import type { ChatStrategy } from './ChatStrategy'
import type { TeacherSessionInfo } from './types'

export type ChatType = 'ai-general' | 'ai-exercise' | 'ai-homework' | 'ai-textbook' | 'teacher' | 'user-client' | 'html-preview'

export interface ChatStrategyFactoryOptions {
  subject?: string
  session?: TeacherSessionInfo
  chatView?: import('./ChatStrategy').ChatViewInterface
}

export class ChatStrategyFactory {
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

      case 'html-preview':
        strategy = new HtmlPreviewStrategy()
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

import { AiGeneralStrategy } from './AiGeneralStrategy'
import { AiExerciseStrategy } from './AiExerciseStrategy'
import { AiTextbookStrategy } from './AiTextbookStrategy'
import { AiHomeworkStrategy } from './AiHomeworkStrategy'
import { TeacherStrategy } from './TeacherStrategy'
import { UserClientStrategy } from './UserClientStrategy'
import { HtmlPreviewStrategy } from './HtmlPreviewStrategy'

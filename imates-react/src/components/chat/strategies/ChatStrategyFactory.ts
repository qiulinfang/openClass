import type { ChatStrategy } from '@/components/chat/strategies/ChatStrategy'
import type { TeacherSessionInfo } from '@/components/chat/strategies/types'

export type ChatType = 'ai-general' | 'ai-exercise' | 'ai-homework' | 'ai-textbook' | 'teacher' | 'user-client' | 'html-preview'

export interface ChatStrategyFactoryOptions {
  subject?: string
  session?: TeacherSessionInfo
  chatView?: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface
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

import { AiGeneralStrategy } from '@/components/chat/strategies/AiGeneralStrategy'
import { AiExerciseStrategy } from '@/components/chat/strategies/AiExerciseStrategy'
import { AiTextbookStrategy } from '@/components/chat/strategies/AiTextbookStrategy'
import { AiHomeworkStrategy } from '@/components/chat/strategies/AiHomeworkStrategy'
import { TeacherStrategy } from '@/components/chat/strategies/TeacherStrategy'
import { UserClientStrategy } from '@/components/chat/strategies/UserClientStrategy'
import { HtmlPreviewStrategy } from '@/components/chat/strategies/HtmlPreviewStrategy'

export * from '@/types/index'
export * from '@/stores/utils/chatStoreUtils'

export type { ChatStrategy, ChatViewInterface, ForwardResult, ForwardOptions } from '@/components/chat/strategies/ChatStrategy'
export type { ChatType, ChatStrategyFactoryOptions } from '@/components/chat/strategies/ChatStrategyFactory'
export { ChatStrategyFactory } from '@/components/chat/strategies/ChatStrategyFactory'

export { AiGeneralStrategy } from '@/components/chat/strategies/AiGeneralStrategy'
export { AiExerciseStrategy } from '@/components/chat/strategies/AiExerciseStrategy'
export { AiHomeworkStrategy } from '@/components/chat/strategies/AiHomeworkStrategy'
export { AiTextbookStrategy } from '@/components/chat/strategies/AiTextbookStrategy'
export { TeacherStrategy } from '@/components/chat/strategies/TeacherStrategy'
export { UserClientStrategy } from '@/components/chat/strategies/UserClientStrategy'
export { HtmlPreviewStrategy } from '@/components/chat/strategies/HtmlPreviewStrategy'

export { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
export { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
export { useAiHomeworkChatStore } from '@/stores/aiHomeworkChatStore'
export { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
export { useTeacherChatStore } from '@/stores/teacherChatStore'
export { useUserClientChatStore } from '@/stores/userClientChatStore'
export { useHtmlPreviewChatStore } from '@/stores/htmlPreviewChatStore'

export { ChatView } from '@/components/ChatView'

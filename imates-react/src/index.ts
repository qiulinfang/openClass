export * from './types/index'
export * from './stores/utils/chatStoreUtils'

export type { ChatStrategy, ChatViewInterface, ForwardResult, ForwardOptions } from './strategies/ChatStrategy'
export type { ChatType, ChatStrategyFactoryOptions } from './strategies/ChatStrategyFactory'
export { ChatStrategyFactory } from './strategies/ChatStrategyFactory'

export { AiGeneralStrategy } from './strategies/AiGeneralStrategy'
export { AiExerciseStrategy } from './strategies/AiExerciseStrategy'
export { AiHomeworkStrategy } from './strategies/AiHomeworkStrategy'
export { AiTextbookStrategy } from './strategies/AiTextbookStrategy'
export { TeacherStrategy } from './strategies/TeacherStrategy'
export { UserClientStrategy } from './strategies/UserClientStrategy'
export { HtmlPreviewStrategy } from './strategies/HtmlPreviewStrategy'

export { useAiGeneralChatStore } from './stores/aiGeneralChatStore'
export { useAiExerciseChatStore } from './stores/aiExerciseChatStore'
export { useAiHomeworkChatStore } from './stores/aiHomeworkChatStore'
export { useAiTextbookChatStore } from './stores/aiTextbookChatStore'
export { useTeacherChatStore } from './stores/teacherChatStore'
export { useUserClientChatStore } from './stores/userClientChatStore'
export { useHtmlPreviewChatStore } from './stores/htmlPreviewChatStore'

export { ChatView } from './components/ChatView'

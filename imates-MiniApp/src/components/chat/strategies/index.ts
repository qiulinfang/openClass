/**
 * 聊天策略模块统一导出
 */

export type { ChatStrategy, ChatViewInterface } from './ChatStrategy'
export { AiGeneralStrategy } from './AiGeneralStrategy'
export { AiExerciseStrategy } from './AiExerciseStrategy'
export { AiHomeworkStrategy } from './AiHomeworkStrategy'
export { AiTextbookStrategy } from './AiTextbookStrategy'
export { TeacherStrategy } from './TeacherStrategy'
export { HtmlPreviewStrategy } from './HtmlPreviewStrategy'
export { ChatStrategyFactory, type ChatType } from './ChatStrategyFactory'


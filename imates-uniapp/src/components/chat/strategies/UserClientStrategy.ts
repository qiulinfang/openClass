/**
 * 客户端IM对话策略 (imates-uniapp)
 */

import { TeacherStrategy } from './TeacherStrategy'

export class UserClientStrategy extends TeacherStrategy {
  getWelcomeMessage(): string {
    return '开始对话...'
  }

  getPlaceholderText(): string {
    return '发送消息...'
  }
}

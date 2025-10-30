/**
 * 策略相关的类型定义
 */

/**
 * 发送消息的选项
 */
export interface SendMessageOptions {
  selectedModel?: string
  imageData?: {
    filePath: string
    base64DataUrl: string
  }
  // 若上游已手动插入了用户图片消息，则跳过在策略/Store内再次创建用户文本消息
  skipUserMessage?: boolean
}

/**
 * 教师会话信息
 */
export interface TeacherSessionInfo {
  sessionId: string
  sessionName: string
  subject: string
}


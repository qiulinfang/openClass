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
}

/**
 * 教师会话信息
 */
export interface TeacherSessionInfo {
  sessionId: string
  sessionName: string
  subject: string
}


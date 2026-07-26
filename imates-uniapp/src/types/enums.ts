/**
 * 枚举类型定义 (移植自 imates-web)
 */

/** 消息类型枚举 */
export enum MessageType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
  IMAGE = 'IMAGE'
}

/** 发送者/角色枚举（用于 sender 和 type） */
export enum Sender {
  USER = 'user',
  AI = 'ai',
  TEACHER = 'teacher'
}

/** 会话类型枚举 */
export enum SessionType {
  USER_TALK_AI = 'USER_TALK_AI',
  USER_TALK_TEACHER_BIOLOGY = 'USER_TALK_TEACHER_BIOLOGY',
  USER_TALK_TEACHER_MATH = 'USER_TALK_TEACHER_MATH'
}

/** 科目枚举 */
export enum Subject {
  SUBJECT_MATH = 'SUBJECT_MATH',
  SUBJECT_BIOLOGY = 'SUBJECT_BIOLOGY',
  SUBJECT_CHEMISTRY = 'SUBJECT_CHEMISTRY',
  SUBJECT_PHYSICS = 'SUBJECT_PHYSICS',
  SUBJECT_CHINESE = 'SUBJECT_CHINESE',
  SUBJECT_ENGLISH = 'SUBJECT_ENGLISH'
}

export type SceneType = 'homework' | 'favorites' | 'exercise'

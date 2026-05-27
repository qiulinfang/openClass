export enum MessageType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
  IMAGE = 'IMAGE'
}

export enum Sender {
  USER = 'user',
  AI = 'ai',
  TEACHER = 'teacher'
}

export enum SessionType {
  USER_TALK_AI = 'USER_TALK_AI',
  USER_TALK_TEACHER_BIOLOGY = 'USER_TALK_TEACHER_BIOLOGY',
  USER_TALK_TEACHER_MATH = 'USER_TALK_TEACHER_MATH'
}

export enum Subject {
  SUBJECT_MATH = 'SUBJECT_MATH',
  SUBJECT_BIOLOGY = 'SUBJECT_BIOLOGY',
  SUBJECT_CHEMISTRY = 'SUBJECT_CHEMISTRY',
  SUBJECT_PHYSICS = 'SUBJECT_PHYSICS',
  SUBJECT_CHINESE = 'SUBJECT_CHINESE',
  SUBJECT_ENGLISH = 'SUBJECT_ENGLISH'
}

export type SceneType = 'homework' | 'favorites' | 'exercise'
export type EnvType = 'RELEASE' | 'INTERNAL_TEST' | 'DEVELOPMENT'

import { getUserId } from '../http/auth-service'
import { AppEnvType, getCurrentEnvType } from '@/config/env-config'
import type { IndexedDBConfig } from './indexeddb-service'

/**
 * 获取环境后缀 (非 RELEASE 环境下增加环境标识)
 */
function getEnvSuffix() {
  const envType = getCurrentEnvType()
  return envType === AppEnvType.RELEASE ? '' : `_${envType}`
}

/**
 * 数据库名称常量定义
 */
export const DB_NAMES = {
  // AI 聊天与对话数据库 (包含练习、作业、通用等所有场景)
  CHAT_STORAGE: () => `ChatStorageDB_${getUserId()}${getEnvSuffix()}`,
  
  // 教材资源数据库
  TEXTBOOK_STORAGE: () => `TextbookStorage_${getUserId()}${getEnvSuffix()}`,
  
  // 题目列表数据库
  QUESTION_LISTS: () => `ExerciseQuestionsDB_${getUserId()}${getEnvSuffix()}`,
  
  // 作业作答数据库
  HOMEWORK_SUBMISSION: () => `HomeworkStorageDB_${getUserId()}${getEnvSuffix()}`,
  
  // 错题本数据库
  MISTAKE_STORAGE: () => `MistakeStorageDB_${getUserId()}${getEnvSuffix()}`,

  // 草稿数据库
  DRAFTS_STORAGE: () => `ExerciseDraftsDB_${getUserId()}${getEnvSuffix()}`,

  // PDF 墨水笔迹数据库 (保持固定名称防止历史数据丢失)
  PDF_INK_STORAGE: () => 'pdf-ink-db',
}

/**
 * 数据库版本号管理
 */
export const DB_VERSIONS = {
  CHAT_STORAGE: 13, // 聊天数据库版本
  TEXTBOOK_STORAGE: 21, 
  QUESTION_LISTS: 6,
  HOMEWORK_SUBMISSION: 6,
  MISTAKE_STORAGE: 11, 
  DRAFTS_STORAGE: 6,
  PDF_INK_STORAGE: 2,
}

/**
 * 存储表名定义 (Store Names)
 */
export const STORE_NAMES = {
  // CHAT_STORAGE 数据库下的表
  CHAT_HISTORY: 'chat_history',
  AI_EXERCISE_SESSIONS: 'ai_exercise_sessions',
  AI_HOMEWORK_SESSIONS: 'ai_homework_sessions',
  TEACHER_EXERCISE_SESSIONS: 'teacher_exercise_sessions',
  AI_GENERAL_SESSIONS: 'ai_general_sessions',

  // TEXTBOOK_STORAGE 数据库下的表
  TEXTBOOKS: 'textbooks',
  TEXTBOOK_FILES: 'textbook_files',
  AI_TEXTBOOK_SESSIONS: 'ai_textbook_sessions',
  KNOWLEDGE_GRAPH_CHAPTER: 'knowledge_graph_chapter_structure',

  // QUESTION_LISTS 数据库下的表
  QUESTION_LISTS: 'question_lists',

  // HOMEWORK_SUBMISSION 数据库下的表
  SUBMISSIONS: 'submissions',

  // MISTAKE_STORAGE 数据库下的表
  MISTAKES: 'mistakes',

  // DRAFTS_STORAGE 数据库下的表
  QUESTION_DRAFTS: 'question_drafts',

  // TEXTBOOK_STORAGE 下新增
  LEARNING_PACKAGES: 'learning_packages',

  // PDF 笔迹表
  PDF_ANNOTATIONS: 'annotations',
}

/**
 * 完整数据库配置
 */
export const IDB_CONFIGS: Record<string, () => IndexedDBConfig> = {
  CHAT_STORAGE: () => ({
    dbName: DB_NAMES.CHAT_STORAGE(),
    version: DB_VERSIONS.CHAT_STORAGE,
    stores: [
      { name: STORE_NAMES.CHAT_HISTORY, keyPath: 'id' },
      { 
        name: STORE_NAMES.AI_EXERCISE_SESSIONS, 
        keyPath: 'id',
        indexes: [
          { name: 'questionBmNo', keyPath: 'questionBmNo' }
        ]
      },
      { name: STORE_NAMES.AI_HOMEWORK_SESSIONS, keyPath: 'id' },
      { name: STORE_NAMES.TEACHER_EXERCISE_SESSIONS, keyPath: 'id' },
      { name: STORE_NAMES.AI_GENERAL_SESSIONS, keyPath: 'id' }
    ]
  }),
  TEXTBOOK_STORAGE: () => ({
    dbName: DB_NAMES.TEXTBOOK_STORAGE(),
    version: DB_VERSIONS.TEXTBOOK_STORAGE,
    stores: [
      {
        name: STORE_NAMES.TEXTBOOKS,
        keyPath: 'id',
        indexes: [
          { name: 'isDownloaded', keyPath: 'isDownloaded' },
          { name: 'downloadStatus', keyPath: 'downloadStatus' },
          { name: 'lastDownloadTime', keyPath: 'lastDownloadTime' },
          { name: 'subjectLabel', keyPath: 'textbookSubjectLabel' },
          { name: 'gradeLabel', keyPath: 'textbookGradeLabel' },
          { name: 'textbookId', keyPath: 'textbookId' }
        ]
      },
      {
        name: STORE_NAMES.TEXTBOOK_FILES,
        keyPath: 'fileId',
        indexes: [
          { name: 'textbookId', keyPath: 'textbookId' }
        ]
      },
      {
        name: STORE_NAMES.AI_TEXTBOOK_SESSIONS,
        keyPath: 'sessionId',
        indexes: [
          { name: 'resourceId', keyPath: 'resourceId' },
          { name: 'pinned', keyPath: 'pinned' },
          { name: 'updateTime', keyPath: 'updateTime' }
        ]
      },
      {
        name: STORE_NAMES.KNOWLEDGE_GRAPH_CHAPTER,
        keyPath: 'id',
        indexes: [
          { name: 'userId', keyPath: 'userId' },
          { name: 'textbookId', keyPath: 'textbookId' },
          { name: 'timestamp', keyPath: 'timestamp' }
        ]
      },
      {
        name: STORE_NAMES.LEARNING_PACKAGES,
        keyPath: 'id',
        indexes: [
          { name: 'userId', keyPath: 'userId' },
          { name: 'packageId', keyPath: 'packageId' }
        ]
      }
    ]
  }),
  QUESTION_LISTS: () => ({
    dbName: DB_NAMES.QUESTION_LISTS(),
    version: DB_VERSIONS.QUESTION_LISTS,
    stores: [
      {
        name: STORE_NAMES.QUESTION_LISTS,
        keyPath: 'subject',
        indexes: [
          { name: 'timestamp', keyPath: 'timestamp' },
          { name: 'subject', keyPath: 'subject', unique: true }
        ]
      }
    ]
  }),
  HOMEWORK_SUBMISSION: () => ({
    dbName: DB_NAMES.HOMEWORK_SUBMISSION(),
    version: DB_VERSIONS.HOMEWORK_SUBMISSION,
    stores: [
      {
        name: STORE_NAMES.SUBMISSIONS,
        keyPath: 'homeworkId',
        indexes: [
          { name: 'homeworkId', keyPath: 'homeworkId', unique: true },
          { name: 'timestamp', keyPath: 'timestamp' }
        ]
      }
    ]
  }),
  MISTAKE_STORAGE: () => ({
    dbName: DB_NAMES.MISTAKE_STORAGE(),
    version: DB_VERSIONS.MISTAKE_STORAGE,
    stores: [
      {
        name: STORE_NAMES.MISTAKES,
        keyPath: 'bmNo',
        indexes: [
          { name: 'timestamp', keyPath: 'timestamp' },
          { name: 'lastPracticeTime', keyPath: 'lastPracticeTime' }
        ]
      }
    ]
  }),
  DRAFTS_STORAGE: () => ({
    dbName: DB_NAMES.DRAFTS_STORAGE(),
    version: DB_VERSIONS.DRAFTS_STORAGE,
    stores: [
      {
        name: STORE_NAMES.QUESTION_DRAFTS,
        keyPath: 'questionId',
        indexes: [
          { name: 'updatedAt', keyPath: 'updatedAt' }
        ]
      }
    ]
  }),
  PDF_INK_STORAGE: () => ({
    dbName: DB_NAMES.PDF_INK_STORAGE(),
    version: DB_VERSIONS.PDF_INK_STORAGE,
    stores: [
      { name: STORE_NAMES.PDF_ANNOTATIONS, keyPath: 'docKey' }
    ]
  })
}

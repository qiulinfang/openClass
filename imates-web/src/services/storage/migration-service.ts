import localforage from 'localforage'
import { getUserId } from '../index'
import { chatStorage } from './chat-storage'
import { IndexedDBService } from './indexeddb-service'
import { STORE_NAMES, IDB_CONFIGS } from './db-config'

const MIGRATION_KEY = 'storage_migration_v1_done'

/**
 * 数据迁移服务
 * 负责将旧版 localforage 存储的数据搬迁到新版 IndexedDBService 架构中
 */
export class MigrationService {
  private static instance: MigrationService

  public static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService()
    }
    return MigrationService.instance
  }

  /**
   * 执行所有迁移任务
   */
  public async runMigrations(): Promise<void> {
    const userId = getUserId()
    if (!userId) {
      console.log('[Migration] 无用户 ID，跳过迁移')
      return
    }

    const isDone = localStorage.getItem(`${MIGRATION_KEY}_${userId}`)
    if (isDone === 'true') {
      return
    }

    console.log('[Migration] 🚀 开始执行数据迁移...')

    try {
      await Promise.all([
        this.migrateChatSessions(),
        this.migrateExerciseSessions(), // 新增：迁移题目练习会话
        this.migrateMistakes(),
        this.migrateTextbooks(),
      ])

      localStorage.setItem(`${MIGRATION_KEY}_${userId}`, 'true')
      console.log('[Migration] ✅ 数据迁移全部完成')
    } catch (error) {
      console.error('[Migration] ❌ 数据迁移过程中出错:', error)
    }
  }

  /**
   * 迁移聊天会话和历史记录
   */
  private async migrateChatSessions(): Promise<void> {
    const userId = getUserId()
    
    // 1. 迁移通用 AI 会话列表
    try {
      const oldGeneralSessions = await localforage.getItem<any[]>('ai_general_sessions')
      if (oldGeneralSessions && Array.isArray(oldGeneralSessions)) {
        console.log(`[Migration] 发现旧版通用会话 ${oldGeneralSessions.length} 条`)
        await chatStorage.saveGeneralSessions(oldGeneralSessions)
        
        // 迁移对应的历史记录
        for (const session of oldGeneralSessions) {
          await this.migrateHistory(`chat_history_session_${session.sessionId}`, `ai-general-${session.sessionId}`)
        }
      }
    } catch (e) {
      console.warn('[Migration] 迁移通用会话失败:', e)
    }

    // 2. 迁移作业 AI 会话列表
    try {
      const oldHomeworkSessions = await localforage.getItem<any[]>(`ai_homework_sessions_${userId}`)
      if (oldHomeworkSessions && Array.isArray(oldHomeworkSessions)) {
        console.log(`[Migration] 发现旧版作业会话 ${oldHomeworkSessions.length} 条`)
        await chatStorage.saveHomeworkSessions(oldHomeworkSessions)
        
        // 迁移对应的历史记录
        for (const session of oldHomeworkSessions) {
          await this.migrateHistory(`chat_history_session_${session.sessionId}`, `ai-homework-${session.sessionId}`)
        }
      }
    } catch (e) {
      console.warn('[Migration] 迁移作业会话失败:', e)
    }
  }

  /**
   * 迁移单条历史记录
   */
  private async migrateHistory(oldKey: string, newKey: string): Promise<void> {
    try {
      const oldData = await localforage.getItem<any>(oldKey)
      if (oldData) {
        // 修正主键模型：确保 payload 被包装在带 id 的记录中
        await chatStorage.saveChatHistory(newKey, oldData)
        console.log(`[Migration] 已搬迁历史记录: ${oldKey} -> ${newKey}`)
      }
    } catch (e) {
      console.warn(`[Migration] 搬迁历史记录 ${oldKey} 失败:`, e)
    }
  }

  /**
   * 迁移题目练习会话和教师会话
   */
  private async migrateExerciseSessions(): Promise<void> {
    try {
      const allKeys = await localforage.keys()
      
      // 1. 迁移 AI 题目练习会话 (格式: sessions_${bmNo})
      const exerciseSessionKeys = allKeys.filter(k => k.startsWith('sessions_'))
      for (const oldKey of exerciseSessionKeys) {
        const bmNo = oldKey.replace('sessions_', '')
        const sessions = await localforage.getItem<any[]>(oldKey)
        if (sessions && Array.isArray(sessions)) {
          console.log(`[Migration] 发现题目 ${bmNo} 的练习会话 ${sessions.length} 条`)
          // 写入新库 (ExerciseSolve 库的 ai_exercise_sessions 表)
          const record = { id: oldKey, sessions }
          const db = IndexedDBService.getInstance(IDB_CONFIGS.EXERCISE_SOLVE())
          await db.put(STORE_NAMES.AI_EXERCISE_SESSIONS, record)
          
          // 迁移会话历史
          for (const s of sessions) {
            if (s.id) {
              await this.migrateHistory(`chat_history_session_${s.id}`, `ai-exercise-${s.id}`)
            }
          }
        }
      }

      // 2. 迁移教师题目练习会话
      const teacherSessions = await localforage.getItem<Record<string, any>>('teacher_exercise_sessions')
      if (teacherSessions) {
        console.log(`[Migration] 发现教师练习会话记录`)
        const record = { id: 'teacher_exercise_sessions', sessions: teacherSessions }
        const db = IndexedDBService.getInstance(IDB_CONFIGS.EXERCISE_SOLVE())
        await db.put(STORE_NAMES.TEACHER_EXERCISE_SESSIONS, record)
        
        // 迁移历史记录 (教师会话的 key 逻辑可能较复杂，此处按 sessionId 尝试迁移)
        for (const sessionId in teacherSessions) {
          await this.migrateHistory(`chat_history_session_${sessionId}`, `teacher-exercise-${sessionId}`)
        }
      }
    } catch (e) {
      console.warn('[Migration] 迁移练习会话失败:', e)
    }
  }

  /**
   * 迁移错题本
   */
  private async migrateMistakes(): Promise<void> {
    try {
      // 尝试打开旧版错题本数据库
      const oldMistakeInstance = localforage.createInstance({
        name: 'MistakeStorageDB',
        storeName: 'mistakes'
      })
      
      const keys = await oldMistakeInstance.keys()
      if (keys.length > 0) {
        console.log(`[Migration] 发现旧版错题 ${keys.length} 个`)
        const newMistakeDB = IndexedDBService.getInstance(IDB_CONFIGS.MISTAKE_STORAGE())
        
        for (const key of keys) {
          const item = await oldMistakeInstance.getItem<any>(key)
          if (item) {
            // 确保有 id 字段 (IndexedDBService 要求)
            if (!item.id) item.id = item.bmNo || key
            await newMistakeDB.put(STORE_NAMES.MISTAKES, item)
          }
        }
      }
    } catch (e) {
      console.warn('[Migration] 迁移错题本失败:', e)
    }
  }

  /**
   * 迁移教材资源
   */
  private async migrateTextbooks(): Promise<void> {
    try {
      const newTextbookDB = IndexedDBService.getInstance(IDB_CONFIGS.TEXTBOOK_STORAGE())

      // 1. 迁移教材元数据
      const oldTextbookInstance = localforage.createInstance({
        name: 'TextbookStorageDB',
        storeName: 'textbooks'
      })
      
      const tbKeys = await oldTextbookInstance.keys()
      if (tbKeys.length > 0) {
        console.log(`[Migration] 发现旧版教材元数据 ${tbKeys.length} 条`)
        for (const key of tbKeys) {
          const tb = await oldTextbookInstance.getItem<any>(key)
          if (tb) {
            if (!tb.id) tb.id = key
            await newTextbookDB.put(STORE_NAMES.TEXTBOOKS, tb)
          }
        }
      }

      // 2. 迁移教材文件 (大对象)
      const oldFilesInstance = localforage.createInstance({
        name: 'TextbookStorageDB',
        storeName: 'textbook_files'
      })
      
      const fileKeys = await oldFilesInstance.keys()
      if (fileKeys.length > 0) {
        console.log(`[Migration] 发现旧版教材文件 ${fileKeys.length} 个`)
        for (const key of fileKeys) {
          const fileData = await oldFilesInstance.getItem<any>(key)
          if (fileData) {
            // 新版结构可能是 { fileId, textbookId, fileData }
            const record = {
              fileId: key,
              textbookId: fileData.textbookId || '',
              fileData: fileData.data || fileData
            }
            await newTextbookDB.put(STORE_NAMES.TEXTBOOK_FILES, record)
          }
        }
      }
    } catch (e) {
      console.warn('[Migration] 迁移教材资源失败:', e)
    }
  }
}

export const migrationService = MigrationService.getInstance()

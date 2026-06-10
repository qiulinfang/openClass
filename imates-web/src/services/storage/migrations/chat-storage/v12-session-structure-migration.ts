import { getUserId } from '@/services/http/auth-service'
import { chatStorage } from '@/services/storage/chat-storage'
import { IndexedDBService } from '@/services/storage/indexeddb-service'
import { STORE_NAMES, IDB_CONFIGS } from '@/services/storage/db-config'
import type { AiGeneralSession, AiHomeworkSession } from '@/types'

/**
 * V12 数据库结构迁移
 * 职责：将通用、作业、练习会话从“打包数组格式”迁移为“原子记录格式”
 */
export class V12SessionStructureMigration {
  private static instance: V12SessionStructureMigration

  public static getInstance(): V12SessionStructureMigration {
    if (!V12SessionStructureMigration.instance) {
      V12SessionStructureMigration.instance = new V12SessionStructureMigration()
    }
    return V12SessionStructureMigration.instance
  }

  /**
   * 执行迁移
   */
  public async run(): Promise<void> {
    try {
      const userId = getUserId()
      if (!userId) return

      // 获取数据库实例（这会确保数据库已打开）
      const db = IndexedDBService.getInstance(IDB_CONFIGS.CHAT_STORAGE())
      
      // 1. 迁移 AI 通用会话
      const generalKey = 'ai_general_sessions'
      const legacyGeneral = await db.get<{sessions: AiGeneralSession[]}>(
        STORE_NAMES.AI_GENERAL_SESSIONS, 
        generalKey
      )
      
      if (legacyGeneral && Array.isArray(legacyGeneral.sessions)) {
        for (const session of legacyGeneral.sessions) {
          if (session.sessionId) {
            await chatStorage.saveGeneralSession(session)
          }
        }
        await db.delete(STORE_NAMES.AI_GENERAL_SESSIONS, generalKey)
      }

      // 3. 迁移 AI 作业会话
      const homeworkKey = `ai_homework_sessions_${userId}`
      const legacyHomework = await db.get<{sessions: AiHomeworkSession[]}>(
        STORE_NAMES.AI_HOMEWORK_SESSIONS,
        homeworkKey
      )

      if (legacyHomework && Array.isArray(legacyHomework.sessions)) {
        for (const session of legacyHomework.sessions) {
          if (session.sessionId) {
            await chatStorage.saveHomeworkSession(session)
          }
        }
        await db.delete(STORE_NAMES.AI_HOMEWORK_SESSIONS, homeworkKey)
      }

      // 4. 迁移 AI 练习会话
      const exerciseKeys = await db.getAllKeys(STORE_NAMES.AI_EXERCISE_SESSIONS)
      const legacyExerciseKeys = exerciseKeys.filter(k => typeof k === 'string' && k.startsWith('sessions_'))
      
      if (legacyExerciseKeys.length > 0) {
        for (const key of legacyExerciseKeys) {
          const legacyData = await db.get<{sessions: any[]}>(STORE_NAMES.AI_EXERCISE_SESSIONS, key)
          if (legacyData && Array.isArray(legacyData.sessions)) {
            for (const session of legacyData.sessions) {
              const sessionId = session.id || session.sessionId
              if (sessionId) {
                // 注意：练习会话需要 questionBmNo 才能正确保存到新结构
                await chatStorage.saveExerciseSession({
                  id: sessionId,
                  questionBmNo: session.questionBmNo || (key as string).replace('sessions_', ''),
                  ...session
                })
              }
            }
          }
          await db.delete(STORE_NAMES.AI_EXERCISE_SESSIONS, key)
        }
      }

    } catch (error) {
      console.error('[Migration-V12] 结构重构迁移失败:', error)
    }
  }
}

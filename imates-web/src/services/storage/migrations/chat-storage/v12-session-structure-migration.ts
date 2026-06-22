import { getUserId } from '@/services/http/auth-service'
import { chatStorage } from '@/services/storage/chat-storage'
import { IndexedDBService } from '@/services/storage/indexeddb-service'
import { STORE_NAMES, IDB_CONFIGS } from '@/services/storage/db-config'
import type { AiGeneralSession, AiHomeworkSession } from '@/types'

const MIGRATION_KEY = 'storage_migration_v12_done'

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
    const startTime = Date.now()
    try {
      const userId = getUserId()
      if (!userId) {
        console.log('[Migration] 无用户 ID，跳过 V12 迁移')
        return
      }

      const isDone = localStorage.getItem(`${MIGRATION_KEY}_${userId}`)
      if (isDone === 'true') {
        console.log('[Migration] 当前用户已完成迁移 (v12)，跳过')
        return
      }

      console.log(`[Migration] 🚀 开始执行 V12 结构重构迁移 (打包数组 -> 原子记录)...`)

      // 获取数据库实例（这会确保数据库已打开）
      const db = IndexedDBService.getInstance(IDB_CONFIGS.CHAT_STORAGE())
      
      // 1. 迁移 AI 通用会话
      const generalKey = 'ai_general_sessions'
      const legacyGeneral = await db.get<{sessions: AiGeneralSession[]}>(
        STORE_NAMES.AI_GENERAL_SESSIONS, 
        generalKey
      )
      
      if (legacyGeneral && Array.isArray(legacyGeneral.sessions)) {
        console.log(`[Migration] 📂 发现旧版 V12 通用会话，共 ${legacyGeneral.sessions.length} 个`)
        for (const session of legacyGeneral.sessions) {
          if (session.sessionId) {
            console.log(`[Migration] 📦 正在迁移通用会话: ${session.sessionName || session.sessionId}`)
            await chatStorage.saveGeneralSession(session)
          }
        }
        await db.delete(STORE_NAMES.AI_GENERAL_SESSIONS, generalKey)
        console.log('[Migration] ✅ 通用会话迁移完成')
      }

      // 3. 迁移 AI 作业会话
      const homeworkKey = `ai_homework_sessions_${userId}`
      const legacyHomework = await db.get<{sessions: AiHomeworkSession[]}>(
        STORE_NAMES.AI_HOMEWORK_SESSIONS,
        homeworkKey
      )

      if (legacyHomework && Array.isArray(legacyHomework.sessions)) {
        console.log(`[Migration] 📂 发现旧版 V12 作业会话，共 ${legacyHomework.sessions.length} 个`)
        for (const session of legacyHomework.sessions) {
          if (session.sessionId) {
            console.log(`[Migration] 📦 正在迁移作业会话: ${session.sessionName || session.sessionId}`)
            await chatStorage.saveHomeworkSession(session)
          }
        }
        await db.delete(STORE_NAMES.AI_HOMEWORK_SESSIONS, homeworkKey)
        console.log('[Migration] ✅ 作业会话迁移完成')
      }

      // 4. 迁移 AI 练习会话
      const exerciseKeys = await db.getAllKeys(STORE_NAMES.AI_EXERCISE_SESSIONS)
      const legacyExerciseKeys = exerciseKeys.filter(k => typeof k === 'string' && k.startsWith('sessions_'))
      
      if (legacyExerciseKeys.length > 0) {
        console.log(`[Migration] 📂 发现旧版 V12 练习会话列表，共 ${legacyExerciseKeys.length} 个 Key`)
        for (const key of legacyExerciseKeys) {
          const legacyData = await db.get<{sessions: any[]}>(STORE_NAMES.AI_EXERCISE_SESSIONS, key)
          if (legacyData && Array.isArray(legacyData.sessions)) {
            console.log(`[Migration] 📦 正在处理 Key: ${key}，共 ${legacyData.sessions.length} 个练习会话`)
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
        console.log('[Migration] ✅ 练习会话迁移完成')
      }

      localStorage.setItem(`${MIGRATION_KEY}_${userId}`, 'true')
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`[Migration] ✅ V12 结构重构迁移全部完成，耗时 ${duration}s`)

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      console.error(`[Migration] ❌ V12 结构重构迁移失败 (耗时 ${duration}s):`, error)
    }
  }
}

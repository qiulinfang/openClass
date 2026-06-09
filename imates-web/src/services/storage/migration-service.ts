import localforage from 'localforage'
import { getUserId } from '../http/auth-service'
import { chatStorage } from './chat-storage'
import { IndexedDBService } from './indexeddb-service'
import { STORE_NAMES, IDB_CONFIGS } from './db-config'

const MIGRATION_KEY = 'storage_migration_v2_done'

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
      console.log('[Migration] 当前用户已完成迁移 (v2)，跳过')
      return
    }

    console.log(`[Migration] 🚀 开始为用户 ${userId} 执行聊天数据迁移 (ExerciseSolveApp -> ChatStorageDB)...`)

    const startTime = Date.now()
    try {
      // 1. 执行聊天数据迁移
      await this.migrateAllChatData()

      localStorage.setItem(`${MIGRATION_KEY}_${userId}`, 'true')
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`[Migration] ✅ 聊天数据迁移全部完成，耗时 ${duration}s`)
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      console.error(`[Migration] ❌ 迁移过程中出错 (耗时 ${duration}s):`, error)
    }
  }

  /**
   * 迁移所有聊天相关数据
   */
  private async migrateAllChatData(): Promise<void> {
    const userId = getUserId()
    const oldDBName = `ExerciseSolveApp_${userId}`
    
    // 定义旧版各表的实例
    const oldStores = {
      general: localforage.createInstance({ name: oldDBName, storeName: 'ai_general_sessions' }),
      homework: localforage.createInstance({ name: oldDBName, storeName: 'ai_homework_sessions' }),
      exercise: localforage.createInstance({ name: oldDBName, storeName: 'ai_exercise_sessions' }),
      teacher: localforage.createInstance({ name: oldDBName, storeName: 'teacher_exercise_sessions' }),
      history: localforage.createInstance({ name: oldDBName, storeName: 'chat_history' })
    }

    console.log('[Migration] 正在读取旧版 ExerciseSolveApp 数据...')

    // 1. 迁移通用 AI 会话
    try {
      const sessions = await oldStores.general.getItem<any[]>('ai_general_sessions')
      if (sessions?.length) {
        console.log(`[Migration] 发现旧版通用会话 ${sessions.length} 条`)
        await chatStorage.saveGeneralSessions(sessions)
        for (const s of sessions) {
          await this.migrateHistoryItem(s.sessionId, `ai-general-${s.sessionId}`, oldStores.history)
        }
      }
    } catch (e) { console.warn('[Migration] 通用会话迁移失败', e) }

    // 2. 迁移作业 AI 会话
    try {
      const key = `ai_homework_sessions_${userId}`
      const sessions = await oldStores.homework.getItem<any[]>(key)
      if (sessions?.length) {
        console.log(`[Migration] 发现旧版作业会话 ${sessions.length} 条`)
        await chatStorage.saveHomeworkSessions(sessions)
        for (const s of sessions) {
          await this.migrateHistoryItem(s.sessionId, `ai-homework-${s.sessionId}`, oldStores.history)
        }
      }
    } catch (e) { console.warn('[Migration] 作业会话迁移失败', e) }

    // 3. 迁移题目练习会话
    try {
      const allKeys = await oldStores.exercise.keys()
      const sessionKeys = allKeys.filter(k => k.startsWith('sessions_'))
      if (sessionKeys.length) {
        console.log(`[Migration] 发现旧版练习会话列表 ${sessionKeys.length} 个`)
        for (const key of sessionKeys) {
          const bmNo = key.replace('sessions_', '')
          const sessions = await oldStores.exercise.getItem<any[]>(key)
          if (sessions?.length) {
            await chatStorage.saveSessionsList(bmNo, sessions)
            for (const s of sessions) {
              if (s.id) await this.migrateHistoryItem(s.id, `ai-exercise-${s.id}`, oldStores.history)
            }
          }
        }
      }
    } catch (e) { console.warn('[Migration] 练习会话迁移失败', e) }

    // 4. 迁移教师题目会话
    try {
      const sessions = await oldStores.teacher.getItem<Record<string, any>>('teacher_exercise_sessions')
      if (sessions) {
        const ids = Object.keys(sessions)
        console.log(`[Migration] 发现旧版教师会话 ${ids.length} 条`)
        await chatStorage.saveTeacherExerciseSessions(sessions)
        for (const id of ids) {
          await this.migrateHistoryItem(id, `teacher-exercise-${id}`, oldStores.history)
        }
      }
    } catch (e) { console.warn('[Migration] 教师会话迁移失败', e) }
  }

  /**
   * 迁移单条聊天历史
   */
  private async migrateHistoryItem(oldId: string, newId: string, historyStore: LocalForage): Promise<void> {
    try {
      const userId = getUserId()
      const oldKey = `${userId}_chat_history_${oldId}`
      const data = await historyStore.getItem<any>(oldKey)
      if (data) {
        await chatStorage.saveChatHistory(newId, data)
      }
    } catch (e) {
      console.warn(`[Migration] 历史记录搬运失败: ${oldId}`, e)
    }
  }
}

export const migrationService = MigrationService.getInstance()

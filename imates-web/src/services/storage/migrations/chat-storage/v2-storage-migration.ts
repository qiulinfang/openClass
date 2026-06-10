import localforage from 'localforage'
import { getUserId } from '@/services/http/auth-service'
import { chatStorage } from '@/services/storage/chat-storage'
import { IndexedDBService } from '@/services/storage/indexeddb-service'
import { STORE_NAMES, IDB_CONFIGS } from '@/services/storage/db-config'

const MIGRATION_KEY = 'storage_migration_v2_done'

/**
 * 数据迁移服务 (V2)
 * 负责将旧版 localforage 存储的数据搬迁到新版 IndexedDBService 架构中
 */
export class V2StorageMigration {
  private static instance: V2StorageMigration

  public static getInstance(): V2StorageMigration {
    if (!V2StorageMigration.instance) {
      V2StorageMigration.instance = new V2StorageMigration()
    }
    return V2StorageMigration.instance
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
      // 执行聊天数据迁移
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

    console.log(`[Migration] 🔍 正在扫描旧数据库: ${oldDBName}`)

    // 1. 迁移通用 AI 会话
    console.log('[Migration] ⏳ 开始迁移通用 AI 会话...')
    try {
      const sessions = await oldStores.general.getItem<any[]>('ai_general_sessions')
      if (sessions?.length) {
        console.log(`[Migration] 📂 发现旧版通用会话 ${sessions.length} 条`)
        await chatStorage.saveGeneralSessions(sessions)
        for (const s of sessions) {
          console.log(`[Migration] 📦 正在搬运通用会话内容: ${s.sessionName || s.sessionId}`)
          await this.migrateHistoryItem(s.sessionId, `ai-general-${s.sessionId}`, oldStores.history)
        }
        console.log('[Migration] ✅ 通用 AI 会话迁移完成')
      } else {
        console.log('[Migration] ℹ️ 未发现旧版通用 AI 会话')
      }
    } catch (e) { console.error('[Migration] ❌ 通用会话迁移失败', e) }

    // 2. 迁移作业 AI 会话
    console.log('[Migration] ⏳ 开始迁移作业 AI 会话...')
    try {
      const key = `ai_homework_sessions_${userId}`
      const sessions = await oldStores.homework.getItem<any[]>(key)
      if (sessions?.length) {
        console.log(`[Migration] 📂 发现旧版作业会话 ${sessions.length} 条`)
        await chatStorage.saveHomeworkSessions(sessions)
        for (const s of sessions) {
          console.log(`[Migration] 📦 正在搬运作业会话内容: ${s.sessionName || s.sessionId}`)
          await this.migrateHistoryItem(s.sessionId, `ai-homework-${s.sessionId}`, oldStores.history)
        }
        console.log('[Migration] ✅ 作业 AI 会话迁移完成')
      } else {
        console.log('[Migration] ℹ️ 未发现旧版作业 AI 会话')
      }
    } catch (e) { console.error('[Migration] ❌ 作业会话迁移失败', e) }

    // 3. 迁移题目练习会话
    console.log('[Migration] ⏳ 开始迁移题目练习会话...')
    try {
      const allKeys = await oldStores.exercise.keys()
      const sessionKeys = allKeys.filter(k => k.startsWith('sessions_'))
      if (sessionKeys.length) {
        console.log(`[Migration] 📂 发现旧版练习会话列表 ${sessionKeys.length} 个`)
        for (const key of sessionKeys) {
          const bmNo = key.replace('sessions_', '')
          const sessions = await oldStores.exercise.getItem<any[]>(key)
          if (sessions?.length) {
            console.log(`[Migration] 📦 正在迁移题目 ${bmNo} 的 ${sessions.length} 个会话列表`)
            await chatStorage.saveSessionsList(sessions)
            for (const s of sessions) {
              if (s.id) {
                console.log(`[Migration] 📦 正在搬运练习对话记录: ${s.id}`)
                await this.migrateHistoryItem(s.id, `ai-exercise-${s.id}`, oldStores.history)
              }
            }
          }
        }
        console.log('[Migration] ✅ 题目练习会话迁移完成')
      } else {
        console.log('[Migration] ℹ️ 未发现旧版题目练习会话')
      }
    } catch (e) { console.error('[Migration] ❌ 练习会话迁移失败', e) }

    // 4. 迁移教师题目会话
    console.log('[Migration] ⏳ 开始迁移教师题目会话...')
    try {
      const sessions = await oldStores.teacher.getItem<Record<string, any>>('teacher_exercise_sessions')
      if (sessions) {
        const ids = Object.keys(sessions)
        if (ids.length) {
          console.log(`[Migration] 📂 发现旧版教师会话 ${ids.length} 条`)
          await chatStorage.saveTeacherExerciseSessions(sessions)
          for (const id of ids) {
            console.log(`[Migration] 📦 正在搬运教师对话记录: ${id}`)
            await this.migrateHistoryItem(id, `teacher-exercise-${id}`, oldStores.history)
          }
          console.log('[Migration] ✅ 教师题目会话迁移完成')
        } else {
          console.log('[Migration] ℹ️ 旧版教师会话列表为空')
        }
      } else {
        console.log('[Migration] ℹ️ 未发现旧版教师题目会话')
      }
    } catch (e) { console.error('[Migration] ❌ 教师会话迁移失败', e) }
  }

  /**
   * 迁移单条聊天历史
   */
  private async migrateHistoryItem(oldId: string, newId: string, historyStore: LocalForage): Promise<void> {
    try {
      const userId = getUserId()
      
      // 旧版 Key 格式固定为: ${userId}_chat_history_${newId}
      // 注意：这里的 newId 就是带场景前缀的 ID（如 ai-general-sessionId）
      const oldKey = `${userId}_chat_history_${newId}`

      const data = await historyStore.getItem<any>(oldKey)

      if (data) {
        // 直接存入新库，新库现在直接使用 newId 作为主键，不再补齐前缀
        await chatStorage.saveChatHistory(newId, data)
        console.log(`[Migration]   ∟ ✅ 成功迁移历史详情: [${oldKey}] -> ${newId} (${data.messages?.length || 0} 条消息)`)
      } else {
        // 兜底：尝试不带场景前缀的原始 ID
        const fallbackKey = `${userId}_chat_history_${oldId}`
        const fallbackData = await historyStore.getItem<any>(fallbackKey)
        
        if (fallbackData) {
          await chatStorage.saveChatHistory(newId, fallbackData)
          console.log(`[Migration]   ∟ ✅ 成功迁移历史详情 (兜底): [${fallbackKey}] -> ${newId} (${fallbackData.messages?.length || 0} 条消息)`)
        } else {
          console.log(`[Migration]   ∟ ℹ️ 未找到历史详情: ${oldId}`)
        }
      }
    } catch (e) {
      console.error(`[Migration]   ∟ ❌ 迁移历史详情失败: ${newId}`, e)
    }
  }
}

import { getUserId } from '@/services/http/auth-service'
import { IndexedDBService } from '@/services/storage/indexeddb-service'
import { STORE_NAMES } from '@/services/storage/db-config'
import { initMistakeStorage, addMistake } from '@/services/storage/mistake-storage'
import { getCurrentEnvType, AppEnvType } from '@/config/env-config'

/**
 * 错题集数据迁移服务 (V13)
 * 职责：检查旧版数据库 MistakeStorageDB_${userId} (版本 2) 并在存在数据时迁移到
 * 新版多环境隔离的数据库 MistakeStorageDB_${userId}_${env} (版本 11) 中。
 */
export class V13MistakeStorageMigration {
  private static instance: V13MistakeStorageMigration

  public static getInstance(): V13MistakeStorageMigration {
    if (!V13MistakeStorageMigration.instance) {
      V13MistakeStorageMigration.instance = new V13MistakeStorageMigration()
    }
    return V13MistakeStorageMigration.instance
  }

  /**
   * 执行错题集迁移
   */
  public async run(): Promise<void> {
    try {
      const userId = getUserId()
      if (!userId) {
        console.log('[Migration-V13] 无用户 ID，跳过错题迁移')
        return
      }

      // 如果当前是 RELEASE 环境，或者获取的环境后缀为空，则新旧数据库名称相同，无需迁移
      const envType = getCurrentEnvType()
      if (envType === AppEnvType.RELEASE) {
        console.log('[Migration-V13] 当前是 RELEASE 环境，无需进行错题库多环境迁移')
        return
      }

      const oldDBName = `MistakeStorageDB_${userId}`
      
      console.log(`[Migration-V13] 🚀 开始检查旧版错题数据迁移 (从 ${oldDBName} 到新版环境库)...`)

      // 1. 初始化并连接旧版数据库
      // 旧版最高版本为 2
      const oldDB = IndexedDBService.getInstance({
        dbName: oldDBName,
        version: 2,
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
      })

      // 尝试初始化旧库，若失败则说明无旧库
      try {
        await oldDB.init()
      } catch (e) {
        console.log('[Migration-V13] 旧版错题数据库不存在或无法打开，跳过迁移')
        return
      }

      // 获取旧版所有错题
      let oldMistakes: any[] = []
      try {
        oldMistakes = await oldDB.getAll(STORE_NAMES.MISTAKES)
      } catch (e) {
        console.warn('[Migration-V13] 读取旧版错题数据失败或无数据:', e)
      }

      if (oldMistakes && oldMistakes.length > 0) {
        console.log(`[Migration-V13] 发现旧版错题数据 ${oldMistakes.length} 条，开始迁移...`)
        
        // 确保新版错题存储已完成初始化
        await initMistakeStorage()

        // 逐条写入新库
        for (const item of oldMistakes) {
          if (!item.bmNo) continue
          
          // 获取练习历史记录中的 originalAnswer, homeworkId, homeworkName
          const records = item.practiceHistory || []
          const firstRecord = records[0] || {}

          await addMistake({
            bmNo: item.bmNo,
            questionData: item.questionData,
            originalAnswer: firstRecord.originalAnswer,
            homeworkId: firstRecord.homeworkId,
            homeworkName: firstRecord.homeworkName
          })

          // 如果有多于一条的记录，我们可以直接通过底层的 IndexedDBService 补齐（以确保完整的 practiceHistory 迁移）
          // 因为 addMistake 只处理单次提交，对于历史全部需要保留的，我们直接在新库中更新它
          if (records.length > 1) {
            const newDB = IndexedDBService.getInstance({
              dbName: `MistakeStorageDB_${userId}_${envType}`,
              version: 11,
              stores: [
                {
                  name: STORE_NAMES.MISTAKES,
                  keyPath: 'bmNo'
                }
              ]
            })
            await newDB.init()
            const existingInNew = await newDB.get<any>(STORE_NAMES.MISTAKES, item.bmNo)
            if (existingInNew) {
              existingInNew.practiceHistory = records.slice(0, 10)
              existingInNew.timestamp = item.timestamp || existingInNew.timestamp
              existingInNew.lastPracticeTime = item.lastPracticeTime || existingInNew.lastPracticeTime
              await newDB.put(STORE_NAMES.MISTAKES, existingInNew)
            }
          }
        }

        console.log('[Migration-V13] ✅ 旧版错题数据导入新版库成功')

        // 迁移完成后清空并关闭旧数据库，然后删除旧数据库以释放空间并避免重复迁移
        try {
          oldDB.close()
          await IndexedDBService.deleteDatabase(oldDBName)
          console.log(`[Migration-V13] 🗑️ 成功删除旧版数据库: ${oldDBName}`)
        } catch (delError) {
          console.error(`[Migration-V13] ⚠️ 删除旧版数据库 ${oldDBName} 失败:`, delError)
        }
      } else {
        console.log('[Migration-V13] 旧版错题库中无数据，无需迁移')
        try {
          oldDB.close()
        } catch (e) {}
      }

    } catch (error) {
      console.error('[Migration-V13] 错题集数据迁移失败:', error)
    }
  }
}

import { chatStorage } from '@/services/storage/chat-storage'
import { DB_VERSIONS } from '@/services/storage/db-config'
import { V2StorageMigration } from './v2-storage-migration'
import { V12SessionStructureMigration } from './v12-session-structure-migration'
import { V13MistakeStorageMigration } from './v13-mistake-storage-migration'

interface MigrationStep {
  targetVersion: number
  name: string
  description: string
  run: () => Promise<void>
}

// 迁移注册表
const MIGRATION_STEPS: MigrationStep[] = [
  {
    targetVersion: 2,
    name: 'V2-Storage-Migration',
    description: '从旧版 localforage 迁移数据到 IndexedDB',
    run: () => V2StorageMigration.getInstance().runMigrations()
  },
  {
    targetVersion: 12,
    name: 'V12-Atomic-Sessions',
    description: '将打包数组格式重构为原子记录格式',
    run: () => V12SessionStructureMigration.getInstance().run()
  },
  {
    targetVersion: 13,
    name: 'V13-Mistake-Storage-Migration',
    description: '将旧版无多环境后缀的错题集迁移到带后缀的新库中',
    run: () => V13MistakeStorageMigration.getInstance().run()
  }
]

/**
 * 运行 ChatStorageDB 的所有数据迁移
 */
export async function runChatStorageMigrations(): Promise<void> {
  try {
    await chatStorage.initialize()

    const oldVersion = chatStorage.getDatabaseOldVersion()
    const currentVersion = DB_VERSIONS.CHAT_STORAGE

    console.log(`[Migrations:ChatStorage] 数据库版本: ${oldVersion} -> ${currentVersion}`)

    if (oldVersion === 0) {
      console.log('[Migrations:ChatStorage] 全新数据库，跳过数据迁移')
      return
    }

    if (oldVersion >= currentVersion) {
      console.log('[Migrations:ChatStorage] 数据库已是最新版本，无需迁移')
      return
    }

    for (let v = oldVersion + 1; v <= currentVersion; v++) {
      const step = MIGRATION_STEPS.find(m => m.targetVersion === v)
      if (step) {
        console.log(`[Migrations:ChatStorage] 应用版本 ${v}: ${step.name} (${step.description})`)
        await step.run()
      }
    }

    console.log('[Migrations:ChatStorage] 所有迁移完成')

  } catch (error) {
    console.error('[Migrations:ChatStorage] 运行迁移脚本失败:', error)
  }
}

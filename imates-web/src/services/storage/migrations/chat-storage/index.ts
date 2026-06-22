import { chatStorage } from '@/services/storage/chat-storage'
import { V2StorageMigration } from './v2-storage-migration'
import { V12SessionStructureMigration } from './v12-session-structure-migration'

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
  }
]

/**
 * 运行 ChatStorageDB 的所有数据迁移
 */
export async function runChatStorageMigrations(): Promise<void> {
  try {
    await chatStorage.initialize()

    // 强制执行所有迁移步骤，不判断版本号
    for (const step of MIGRATION_STEPS) {
      console.log(`[Migrations:ChatStorage] 强制应用迁移 ${step.targetVersion}: ${step.name} (${step.description})`)
      await step.run()
    }

    console.log('[Migrations:ChatStorage] 所有迁移完成')

  } catch (error) {
    console.error('[Migrations:ChatStorage] 运行迁移脚本失败:', error)
  }
}

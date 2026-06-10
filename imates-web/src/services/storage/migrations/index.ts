import { runChatStorageMigrations } from './chat-storage'

/**
 * 运行所有数据库的数据迁移
 * 每个数据库独立管理自己的迁移脚本
 */
export async function runAllMigrations(): Promise<void> {
  console.log('[Migrations] 开始执行全库数据迁移...')

  // ChatStorageDB 迁移（聊天、会话相关）
  runChatStorageMigrations().catch(err => {
    console.error('[Migrations] ChatStorage 迁移失败:', err)
  })

  // 未来其他数据库需要数据迁移时，在这里独立添加:
  // runTextbookMigrations().catch(err => { ... })
  // runMistakeMigrations().catch(err => { ... })
  // ...
}

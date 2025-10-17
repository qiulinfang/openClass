/**
 * IndexedDB 清理工具
 * 删除指定数据库中除保留表外的所有表
 */

class IndexedDBCleanup {
    constructor() {
        this.databases = {
            'TextbookStorage': ['textbooks', 'files'],
            'ExerciseSolveApp': ['chat_history']
        };
    }

    /**
     * 清理所有数据库
     */
    async cleanupAll() {
        console.log('🧹 开始清理 IndexedDB...');
        
        for (const [dbName, keepTables] of Object.entries(this.databases)) {
            await this.cleanupDatabase(dbName, keepTables);
        }
        
        console.log('✅ IndexedDB 清理完成');
    }

    /**
     * 清理指定数据库
     * @param {string} dbName 数据库名称
     * @param {string[]} keepTables 要保留的表名数组
     */
    async cleanupDatabase(dbName, keepTables) {
        return new Promise((resolve, reject) => {
            console.log(`🔍 检查数据库: ${dbName}`);
            
            // 先检查数据库是否存在
            const checkRequest = indexedDB.open(dbName);
            checkRequest.onsuccess = () => {
                const db = checkRequest.result;
                const currentVersion = db.version;
                db.close();
                
                // 获取所有表名
                const allTables = Array.from(db.objectStoreNames);
                const tablesToDelete = allTables.filter(table => !keepTables.includes(table));
                
                if (tablesToDelete.length === 0) {
                    console.log(`✅ ${dbName} 无需清理`);
                    resolve();
                    return;
                }
                
                console.log(`📋 ${dbName} 中的表:`, allTables);
                console.log(`🗑️ 将要删除的表:`, tablesToDelete);
                
                // 升级数据库版本以删除表
                const newVersion = currentVersion + 1;
                const upgradeRequest = indexedDB.open(dbName, newVersion);
                
                upgradeRequest.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    tablesToDelete.forEach(tableName => {
                        try {
                            console.log(`🗑️ 删除表: ${tableName}`);
                            db.deleteObjectStore(tableName);
                        } catch (error) {
                            console.error(`❌ 删除表 ${tableName} 失败:`, error);
                        }
                    });
                };
                
                upgradeRequest.onsuccess = () => {
                    console.log(`✅ ${dbName} 清理完成`);
                    upgradeRequest.result.close();
                    resolve();
                };
                
                upgradeRequest.onerror = () => {
                    console.error(`❌ 升级数据库 ${dbName} 失败:`, upgradeRequest.error);
                    reject(upgradeRequest.error);
                };
            };
            
            checkRequest.onerror = () => {
                console.log(`ℹ️ 数据库 ${dbName} 不存在，跳过清理`);
                resolve();
            };
        });
    }

    /**
     * 查看数据库信息
     */
    async inspectDatabases() {
        console.log('🔍 检查 IndexedDB 数据库...');
        
        for (const dbName of Object.keys(this.databases)) {
            try {
                const request = indexedDB.open(dbName);
                request.onsuccess = () => {
                    const db = request.result;
                    const tables = Array.from(db.objectStoreNames);
                    console.log(`📊 ${dbName} (v${db.version}):`, tables);
                    db.close();
                };
                request.onerror = () => {
                    console.log(`ℹ️ 数据库 ${dbName} 不存在`);
                };
            } catch (error) {
                console.error(`❌ 检查数据库 ${dbName} 失败:`, error);
            }
        }
    }

    /**
     * 删除整个数据库
     */
    async deleteEntireDatabase(dbName) {
        return new Promise((resolve, reject) => {
            console.log(`🗑️ 删除整个数据库: ${dbName}`);
            
            const deleteRequest = indexedDB.deleteDatabase(dbName);
            
            deleteRequest.onsuccess = () => {
                console.log(`✅ 数据库 ${dbName} 已删除`);
                resolve();
            };
            
            deleteRequest.onerror = () => {
                console.error(`❌ 删除数据库 ${dbName} 失败:`, deleteRequest.error);
                reject(deleteRequest.error);
            };
        });
    }
}

// 创建全局实例
window.indexedDBCleanup = new IndexedDBCleanup();

// 使用示例
console.log(`
🧹 IndexedDB 清理工具已加载

使用方法:
1. 查看数据库信息: indexedDBCleanup.inspectDatabases()
2. 清理所有数据库: indexedDBCleanup.cleanupAll()
3. 清理指定数据库: indexedDBCleanup.cleanupDatabase('TextbookStorage', ['textbooks', 'files'])
4. 删除整个数据库: indexedDBCleanup.deleteEntireDatabase('TextbookStorage')

保留的表:
- TextbookStorage: textbooks, files
- ExerciseSolveApp: chat_history
`);

// 导出供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IndexedDBCleanup;
}

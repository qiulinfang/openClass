/**
 * 通用IndexedDB服务类
 * 提供数据库初始化、CRUD操作、事务处理和错误处理
 */

export interface IndexedDBConfig {
  dbName: string // 数据库名称
  version: number // 数据库版本
  stores: StoreConfig[] // 存储配置
}

export interface StoreConfig {
  name: string // 存储名称
  keyPath: string // 主键路径
  autoIncrement?: boolean // 是否自动递增
  indexes?: IndexConfig[] // 索引配置
}

export interface IndexConfig {
  name: string // 索引名称
  keyPath: string | string[] // 索引键路径
  unique?: boolean // 是否唯一
  multiEntry?: boolean // 是否多条目
}

export interface QueryOptions {
  index?: string // 索引名称
  range?: IDBKeyRange // 键范围
  direction?: IDBCursorDirection // 游标方向
  limit?: number // 限制数量
}

export class IndexedDBService {
  private static instances: Map<string, IndexedDBService> = new Map()
  private db: IDBDatabase | null = null
  private config: IndexedDBConfig
  private isInitialized = false

  private constructor(config: IndexedDBConfig) {
    this.config = config
  }

  /**
   * 获取或创建IndexedDB服务实例
   */
  public static getInstance(config: IndexedDBConfig): IndexedDBService {
    const key = `${config.dbName}_${config.version}`
    if (!IndexedDBService.instances.has(key)) {
      IndexedDBService.instances.set(key, new IndexedDBService(config))
    }
    return IndexedDBService.instances.get(key)!
  }

  /**
   * 初始化数据库连接
   */
  public async init(): Promise<void> {
    if (this.isInitialized && this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version)

      request.onerror = () => {
        reject(new Error(`数据库打开失败: ${request.error?.message}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        this.createStores(db)
      }
    })
  }

  /**
   * 创建存储和索引
   */
  private createStores(db: IDBDatabase): void {
    this.config.stores.forEach(storeConfig => {
      // 如果存储已存在，先删除
      if (db.objectStoreNames.contains(storeConfig.name)) {
        db.deleteObjectStore(storeConfig.name)
      }

      // 创建存储
      const store = db.createObjectStore(storeConfig.name, {
        keyPath: storeConfig.keyPath,
        autoIncrement: storeConfig.autoIncrement
      })

      // 创建索引
      if (storeConfig.indexes) {
        storeConfig.indexes.forEach(indexConfig => {
          store.createIndex(
            indexConfig.name,
            indexConfig.keyPath,
            {
              unique: indexConfig.unique,
              multiEntry: indexConfig.multiEntry
            }
          )
        })
      }
    })
  }

  /**
   * 添加数据
   */
  public async add<T>(storeName: string, data: T): Promise<void> {
    await this.ensureInitialized()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.add(data)

      request.onsuccess = () => resolve()
      request.onerror = () => {
        reject(new Error(`添加数据失败: ${request.error?.message}`))
      }
    })
  }

  /**
   * 批量添加数据
   */
  public async addAll<T>(storeName: string, dataList: T[]): Promise<void> {
    await this.ensureInitialized()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      let completed = 0
      let hasError = false

      if (dataList.length === 0) {
        resolve()
        return
      }

      dataList.forEach(data => {
        const request = store.add(data)
        request.onsuccess = () => {
          completed++
          if (completed === dataList.length && !hasError) {
            resolve()
          }
        }
        request.onerror = () => {
          hasError = true
          reject(new Error(`批量添加数据失败: ${request.error?.message}`))
        }
      })
    })
  }

  /**
   * 根据主键获取数据
   */
  public async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    await this.ensureInitialized()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        reject(new Error(`获取数据失败: ${request.error?.message}`))
      }
    })
  }

  /**
   * 根据索引获取数据
   */
  public async getByIndex<T>(storeName: string, indexName: string, key: IDBValidKey): Promise<T | undefined> {
    await this.ensureInitialized()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const index = store.index(indexName)
      const request = index.get(key)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        reject(new Error(`根据索引获取数据失败: ${request.error?.message}`))
      }
    })
  }

  /**
   * 查询数据列表
   */
  public async query<T>(storeName: string, options: QueryOptions = {}): Promise<T[]> {
    await this.ensureInitialized()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      
      let source: IDBIndex | IDBObjectStore
      if (options.index) {
        source = store.index(options.index)
      } else {
        source = store
      }

      const request = source.openCursor(options.range, options.direction)
      const results: T[] = []
      let count = 0

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          results.push(cursor.value)
          count++
          
          // 检查是否达到限制
          if (options.limit && count >= options.limit) {
            resolve(results)
            return
          }
          
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => {
        reject(new Error(`查询数据失败: ${request.error?.message}`))
      }
    })
  }

  /**
   * 更新数据
   */
  public async update<T>(storeName: string, data: T): Promise<void> {
    await this.ensureInitialized()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.put(data)

      request.onsuccess = () => resolve()
      request.onerror = () => {
        reject(new Error(`更新数据失败: ${request.error?.message}`))
      }
    })
  }

  /**
   * 删除数据
   */
  public async delete(storeName: string, key: IDBValidKey): Promise<void> {
    await this.ensureInitialized()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => {
        reject(new Error(`删除数据失败: ${request.error?.message}`))
      }
    })
  }

  /**
   * 清空存储
   */
  public async clear(storeName: string): Promise<void> {
    await this.ensureInitialized()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => {
        reject(new Error(`清空存储失败: ${request.error?.message}`))
      }
    })
  }

  /**
   * 获取存储中的数据总数
   */
  public async count(storeName: string): Promise<number> {
    await this.ensureInitialized()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.count()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        reject(new Error(`获取数据总数失败: ${request.error?.message}`))
      }
    })
  }

  /**
   * 检查数据是否存在
   */
  public async exists(storeName: string, key: IDBValidKey): Promise<boolean> {
    const data = await this.get(storeName, key)
    return data !== undefined
  }

  /**
   * 获取所有数据
   */
  public async getAll<T>(storeName: string): Promise<T[]> {
    return this.query<T>(storeName)
  }

  /**
   * 分页查询数据
   */
  public async getPage<T>(
    storeName: string, 
    page: number, 
    pageSize: number, 
    options: QueryOptions = {}
  ): Promise<{ data: T[]; total: number; page: number; pageSize: number }> {
    const total = await this.count(storeName)
    
    // 使用游标跳过前面的数据
    const data = await this.query<T>(storeName, {
      ...options,
      limit: pageSize
    })

    return {
      data,
      total,
      page,
      pageSize
    }
  }

  /**
   * 关闭数据库连接
   */
  public close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.isInitialized = false
    }
  }

  /**
   * 删除数据库
   */
  public static async deleteDatabase(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName)
      
      request.onsuccess = () => resolve()
      request.onerror = () => {
        reject(new Error(`删除数据库失败: ${request.error?.message}`))
      }
    })
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init()
    }
  }

  /**
   * 获取数据库信息
   */
  public getDatabaseInfo(): { name: string; version: number; stores: string[] } {
    return {
      name: this.config.dbName,
      version: this.config.version,
      stores: this.config.stores.map(store => store.name)
    }
  }
}

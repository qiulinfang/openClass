/**
 * 通用IndexedDB服务类
 * 提供数据库初始化、CRUD操作、事务处理和错误处理
 */

import { MiniAppStorageService } from './miniapp-storage-service'

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
  private miniAppStorage: MiniAppStorageService | null = null
  private config: IndexedDBConfig
  public isInitialized = false
  private initPromise: Promise<void> | null = null

  private constructor(config: IndexedDBConfig) {
    this.config = config
    // 检查是否在小程序环境或 indexedDB 不可用的环境
    if (typeof indexedDB === 'undefined') {
      this.miniAppStorage = MiniAppStorageService.getInstance(config)
    }
  }

  /**
   * 深度序列化对象，确保可以存储到IndexedDB
   * 处理函数、日期、ArrayBuffer、Uint8Array、循环引用等不可克隆的数据
   * @param obj 要序列化的对象
   * @returns 序列化后的对象
   */
  public static deepSerialize<T = unknown>(obj: unknown): T {
    // 处理基础类型和null/undefined
    if (obj === null || obj === undefined) {
      return obj as T
    }
    
    // 排除函数
    if (typeof obj === 'function') {
      return undefined as T
    }
    
    // 处理日期对象
    if (obj instanceof Date) {
      return obj.toISOString() as T
    }
    
    // 处理ArrayBuffer - 转换为Uint8Array以便序列化
    if (obj instanceof ArrayBuffer) {
      return new Uint8Array(obj) as T
    }
    
    // 处理Uint8Array - IndexedDB可以直接存储Uint8Array
    if (obj instanceof Uint8Array) {
      return obj as T
    }
    
    // 处理数组
    if (Array.isArray(obj)) {
      return obj.map(item => IndexedDBService.deepSerialize(item)).filter(item => item !== undefined) as T
    }
    
    // 处理对象
    if (typeof obj === 'object') {
      const serialized: Record<string, unknown> = {}
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = IndexedDBService.deepSerialize((obj as Record<string, unknown>)[key])
          if (value !== undefined) {
            serialized[key] = value
          }
        }
      }
      return serialized as T
    }
    
    // 基础类型直接返回
    return obj as T
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
    if (this.miniAppStorage) {
      this.isInitialized = true
      return Promise.resolve()
    }
    
    if (this.isInitialized && this.db) {
      return
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve, reject) => {
      console.log(`[IndexedDB] 正在打开数据库: ${this.config.dbName}, 版本: ${this.config.version}`)
      const request = indexedDB.open(this.config.dbName, this.config.version)

      request.onerror = () => {
        this.initPromise = null
        reject(new Error(`数据库打开失败: ${request.error?.message}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true
        this.initPromise = null
        
        // 监听版本变更（比如其它页面升级了数据库）
        this.db.onversionchange = () => {
          console.warn(`[IndexedDB] 数据库 ${this.config.dbName} 版本正在变更，关闭连接`)
          this.close()
        }

        // 监听连接断开或关闭
        this.db.onclose = () => {
          console.warn(`[IndexedDB] 数据库 ${this.config.dbName} 连接已关闭`)
          this.isInitialized = false
          this.db = null
        }

        // 确保所有存储都存在
        this.ensureStoresExist()
        resolve()
      }

      request.onupgradeneeded = (event) => {
        console.log(`[IndexedDB] 数据库 ${this.config.dbName} 需要升级/初始化`)
        const db = (event.target as IDBOpenDBRequest).result
        const transaction = (event.target as IDBOpenDBRequest).transaction
        this.createStores(db, transaction)
      }

      request.onblocked = () => {
        console.warn(`[IndexedDB] 数据库 ${this.config.dbName} 被阻塞，请关闭其它标签页`)
      }
    })

    return this.initPromise
  }

  /**
   * 创建存储和索引
   * @param db 数据库对象
   * @param transaction 版本升级事务（在 onupgradeneeded 事件中传入）
   */
  private createStores(db: IDBDatabase, transaction: IDBTransaction | null = null): void {
    this.config.stores.forEach(storeConfig => {
      let store: IDBObjectStore
      
      // 如果存储不存在，创建存储
      if (!db.objectStoreNames.contains(storeConfig.name)) {
        // 创建存储（在 upgradeneeded 事件中可以直接创建）
        // 新创建的 objectStore 会自动加入到版本升级事务中
        store = db.createObjectStore(storeConfig.name, {
          keyPath: storeConfig.keyPath,
          autoIncrement: storeConfig.autoIncrement
        })
      } else {
        // 存储已存在，需要通过版本升级事务获取现有存储（用于在升级时添加索引）
        // 在 upgradeneeded 事件中，不能创建新事务，必须使用版本升级事务
        // 版本升级事务包含数据库中的所有 objectStore
        if (!transaction) {
          throw new Error(`无法访问已存在的存储 ${storeConfig.name}：必须在版本升级事务中`)
        }
        try {
          store = transaction.objectStore(storeConfig.name)
        } catch (error) {
          // 如果 objectStore 不在事务中（理论上不应该发生），抛出更详细的错误
          throw new Error(`无法从版本升级事务中获取存储 ${storeConfig.name}：${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // 创建索引（检查索引是否已存在，避免重复创建）
      if (storeConfig.indexes) {
        storeConfig.indexes.forEach(indexConfig => {
          // 检查索引是否已存在
          if (!store.indexNames.contains(indexConfig.name)) {
            try {
              store.createIndex(
                indexConfig.name,
                indexConfig.keyPath,
                {
                  unique: indexConfig.unique,
                  multiEntry: indexConfig.multiEntry
                }
              )
            } catch (error: any) {
              // 如果索引创建失败（可能已存在或参数不匹配），记录警告
              console.warn(`[IndexedDB] ⚠️ 创建索引失败: ${storeConfig.name}.${indexConfig.name}`, error.message)
            }
          } else {
          }
        })
      }
    })
  }

  /**
   * 确保所有存储都存在（用于已存在的数据库）
   */
  private ensureStoresExist(): void {
    if (!this.db) return
    
    this.config.stores.forEach(storeConfig => {
      if (!this.db!.objectStoreNames.contains(storeConfig.name)) {
        console.warn(`存储 ${storeConfig.name} 不存在，需要升级数据库版本`)
        // 这里可以触发数据库升级或者使用降级方案
      }
    })
  }

  /**
   * 添加数据
   * @param autoSerialize 是否自动进行深度序列化（默认true）
   */
  public async add<T>(storeName: string, data: T, autoSerialize = true): Promise<void> {
    if (this.miniAppStorage) {
      return this.miniAppStorage.put(storeName, data)
    }
    await this.ensureInitialized()
    
    // 自动序列化数据，确保可以存储到IndexedDB
    const serializedData = autoSerialize ? IndexedDBService.deepSerialize<T>(data) : data
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.add(serializedData)

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
    if (this.miniAppStorage) {
      return this.miniAppStorage.get<T>(storeName, key as string)
    }
    await this.ensureInitialized()
    
    // 检查存储是否存在
    if (!this.db!.objectStoreNames.contains(storeName)) {
      console.warn(`[IndexedDB.get] 存储 ${storeName} 不存在，返回 undefined`)
      return undefined
    }
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        
        const request = store.get(key)
        
        request.onsuccess = () => {
          const result = request.result
          resolve(result)
        }
        request.onerror = () => {
          console.error(`[IndexedDB.get] 查询失败:`, {
            storeName,
            queryKey: key,
            queryKeyType: typeof key,
            error: request.error?.message,
            errorCode: request.error?.code,
            errorName: request.error?.name
          })
          reject(new Error(`获取数据失败: ${request.error?.message}`))
        }
      } catch (error) {
        console.error(`[IndexedDB.get] 创建事务失败:`, {
          storeName,
          queryKey: key,
          queryKeyType: typeof key,
          error
        })
        reject(new Error(`创建事务失败: ${error}`))
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
    
    // 检查存储是否存在
    if (!this.db!.objectStoreNames.contains(storeName)) {
      console.warn(`存储 ${storeName} 不存在，返回空数组`)
      return []
    }
    
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
   * @param autoSerialize 是否自动进行深度序列化（默认true）
   * @returns Promise<boolean> 返回更新是否成功
   */
  public async update<T>(storeName: string, data: T, autoSerialize = true): Promise<boolean> {
    if (this.miniAppStorage) {
      await this.miniAppStorage.put(storeName, data)
      return true
    }
    await this.ensureInitialized()
    
    // 自动序列化数据，确保可以存储到IndexedDB
    const serializedData = autoSerialize ? IndexedDBService.deepSerialize<T>(data) : data
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.put(serializedData)

      request.onsuccess = () => {
        resolve(true)
      }
      request.onerror = () => {
        console.error(`更新数据失败: ${request.error?.message}`)
        reject(new Error(`更新数据失败: ${request.error?.message}`))
      }
    })
  }

  /**
   * 添加或更新数据（put方法的别名）
   * @param autoSerialize 是否自动进行深度序列化（默认true）
   * @returns Promise<boolean> 返回操作是否成功
   */
  public async put<T>(storeName: string, data: T, autoSerialize = true): Promise<boolean> {
    return this.update(storeName, data, autoSerialize)
  }

  /**
   * 删除数据
   */
  public async delete(storeName: string, key: IDBValidKey): Promise<void> {
    if (this.miniAppStorage) {
      return this.miniAppStorage.delete(storeName, key as string)
    }
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
    if (this.miniAppStorage) {
      return this.miniAppStorage.clear(storeName)
    }
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
    if (this.miniAppStorage) {
      return this.miniAppStorage.getAll<T>(storeName)
    }
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

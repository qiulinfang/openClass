/**
 * 小程序本地存储服务
 * 使用 uni.getStorage/setStorage 模拟 IndexedDB 的基本 CRUD 操作
 * 适配小程序环境，替代 IndexedDB
 */

export class MiniAppStorageService {
  private static instances: Map<string, MiniAppStorageService> = new Map()
  private dbName: string

  private constructor(dbName: string) {
    this.dbName = dbName
  }

  public static getInstance(config: { dbName: string }): MiniAppStorageService {
    if (!MiniAppStorageService.instances.has(config.dbName)) {
      MiniAppStorageService.instances.set(config.dbName, new MiniAppStorageService(config.dbName))
    }
    return MiniAppStorageService.instances.get(config.dbName)!
  }

  /**
   * 模拟初始化
   */
  public async init(): Promise<void> {
    return Promise.resolve()
  }

  public get isInitialized(): boolean {
    return true
  }

  /**
   * 获取存储键名
   */
  private getStoreKey(storeName: string): string {
    return `DB_${this.dbName}_${storeName}`
  }

  /**
   * 获取所有数据
   */
  private async getStoreData<T>(storeName: string): Promise<T[]> {
    const key = this.getStoreKey(storeName)
    try {
      const res = uni.getStorageSync(key)
      return res ? (JSON.parse(res) as T[]) : []
    } catch (e) {
      console.error('[MiniAppStorage] 读取失败:', e)
      return []
    }
  }

  /**
   * 保存所有数据
   */
  private async saveStoreData<T>(storeName: string, data: T[]): Promise<void> {
    const key = this.getStoreKey(storeName)
    try {
      uni.setStorageSync(key, JSON.stringify(data))
    } catch (e) {
      console.error('[MiniAppStorage] 写入失败:', e)
    }
  }

  /**
   * 获取单条数据
   */
  public async get<T>(storeName: string, key: string | number): Promise<T | undefined> {
    const data = await this.getStoreData<any>(storeName)
    // 假设主键是 bmNo 或 id，这里需要根据具体情况适配
    // 在 mistake-storage 中使用的是 bmNo
    return data.find((item: any) => item.bmNo === key || item.id === key)
  }

  /**
   * 添加或更新数据
   */
  public async put<T>(storeName: string, data: T): Promise<void> {
    const list = await this.getStoreData<any>(storeName)
    const item = data as any
    const id = item.bmNo || item.id
    
    const index = list.findIndex((i: any) => (i.bmNo && i.bmNo === id) || (i.id && i.id === id))
    
    if (index > -1) {
      list[index] = data
    } else {
      list.push(data)
    }
    
    await this.saveStoreData(storeName, list)
  }

  /**
   * 获取所有数据
   */
  public async getAll<T>(storeName: string): Promise<T[]> {
    return this.getStoreData<T>(storeName)
  }

  /**
   * 删除数据
   */
  public async delete(storeName: string, key: string | number): Promise<void> {
    const list = await this.getStoreData<any>(storeName)
    const newList = list.filter((item: any) => item.bmNo !== key && item.id !== key)
    await this.saveStoreData(storeName, newList)
  }

  /**
   * 清空存储
   */
  public async clear(storeName: string): Promise<void> {
    await this.saveStoreData(storeName, [])
  }
}

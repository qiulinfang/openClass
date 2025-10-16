/**
 * 资源管理服务
 * 对应Android LearnResourceManager，提供统一的资源管理功能
 */

import { apiService } from './api-service'
import { IndexedDBService } from './indexeddb-service'
import CryptoJS from 'crypto-js'
import type {
  UserTextbookInfo,
  TextbookVersion,
  LocalPackageInfo,
  UserLearnData
} from '../types'

export interface ResourceManagerCallbacks {
  onSuccess?: (data: unknown) => void
  onError?: (error: string) => void
  onProgress?: (progress: number) => void
}

export interface AllTextbooksCallback {
  onSuccess: (textbooks: UserTextbookInfo[]) => void
  onError: (error: string) => void
}

export interface UpdateCheckCallback {
  onUpdateAvailable: (updatedTextbooks: TextbookVersion[]) => void
  onNoUpdates: () => void
  onError: (error: string) => void
}

export interface TextbookPackagesCallback {
  onSuccess: (packages: LocalPackageInfo[]) => void
  onError: (error: string) => void
}

export interface DownloadCallback {
  onSuccess: () => void
  onError: (error: string) => void
  onProgress: (progress: number) => void
}

export class ResourceManager {
  private static instance: ResourceManager
  private currentToken: string | null = null
  private currentUsername: string | null = null
  private userLearnData: UserLearnData | null = null
  private indexedDB: IndexedDBService

  private constructor() {
    // 初始化IndexedDB配置
    this.indexedDB = IndexedDBService.getInstance({
      dbName: 'TextbookStorage',
      version: 1,
      stores: [
        {
          name: 'userData',
          keyPath: 'username',
          indexes: [
            { name: 'lastSyncTime', keyPath: 'lastSyncTime' }
          ]
        },
        {
          name: 'textbooks',
          keyPath: 'textbookId',
          indexes: [
            { name: 'userId', keyPath: 'userId' },
            { name: 'isDownloaded', keyPath: 'isDownloaded' },
            { name: 'downloadStatus', keyPath: 'downloadStatus' },
            { name: 'lastDownloadTime', keyPath: 'lastDownloadTime' }
          ]
        },
        {
          name: 'packages',
          keyPath: 'packageId',
          indexes: [
            { name: 'textbookId', keyPath: 'textbookId' },
            { name: 'userId', keyPath: 'userId' },
            { name: 'downloadStatus', keyPath: 'downloadStatus' }
          ]
        },
        {
          name: 'files',
          keyPath: 'id',
          indexes: [
            { name: 'packageId', keyPath: 'packageId' },
            { name: 'textbookId', keyPath: 'textbookId' },
            { name: 'userId', keyPath: 'userId' },
            { name: 'isDownloaded', keyPath: 'isDownloaded' }
          ]
        }
      ]
    })
    
    this.loadUserData()
  }

  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager()
    }
    return ResourceManager.instance
  }

  /**
   * 检查是否已登录
   */
  public isLoggedIn(): boolean {
    const token = localStorage.getItem('YANBAN_TOKEN')
    const userId = localStorage.getItem('studentUserId')
    return !!(token && userId && token !== 'undefined' && userId !== 'undefined')
  }

  /**
   * 获取当前用户信息
   */
  public getCurrentUser(): { token: string; username: string } | null {
    const token = localStorage.getItem('YANBAN_TOKEN')
    const userId = localStorage.getItem('studentUserId')
    
    if (token && userId && token !== 'undefined' && userId !== 'undefined') {
      return { token, username: userId }
    }
    return null
  }

  /**
   * 加载用户数据
   */
  private async loadUserData(): Promise<void> {
    try {
      await this.indexedDB.init()
      const userInfo = this.getCurrentUser()
      if (userInfo) {
        this.currentToken = userInfo.token
        this.currentUsername = userInfo.username
        this.userLearnData = await this.loadUserLearnDataFromStorage()
      }
    } catch (error) {
      console.error('初始化IndexedDB失败:', error)
      // 降级到localStorage
      this.loadUserDataFromLocalStorage()
    }
  }

  /**
   * 从IndexedDB加载用户学习数据
   */
  private async loadUserLearnDataFromStorage(): Promise<UserLearnData | null> {
    try {
      if (!this.currentUsername) return null
      
      const userData = await this.indexedDB.get('userData', this.currentUsername)
      if (userData) {
        return userData as UserLearnData
      }
      
      // 如果IndexedDB中没有数据，尝试从localStorage迁移
      return this.migrateFromLocalStorage()
    } catch (error) {
      console.error('从IndexedDB加载用户学习数据失败:', error)
      return this.migrateFromLocalStorage()
    }
  }

  /**
   * 从localStorage迁移数据到IndexedDB
   */
  private migrateFromLocalStorage(): UserLearnData | null {
    try {
      const data = localStorage.getItem(`user_learn_data_${this.currentUsername}`)
      if (data) {
        const userData = JSON.parse(data) as UserLearnData
        // 异步保存到IndexedDB
        this.saveUserLearnDataToStorage(userData)
        return userData
      }
    } catch (error) {
      console.error('从localStorage迁移数据失败:', error)
    }
    return null
  }

  /**
   * 降级到localStorage的加载方法
   */
  private loadUserDataFromLocalStorage(): void {
    const userInfo = this.getCurrentUser()
    if (userInfo) {
      this.currentToken = userInfo.token
      this.currentUsername = userInfo.username
      this.userLearnData = this.migrateFromLocalStorage()
    }
  }

  /**
   * 保存用户学习数据到IndexedDB
   */
  private async saveUserLearnDataToStorage(data: UserLearnData): Promise<void> {
    try {
      await this.indexedDB.update('userData', data)
      
      // 同时保存教材数据到textbooks存储
      if (data.textbooks && data.textbooks.length > 0) {
        const textbookData = data.textbooks.map(textbook => ({
          ...textbook,
          userId: this.currentUsername
        }))
        await this.indexedDB.addAll('textbooks', textbookData)
      }
    } catch (error) {
      console.error('保存用户学习数据到IndexedDB失败:', error)
      // 降级到localStorage
      try {
        localStorage.setItem(`user_learn_data_${this.currentUsername}`, JSON.stringify(data))
      } catch (localError) {
        console.error('保存用户学习数据到localStorage也失败:', localError)
      }
    }
  }

  /**
   * 获取用户所有在线教材
   * 对应Android LearnResourceManager.fetchUserAllOnlineTextbooks
   * 使用与安卓原生一致的数据获取策略：优先服务器数据，与本地数据合并
   */
  public async fetchUserAllOnlineTextbooks(callback: AllTextbooksCallback): Promise<void> {
    try {
      // 1. 先获取服务器教材版本数据
      const serverTextbooks = await apiService.fetchUserAllOnlineTextbooks()
      
      // 2. 获取本地用户学习数据
      const localData = this.userLearnData || await this.loadUserLearnDataFromStorage()
      
      // 3. 合并服务器数据和本地数据（与安卓原生逻辑一致）
      const mergedTextbooks = this.mergeServerAndLocalData(serverTextbooks, localData?.textbooks || [])
      
      // 4. 更新本地用户学习数据
      if (this.userLearnData) {
        this.userLearnData.textbooks = mergedTextbooks
        this.userLearnData.lastSyncTime = new Date().toISOString()
        await this.saveUserLearnDataToStorage(this.userLearnData)
      }
      
      callback.onSuccess(mergedTextbooks)
    } catch (error) {
      // 网络错误时返回本地数据
      const localTextbooks = this.userLearnData?.textbooks || []
      if (localTextbooks.length > 0) {
        callback.onSuccess(localTextbooks)
      } else {
        callback.onError(error instanceof Error ? error.message : '获取在线教材失败')
      }
    }
  }

  /**
   * 获取用户所有本地教材
   * 对应Android LearnResourceManager.loadUserAllLocalTextbooks
   * 使用与安卓原生一致的数据获取策略：优先服务器数据，与本地数据合并
   */
  public async loadUserAllLocalTextbooks(callback: AllTextbooksCallback): Promise<void> {
    try {
      // 1. 先获取服务器教材版本数据
      const serverTextbooks = await apiService.loadUserAllLocalTextbooks()
      
      // 2. 获取本地用户学习数据
      const localData = this.userLearnData || await this.loadUserLearnDataFromStorage()
      
      // 3. 合并服务器数据和本地数据（与安卓原生逻辑一致）
      const mergedTextbooks = this.mergeServerAndLocalData(serverTextbooks, localData?.textbooks || [])
      
      // 4. 更新本地用户学习数据
      if (this.userLearnData) {
        this.userLearnData.textbooks = mergedTextbooks
        await this.saveUserLearnDataToStorage(this.userLearnData)
      }
      
      callback.onSuccess(mergedTextbooks)
    } catch (error) {
      // 网络错误时返回本地数据
      const localTextbooks = this.userLearnData?.textbooks || []
      if (localTextbooks.length > 0) {
        callback.onSuccess(localTextbooks)
      } else {
        callback.onError(error instanceof Error ? error.message : '获取本地教材失败')
      }
    }
  }

  /**
   * 检查教材更新
   * 对应Android LearnResourceManager.checkForUpdates
   */
  public async checkForUpdates(callback: UpdateCheckCallback): Promise<void> {
    try {
      const updatedTextbooks = await apiService.checkForUpdates()
      
      if (updatedTextbooks.length > 0) {
        callback.onUpdateAvailable(updatedTextbooks)
      } else {
        callback.onNoUpdates()
      }
    } catch (error) {
      callback.onError(error instanceof Error ? error.message : '检查更新失败')
    }
  }

  /**
   * 下载教材资源
   * 对应Android LearnResourceManager.downloadTextbook
   */
  public async downloadTextbook(id: string, callback: DownloadCallback): Promise<void> {
    try {
      const success = await apiService.downloadTextbook(id, (progress) => {
        callback.onProgress(progress)
      })
      
      if (success) {
        callback.onSuccess()
      } else {
        callback.onError('下载失败')
      }
    } catch (error) {
      callback.onError(error instanceof Error ? error.message : '下载失败')
    }
  }

  /**
   * 暂停教材下载
   * 对应Android LearnResourceManager.pauseDownload
   */
  public async pauseDownload(id: string, callback: ResourceManagerCallbacks): Promise<void> {
    try {
      const success = await apiService.pauseDownload(id)
      
      if (success) {
        callback.onSuccess?.('暂停成功')
      } else {
        callback.onError?.('暂停失败')
      }
    } catch (error) {
      callback.onError?.(error instanceof Error ? error.message : '暂停失败')
    }
  }

  /**
   * 删除教材资源
   * 对应Android LearnResourceManager.deleteTextbook
   */
  public async deleteTextbook(id: string, callback: ResourceManagerCallbacks): Promise<void> {
    try {
      const success = await apiService.deleteTextbook(id)
      
      if (success) {
        // 从IndexedDB中删除教材数据
        if (this.userLearnData) {
          this.userLearnData.textbooks = this.userLearnData.textbooks.filter(
            t => t.textbookId !== id
          )
          await this.saveUserLearnDataToStorage(this.userLearnData)
        }
        
        // 删除相关的资源包和文件数据
        try {
          await this.indexedDB.delete('textbooks', id)
          // 删除相关的资源包
          const packages = await this.indexedDB.query('packages', { 
            index: 'textbookId', 
            range: IDBKeyRange.only(id) 
          })
          for (const pkg of packages) {
            await this.indexedDB.delete('packages', (pkg as any).packageId)
            // 删除相关的文件
            const files = await this.indexedDB.query('files', { 
              index: 'packageId', 
              range: IDBKeyRange.only((pkg as any).packageId) 
            })
            for (const file of files) {
              await this.indexedDB.delete('files', (file as any).id)
            }
          }
        } catch (dbError) {
          console.error('从IndexedDB删除教材数据失败:', dbError)
        }
        
        callback.onSuccess?.('删除成功')
      } else {
        callback.onError?.('删除失败')
      }
    } catch (error) {
      callback.onError?.(error instanceof Error ? error.message : '删除失败')
    }
  }

  /**
   * 获取教材资源包信息
   * 对应Android LearnResourceManager.getTextbookPackagesWithLocalFiles
   */
  public async getTextbookPackagesWithLocalFiles(
    id: string, 
    callback: TextbookPackagesCallback
  ): Promise<void> {
    try {
      const packages = await apiService.getTextbookPackagesWithLocalFiles(id)
      callback.onSuccess(packages)
    } catch (error) {
      callback.onError(error instanceof Error ? error.message : '获取资源包失败')
    }
  }

  /**
   * 获取资源文件下载URL
   * 对应Android LearnResourceManager.getResourceDownloadUrl
   */
  public async getResourceDownloadUrl(resourceId: string): Promise<string | null> {
    try {
      return await apiService.getResourceDownloadUrl(resourceId)
    } catch (error) {
      console.error('获取资源下载URL失败:', error)
      return null
    }
  }

  /**
   * 验证资源文件完整性
   * 对应Android LearnResourceManager.verifyResourceIntegrity
   */
  public async verifyResourceIntegrity(resourceId: string, checksum: string): Promise<boolean> {
    try {
      return await apiService.verifyResourceIntegrity(resourceId, checksum)
    } catch (error) {
      console.error('验证资源完整性失败:', error)
      return false
    }
  }

  /**
   * 验证本地文件完整性（Web端实现）
   * 使用crypto-js计算MD5校验和
   * @param fileData 文件数据
   * @param expectedChecksum 期望的校验和
   * @returns 校验是否通过
   */
  public async verifyLocalFileIntegrity(fileData: Uint8Array, expectedChecksum: string): Promise<boolean> {
    try {
      // 使用crypto-js计算MD5
      const wordArray = CryptoJS.lib.WordArray.create(fileData)
      const hashHex = CryptoJS.MD5(wordArray).toString()
      
      const isValid = hashHex === expectedChecksum.toLowerCase()
      console.log(`文件校验: 期望=${expectedChecksum}, 实际=${hashHex}, 结果=${isValid}`)
      
      return isValid
    } catch (error) {
      console.error('本地文件校验失败:', error)
      return false
    }
  }

  /**
   * 验证本地存储文件的完整性
   * @param fileId 文件ID
   * @param expectedChecksum 期望的校验和
   * @returns 校验是否通过
   */
  public async verifyStoredFileIntegrity(fileId: string, expectedChecksum: string): Promise<boolean> {
    try {
      // 从IndexedDB获取文件数据
      const fileData = await this.indexedDB.get('files', fileId) as any
      if (!fileData || !fileData.fileContent) {
        console.warn(`文件 ${fileId} 不存在或没有内容`)
        return false
      }

      // 将存储的数据转换为Uint8Array
      const fileBytes = new Uint8Array(fileData.fileContent)
      
      // 验证文件完整性
      return await this.verifyLocalFileIntegrity(fileBytes, expectedChecksum)
    } catch (error) {
      console.error('验证存储文件完整性失败:', error)
      return false
    }
  }

  /**
   * 初始化用户学习数据
   */
  public async initializeUserLearnData(username: string): Promise<void> {
    this.currentUsername = username
    this.userLearnData = {
      username,
      lastSyncTime: new Date().toISOString(),
      textbooks: []
    }
    await this.saveUserLearnDataToStorage(this.userLearnData)
  }

  /**
   * 获取用户学习数据
   */
  public getUserLearnData(): UserLearnData | null {
    return this.userLearnData
  }

  /**
   * 更新教材信息
   */
  public async updateTextbookInfo(textbook: UserTextbookInfo): Promise<void> {
    if (this.userLearnData) {
      const index = this.userLearnData.textbooks.findIndex(t => t.textbookId === textbook.textbookId)
      if (index >= 0) {
        this.userLearnData.textbooks[index] = textbook
      } else {
        this.userLearnData.textbooks.push(textbook)
      }
      await this.saveUserLearnDataToStorage(this.userLearnData)
    }
  }

  /**
   * 合并服务器数据和本地数据
   * 对应Android LearnResourceManager中的数据合并逻辑
   */
  private mergeServerAndLocalData(serverTextbooks: UserTextbookInfo[], localTextbooks: UserTextbookInfo[]): UserTextbookInfo[] {
    const mergedTextbooks: UserTextbookInfo[] = []
    
    // 1. 先添加所有服务器教材
    serverTextbooks.forEach(serverTextbook => {
      // 查找对应的本地教材
      const localTextbook = localTextbooks.find(local => local.textbookId === serverTextbook.textbookId)
      
      if (localTextbook) {
        // 合并服务器和本地数据
        const mergedTextbook: UserTextbookInfo = {
          ...serverTextbook,
          // 保留本地下载状态和进度信息
          isDownloaded: localTextbook.isDownloaded || false,
          downloadStatus: localTextbook.downloadStatus || 0,
          downloadedFiles: localTextbook.downloadedFiles || 0,
          totalFiles: localTextbook.totalFiles || 0,
          downloadPath: localTextbook.downloadPath || '',
          lastDownloadTime: localTextbook.lastDownloadTime || '',
          // 更新服务器数据
          textbookName: serverTextbook.textbookName,
          textbookSubjectLabel: serverTextbook.textbookSubjectLabel,
          textbookGradeLabel: serverTextbook.textbookGradeLabel,
          textbookSemesterLabel: serverTextbook.textbookSemesterLabel,
          textbookPublisher: serverTextbook.textbookPublisher,
          textbookCover: serverTextbook.textbookCover,
          textbookUpdateTime: serverTextbook.textbookUpdateTime
        }
        mergedTextbooks.push(mergedTextbook)
      } else {
        // 服务器新教材，添加到列表
        mergedTextbooks.push({
          ...serverTextbook,
          isDownloaded: false,
          downloadStatus: 0,
          downloadedFiles: 0,
          totalFiles: 0,
          downloadPath: '',
          lastDownloadTime: ''
        })
      }
    })
    
    // 2. 添加本地独有的教材（如果存在）
    localTextbooks.forEach(localTextbook => {
      const existsInServer = serverTextbooks.some(server => server.textbookId === localTextbook.textbookId)
      if (!existsInServer) {
        mergedTextbooks.push(localTextbook)
      }
    })
    
    return mergedTextbooks
  }

  /**
   * 清理过期数据
   */
  public async cleanupExpiredData(): Promise<void> {
    try {
      // 清理IndexedDB中的过期数据
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      // 清理过期的用户数据
      const userDataList = await this.indexedDB.getAll('userData')
      for (const userData of userDataList) {
        const lastSyncTime = new Date((userData as any).lastSyncTime)
        if (lastSyncTime < thirtyDaysAgo) {
          await this.indexedDB.delete('userData', (userData as any).username)
          // 同时删除相关的教材、资源包和文件数据
          await this.cleanupUserRelatedData((userData as any).username)
        }
      }
      
      // 清理localStorage中的过期数据（作为备用）
      const keys = Object.keys(localStorage)
      const resourceKeys = keys.filter(key => key.startsWith('user_learn_data_'))
      
      resourceKeys.forEach(key => {
        const data = localStorage.getItem(key)
        if (data) {
          try {
            const userData = JSON.parse(data)
            const lastSyncTime = new Date(userData.lastSyncTime)
            const now = new Date()
            const daysDiff = (now.getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60 * 24)
            
            // 删除超过30天的数据
            if (daysDiff > 30) {
              localStorage.removeItem(key)
            }
          } catch {
            localStorage.removeItem(key)
          }
        }
      })
    } catch (error) {
      console.error('清理过期数据失败:', error)
    }
  }

  /**
   * 清理用户相关的所有数据
   */
  private async cleanupUserRelatedData(username: string): Promise<void> {
    try {
      // 删除用户的教材数据
      const textbooks = await this.indexedDB.query('textbooks', { 
        index: 'userId', 
        range: IDBKeyRange.only(username) 
      })
      for (const textbook of textbooks) {
        await this.indexedDB.delete('textbooks', (textbook as any).textbookId)
      }
      
      // 删除用户的资源包数据
      const packages = await this.indexedDB.query('packages', { 
        index: 'userId', 
        range: IDBKeyRange.only(username) 
      })
      for (const pkg of packages) {
        await this.indexedDB.delete('packages', (pkg as any).packageId)
      }
      
      // 删除用户的文件数据
      const files = await this.indexedDB.query('files', { 
        index: 'userId', 
        range: IDBKeyRange.only(username) 
      })
      for (const file of files) {
        await this.indexedDB.delete('files', (file as any).id)
      }
    } catch (error) {
      console.error('清理用户相关数据失败:', error)
    }
  }
}

// 创建默认的资源管理器实例
export const resourceManager = ResourceManager.getInstance()

/**
 * 资源管理服务
 * 对应Android LearnResourceManager，提供统一的资源管理功能
 */

import { apiService } from './api-service'
import { IndexedDBService } from './indexeddb-service'
import CryptoJS from 'crypto-js'
import type {
  UserTextbookInfo,
  UserLearnData,
  ResourceFile,
  ChapterNode,
  LearningPackage
} from '../types'

// 移除不再使用的回调接口 - 直接使用ApiService后不再需要

export class ResourceManager {
  private static instance: ResourceManager
  private currentToken: string | null = null
  private currentUsername: string | null = null
  private userLearnData: UserLearnData | null = null
  private indexedDBInstance: IndexedDBService
  
  // 批量更新优化相关
  private pendingUpdates: Map<string, UserTextbookInfo> = new Map()
  private updateTimer: number | null = null
  private readonly BATCH_UPDATE_DELAY = 1000 // 1秒延迟批量更新
  
  /**
   * 获取IndexedDB实例 - 供外部访问
   */
  public get indexedDB(): IndexedDBService {
    return this.indexedDBInstance
  }

  private constructor() {
    // 初始化IndexedDB配置 - 简化设计，移除files表，文件数据直接存储在textbooks中
    this.indexedDBInstance = IndexedDBService.getInstance({
      dbName: 'TextbookStorage',
      version: 5, // 升级版本号，移除files表
      stores: [
        {
          name: 'textbooks',
          keyPath: 'textbookId',
          indexes: [
            { name: 'isDownloaded', keyPath: 'isDownloaded' },
            { name: 'downloadStatus', keyPath: 'downloadStatus' },
            { name: 'lastDownloadTime', keyPath: 'lastDownloadTime' },
            { name: 'subjectLabel', keyPath: 'textbookSubjectLabel' },
            { name: 'gradeLabel', keyPath: 'textbookGradeLabel' }
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
      await this.indexedDBInstance.init()
      const userInfo = this.getCurrentUser()
      if (userInfo) {
        this.currentToken = userInfo.token
        this.currentUsername = userInfo.username
        // 直接初始化空的用户学习数据
        this.userLearnData = {
          username: userInfo.username,
          lastSyncTime: new Date().toISOString(),
          textbooks: []
        }
      }
    } catch (error) {
      console.error('初始化IndexedDB失败:', error)
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
      
      return isValid
    } catch (error) {
      console.error('本地文件校验失败:', error)
      return false
    }
  }



  /**
   * 获取用户学习数据
   */
  public getUserLearnData(): UserLearnData | null {
    return this.userLearnData
  }

  /**
   * 深度序列化对象，确保可以存储到IndexedDB
   * @param obj 要序列化的对象
   * @returns 序列化后的对象
   */
  private deepSerialize(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj
    }
    
    if (typeof obj === 'function') {
      return undefined // 排除函数
    }
    
    if (obj instanceof Date) {
      return obj.toISOString()
    }
    
    // 处理ArrayBuffer - 转换为Uint8Array以便序列化
    if (obj instanceof ArrayBuffer) {
      return new Uint8Array(obj)
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSerialize(item)).filter(item => item !== undefined)
    }
    
    if (typeof obj === 'object') {
      const serialized: Record<string, unknown> = {}
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = this.deepSerialize((obj as Record<string, unknown>)[key])
          if (value !== undefined) {
            serialized[key] = value
          }
        }
      }
      return serialized
    }
    
    return obj
  }

  /**
   * 更新教材信息 - 优化版本，支持批量更新
   * @param textbook 教材信息对象
   * @param updates 可选的部分更新数据
   * @param immediate 是否立即更新到IndexedDB（默认false，使用批量更新）
   * @returns Promise<boolean> 返回更新是否成功
   */
  public async updateTextbookInfo(
    textbook: UserTextbookInfo, 
    updates?: {
      fileData?: Record<string, Uint8Array>
      downloadedFiles?: number
      totalFiles?: number
      lastDownloadTime?: string
      hasUpdatesAvailable?: boolean
      [key: string]: unknown
    },
    immediate: boolean = false
  ): Promise<boolean> {
    try {
      console.log('更新教材信息:', textbook.textbookName, immediate ? '(立即更新)' : '(批量更新)')
      
      // 如果提供了更新数据，则合并到教材信息中
      if (updates) {
        Object.assign(textbook, updates)
        console.log('合并更新数据:', updates)
      }
      
      // 更新内存中的数据
      if (this.userLearnData) {
        const index = this.userLearnData.textbooks.findIndex(t => t.textbookId === textbook.textbookId)
        if (index >= 0) {
          this.userLearnData.textbooks[index] = textbook
        } else {
          this.userLearnData.textbooks.push(textbook)
        }
      }
      
      if (immediate) {
        // 立即更新到IndexedDB
        return await this.flushTextbookToIndexedDB(textbook)
      } else {
        // 添加到批量更新队列
        this.pendingUpdates.set(textbook.textbookId, textbook)
        this.scheduleBatchUpdate()
        return true
      }
    } catch (error) {
      console.error('更新教材信息失败:', error)
      return false
    }
  }

  /**
   * 立即刷新教材信息到IndexedDB
   * @param textbook 教材信息对象
   * @returns Promise<boolean> 返回更新是否成功
   */
  private async flushTextbookToIndexedDB(textbook: UserTextbookInfo): Promise<boolean> {
    try {
      // 使用深度序列化方法创建可存储到IndexedDB的数据
      const serializableTextbook = this.deepSerialize(textbook)
      
      // 更新到IndexedDB
      const updateSuccess = await this.indexedDBInstance.update('textbooks', serializableTextbook)
      
      if (updateSuccess) {
        console.log(`教材 ${textbook.textbookName} 信息立即更新成功`)
        return true
      } else {
        console.error(`教材 ${textbook.textbookName} 信息立即更新失败`)
        return false
      }
    } catch (error) {
      console.error('立即更新教材信息失败:', error)
      return false
    }
  }

  /**
   * 安排批量更新
   */
  private scheduleBatchUpdate(): void {
    // 清除之前的定时器
    if (this.updateTimer) {
      window.clearTimeout(this.updateTimer)
    }
    
    // 设置新的定时器
    this.updateTimer = window.setTimeout(async () => {
      await this.flushPendingUpdates()
    }, this.BATCH_UPDATE_DELAY)
  }

  /**
   * 刷新所有待更新的教材信息到IndexedDB
   */
  private async flushPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0) {
      return
    }

    console.log(`开始批量更新 ${this.pendingUpdates.size} 个教材信息`)
    
    try {
      // 批量更新所有待更新的教材
      const updatePromises: Promise<boolean>[] = []
      
      for (const [, textbook] of this.pendingUpdates) {
        updatePromises.push(this.flushTextbookToIndexedDB(textbook))
      }
      
      // 等待所有更新完成
      const results = await Promise.all(updatePromises)
      const successCount = results.filter(result => result).length
      
      console.log(`批量更新完成: ${successCount}/${this.pendingUpdates.size} 个教材更新成功`)
      
      // 清空待更新队列
      this.pendingUpdates.clear()
      
    } catch (error) {
      console.error('批量更新失败:', error)
    }
  }

  /**
   * 强制刷新所有待更新的数据到IndexedDB
   * 在关键操作（如下载完成、应用关闭）时调用
   */
  public async forceFlushPendingUpdates(): Promise<void> {
    // 清除定时器
    if (this.updateTimer) {
      window.clearTimeout(this.updateTimer)
      this.updateTimer = null
    }
    
    // 立即刷新所有待更新数据
    await this.flushPendingUpdates()
  }

  /**
   * 保存文件二进制数据到教材信息中 - 优化版本，使用批量更新
   * @param fileInfo 文件信息
   * @param fileData 文件二进制数据
   * @param immediate 是否立即更新到IndexedDB（默认false，使用批量更新）
   */
  public async storeFileData(fileInfo: {
    id: string
    textbookId: string
    packageId: string
    fileName: string
    fileType: string
    fileSize: number
    checksum?: string
    chapterOrder?: number
    sortOrder?: number
  }, fileData: Uint8Array, immediate: boolean = false): Promise<void> {
    try {
      console.log(`保存文件数据到教材信息: ${fileInfo.fileName}, 大小: ${fileData.length} bytes`)
      
      // 获取教材信息
      const textbook = await this.indexedDBInstance.get('textbooks', fileInfo.textbookId) as UserTextbookInfo
      if (!textbook) {
        throw new Error(`教材 ${fileInfo.textbookId} 不存在`)
      }
      
      // 初始化fileData字段
      if (!textbook.fileData) {
        textbook.fileData = {}
      }
      
      // 保存文件数据到教材的fileData中
      textbook.fileData[fileInfo.id] = fileData
      
      // 使用优化的更新方法（默认使用批量更新）
      const success = await this.updateTextbookInfo(textbook, undefined, immediate)
      
      if (success) {
        console.log(`✅ 文件数据保存成功: ${fileInfo.fileName}`)
        console.log(`📊 教材统计更新: 已下载 ${textbook.downloadedFiles}/${textbook.totalFiles} 个文件`)
      } else {
        throw new Error('更新教材信息失败')
      }
    } catch (error) {
      console.error(`❌ 保存文件数据失败: ${fileInfo.fileName}`, error)
      throw error
    }
  }


  /**
   * 清理过期数据 - 简化版本
   * 清理30天未下载的教材数据
   */
  public async cleanupExpiredData(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      // 获取所有教材数据
      const allTextbooks = await this.indexedDBInstance.getAll('textbooks')
      
      for (const textbook of allTextbooks) {
        const textbookData = textbook as UserTextbookInfo
        const lastDownloadTime = new Date(textbookData.lastDownloadTime)
        if (lastDownloadTime < thirtyDaysAgo && !textbookData.isDownloaded) {
          console.log(`清理过期教材数据: ${textbookData.textbookName}`)
          await this.cleanupTextbookRelatedData(textbookData.textbookId)
          await this.indexedDBInstance.delete('textbooks', textbookData.textbookId)
        }
      }
    } catch (error) {
      console.error('清理过期数据失败:', error)
    }
  }
  
  /**
   * 设置教材的总文件数
   * @param textbookId 教材ID
   * @param totalFiles 总文件数
   */
  public async setTextbookTotalFiles(textbookId: string, totalFiles: number): Promise<void> {
    try {
      console.log(`设置教材 ${textbookId} 总文件数: ${totalFiles}`)
      
      // 使用教材ID查找教材记录
      const textbooks = await this.indexedDBInstance.getAll('textbooks') as Record<string, unknown>[]
      const textbook = textbooks.find(t => (t as Record<string, unknown>).textbookId === textbookId)
      
      if (!textbook) {
        console.error(`❌ 教材 ${textbookId} 不存在`)
        return
      }
      
      textbook.totalFiles = totalFiles
      await this.indexedDBInstance.update('textbooks', textbook)
      
      console.log(`✅ 教材 ${textbookId} 总文件数设置成功: ${totalFiles}`)
    } catch (error) {
      console.error(`❌ 设置教材总文件数失败:`, error)
      throw error
    }
  }


  /**
   * 清理教材相关的所有数据 - 简化版本
   */
  private async cleanupTextbookRelatedData(textbookId: string): Promise<void> {
    try {
      // 获取教材信息
      const textbook = await this.indexedDBInstance.get('textbooks', textbookId) as Record<string, unknown>
      if (textbook && textbook.fileData) {
        // 清空教材中的文件数据
        textbook.fileData = {}
        await this.indexedDBInstance.update('textbooks', textbook)
        console.log(`已清理教材 ${textbookId} 的文件数据`)
      }
    } catch (error) {
      console.error('清理教材相关数据失败:', error)
    }
  }

  /**
   * 获取本地教材信息 - 支持三级对比
   * 对应Android LearnResourceManager.getUserLocalTextbooks
   */
  public async getUserLocalTextbooks(): Promise<UserTextbookInfo[]> {
    try {
      if (!this.indexedDBInstance.isInitialized) {
        await this.indexedDBInstance.init()
      }
      
      // 从IndexedDB获取所有教材
      const textbooks = await this.indexedDBInstance.getAll('textbooks')
      
      // 转换为UserTextbookInfo对象
      const userTextbooks: UserTextbookInfo[] = textbooks.map((data: unknown) => {
        const dataRecord = data as Record<string, unknown>
        const textbook: UserTextbookInfo = {
          id: dataRecord.id as string,
          textbookId: dataRecord.textbookId as string,
          textbookName: dataRecord.textbookName as string,
          textbookSubjectLabel: dataRecord.textbookSubjectLabel as string,
          textbookGradeLabel: dataRecord.textbookGradeLabel as string,
          textbookSemesterLabel: dataRecord.textbookSemesterLabel as string,
          textbookPublisher: dataRecord.textbookPublisher as string,
          textbookEditionYear: dataRecord.textbookEditionYear as string,
          textbookIsbn: dataRecord.textbookIsbn as string,
          textbookCover: dataRecord.textbookCover as string,
          textbookUpdateTime: dataRecord.textbookUpdateTime as string,
          totalFiles: (dataRecord.totalFiles as number) || 0,
          downloadedFiles: (dataRecord.downloadedFiles as number) || 0,
          isDownloaded: (dataRecord.isDownloaded as boolean) || false,
          downloadStatus: (dataRecord.downloadStatus as number) || 0,
          downloadPath: (dataRecord.downloadPath as string) || '',
          lastDownloadTime: (dataRecord.lastDownloadTime as string) || '',
          hasUpdatesAvailable: (dataRecord.hasUpdatesAvailable as boolean) || false,
          structure: (dataRecord.structure as ChapterNode[]) || [],
          learningPackages: (dataRecord.learningPackages as LearningPackage[]) || [],
          fileData: (dataRecord.fileData as Record<string, Uint8Array>) || {}, // 添加文件数据字段
          
          // 添加方法
          updateStructure: function(structure: ChapterNode[]) {
            this.structure = structure || []
          },
          updatePackages: function(packages: LearningPackage[]) {
            this.learningPackages = packages || []
          },
          getLocalResourceFileName: function(resource: ResourceFile): string {
            const fileName = resource.fileName
            const dotIndex = fileName.lastIndexOf('.')
            if (dotIndex === -1) {
              return fileName + "_" + resource.checksum
            } else {
              const name = fileName.substring(0, dotIndex)
              const ext = fileName.substring(dotIndex)
              return name + "_" + resource.checksum + ext
            }
          }
        }
        return textbook
      })
      
      console.log(`获取到 ${userTextbooks.length} 个本地教材`)
      return userTextbooks
      
    } catch (error) {
      console.error('获取本地教材失败:', error)
      return []
    }
  }

  /**
   * 根据教材ID获取单个教材信息
   * @param textbookId 教材ID
   * @returns 教材信息或null
   */
  public async getTextbookInfo(textbookId: string): Promise<UserTextbookInfo | null> {
    try {
      const textbook = await this.indexedDBInstance.get('textbooks', textbookId) as UserTextbookInfo
      return textbook || null
    } catch (error) {
      console.error(`获取教材 ${textbookId} 信息失败:`, error)
      return null
    }
  }


}

// 创建默认的资源管理器实例
export const resourceManager = ResourceManager.getInstance()

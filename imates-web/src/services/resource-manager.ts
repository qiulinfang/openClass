/**
 * 资源管理服务
 * 对应Android LearnResourceManager，提供统一的资源管理功能
 */

import { IndexedDBService } from './indexeddb-service'
import CryptoJS from 'crypto-js'
import { DebounceUtils } from '../utils'
// 注释掉缩略图相关导入以提升性能
// import { isPdfFile } from '../utils/pdf-thumbnail'
// import { thumbnailQueue } from '../utils/thumbnail-queue'
import type {
  UserTextbookInfo,
  ResourceFile,
  ChapterNode,
  LearningPackage,
  LocalFileInfo
} from '../types'

// 移除不再使用的回调接口 - 直接使用ApiService后不再需要

export class ResourceManager {
  private static instance: ResourceManager
  private currentToken: string | null = null
  private currentUsername: string | null = null
  private indexedDBInstance: IndexedDBService
  
  // 批量更新优化相关
  private pendingUpdates: Map<string, UserTextbookInfo> = new Map()
  private debouncedFlush: () => void
  
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
      version: 6, // 升级版本号，修改主键为id
      stores: [
        {
          name: 'textbooks',
          keyPath: 'id',
          indexes: [
            { name: 'isDownloaded', keyPath: 'isDownloaded' },
            { name: 'downloadStatus', keyPath: 'downloadStatus' },
            { name: 'lastDownloadTime', keyPath: 'lastDownloadTime' },
            { name: 'subjectLabel', keyPath: 'textbookSubjectLabel' },
            { name: 'gradeLabel', keyPath: 'textbookGradeLabel' },
            { name: 'textbookId', keyPath: 'textbookId' }
          ]
        }
      ]
    })
    
    // 初始化防抖函数 - 使用1秒延迟的防抖
    this.debouncedFlush = DebounceUtils.verySlow(async () => {
      // 刷新所有待更新的教材信息到IndexedDB
      if (this.pendingUpdates.size === 0) {
        return
      }

      try {
        // 批量更新所有待更新的教材
        const updatePromises: Promise<boolean>[] = []
        
        for (const [, textbook] of this.pendingUpdates) {
          // 立即刷新教材信息到IndexedDB（自动序列化）
          updatePromises.push((async () => {
            try {
              return await this.indexedDBInstance.update('textbooks', textbook)
            } catch {
              return false
            }
          })())
        }
        
        // 等待所有更新完成
        await Promise.all(updatePromises)
        
        // 清空待更新队列
        this.pendingUpdates.clear()
        
      } catch {
        // 批量更新失败
      }
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
      }
    } catch {
      // 初始化失败
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
    } catch {
      return false
    }
  }





  /**
   * 更新教材信息到IndexedDB
   * @param textbook 教材信息对象
   * @param updates 可选的部分更新数据
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
    }
  ): Promise<boolean> {
    try {
      // 如果提供了更新数据，则合并到教材信息中
      if (updates) {
        Object.assign(textbook, updates)
      }
      
      // 立即更新到IndexedDB（自动序列化）
      try {
        const result = await this.indexedDBInstance.update('textbooks', textbook)
        return result
      } catch {
        return false
      }
    } catch {
      return false
    }
  }


  /**
   * 强制刷新所有待更新的数据到IndexedDB
   * 在关键操作（如下载完成、应用关闭）时调用
   */
  public async forceFlushPendingUpdates(): Promise<void> {
    // 刷新所有待更新的教材信息到IndexedDB
    if (this.pendingUpdates.size === 0) {
      return
    }

    try {
      // 批量更新所有待更新的教材
      const updatePromises: Promise<boolean>[] = []
      
      for (const [, textbook] of this.pendingUpdates) {
        // 立即刷新教材信息到IndexedDB（自动序列化）
        updatePromises.push((async () => {
          try {
            const result = await this.indexedDBInstance.update('textbooks', textbook)
            return result
          } catch {
            return false
          }
        })())
      }
      
      // 等待所有更新完成
      await Promise.all(updatePromises)
      
      // 清空待更新队列
      this.pendingUpdates.clear()
      
    } catch {
      // 批量更新失败
    }
  }

  /**
   * 保存文件二进制数据到教材信息中 - 重构版本，直接存储到localFiles中
   * @param fileInfo 文件信息
   * @param fileData 文件二进制数据
   * @param immediate 是否立即更新到IndexedDB（默认true，立即保存）
   * @param textbook 可选的教材信息，避免并发时重复获取
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
  }, fileData: Uint8Array, textbook?: UserTextbookInfo): Promise<void> {
    try {
      // 获取教材信息 - 优先使用传入的教材信息，避免并发时重复获取
      let textbookInfo: UserTextbookInfo
      if (textbook) {
        textbookInfo = textbook
      } else {
        textbookInfo = await this.indexedDBInstance.getByIndex('textbooks', 'textbookId', fileInfo.textbookId) as UserTextbookInfo
        if (!textbookInfo) {
          throw new Error(`教材 ${fileInfo.textbookId} 不存在`)
        }
      }
      
      // 查找对应的学习包
      const packageIndex = textbookInfo.learningPackages.findIndex(p => p.packageId === fileInfo.packageId)
      if (packageIndex === -1) {
        throw new Error(`学习包 ${fileInfo.packageId} 不存在`)
      }
      
      // 初始化textbookInfo.localFiles数组
      if (!textbookInfo.localFiles) {
        textbookInfo.localFiles = []
      }
      
      // 查找或创建本地文件信息 - 存储到textbookInfo.localFiles而不是learningPackages
      const localFiles = textbookInfo.localFiles
      const localFileIndex = localFiles.findIndex(f => f.id === fileInfo.id)
      
      if (localFileIndex === -1) {
        // 创建新的本地文件信息
        localFiles.push({
          id: fileInfo.id,
          fileName: fileInfo.fileName,
          fileSize: fileData.length,
          checksum: fileInfo.checksum || '',
          isDownloaded: true,
          fileData: fileData,
          thumbnail: undefined // 缩略图将异步生成
        })
      } else {
        // 更新现有的本地文件信息
        localFiles[localFileIndex] = {
          ...localFiles[localFileIndex],
          fileName: fileInfo.fileName,
          fileSize: fileData.length,
          checksum: fileInfo.checksum || '',
          isDownloaded: true,
          fileData: fileData,
          thumbnail: localFiles[localFileIndex].thumbnail // 保留已有缩略图
        }
      }
      
      // 更新教材信息到IndexedDB
      const success = await this.updateTextbookInfo(textbookInfo, undefined)
      
      if (!success) {
        throw new Error('更新教材信息失败')
      }
      
      // 如果是PDF文件，添加到异步缩略图生成队列
      // 注释掉缩略图生成逻辑以提升性能
      /*
      if (isPdfFile(fileInfo.fileName)) {
        
        thumbnailQueue.addTask({
          fileId: fileInfo.id,
          textbookId: fileInfo.textbookId,
          fileName: fileInfo.fileName,
          fileData: fileData
        })
      }
      */
      
    } catch (error) {
      throw error
    }
  }


  /**
   * 获取文件数据 - 重构版本，从localFiles中获取fileData
   * @param id 教材主键ID
   * @param fileId 文件ID
   * @returns 文件二进制数据，如果不存在则返回null
   */
  public async getFileData(id: string, fileId: string): Promise<Uint8Array | null> {
    try {
      // 通过主键id直接查找教材信息
      const textbook = await this.indexedDBInstance.get('textbooks', id) as UserTextbookInfo
      if (!textbook) {
        return null
      }
      
      // 在textbook.localFiles中查找文件
      if (textbook.localFiles) {
        const localFile = textbook.localFiles.find(f => f.id === fileId)
        if (localFile && localFile.fileData && localFile.fileData.length > 0) {
          return localFile.fileData
        }
      }
      
      return null
    } catch {
      return null
    }
  }

  /**
   * 检查文件数据是否存在 - 重构版本，检查localFiles中的fileData
   * @param id 教材主键ID
   * @param fileId 文件ID
   * @returns 文件数据是否存在
   */
  public async hasFileData(id: string, fileId: string): Promise<boolean> {
    try {
      // 通过主键id直接查找教材信息
      const textbook = await this.indexedDBInstance.get('textbooks', id) as UserTextbookInfo
      if (!textbook) {
        return false
      }
      
      // 在textbook.localFiles中查找文件
      if (textbook.localFiles) {
        const localFile = textbook.localFiles.find(f => f.id === fileId)
        if (localFile && localFile.fileData && localFile.fileData.length > 0) {
          return true
        }
      }
      
      return false
    } catch {
      return false
    }
  }

  /**
   * 更新文件的缩略图（异步缩略图生成完成后调用）
   * @param textbookId 教材ID
   * @param fileId 文件ID
   * @param thumbnail 缩略图base64数据
   */
  public async updateThumbnail(textbookId: string, fileId: string, thumbnail: string): Promise<void> {
    try {
      // 第1步：获取教材信息
      const textbook = await this.indexedDBInstance.getByIndex('textbooks', 'textbookId', textbookId) as UserTextbookInfo
      if (!textbook) {
        return
      }
      
      // 第2步：查找并更新文件的缩略图
      if (textbook.localFiles) {
        const localFile = textbook.localFiles.find(f => f.id === fileId)
        if (localFile) {
          localFile.thumbnail = thumbnail
          
          // 第3步：保存更新后的教材信息
          await this.updateTextbookInfo(textbook, undefined)
        }
      }
    } catch (error) {
      console.warn(`更新缩略图失败 (textbookId: ${textbookId}, fileId: ${fileId}):`, error)
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
          await this.cleanupTextbookRelatedData(textbookData.textbookId)
          await this.indexedDBInstance.delete('textbooks', textbookData.textbookId)
        }
      }
    } catch {
      // 清理过期数据失败
    }
  }
  


  /**
   * 清理教材相关的所有数据 - 简化版本
   */
  private async cleanupTextbookRelatedData(textbookId: string): Promise<void> {
    try {
      // 获取教材信息
      const textbook = await this.indexedDBInstance.getByIndex('textbooks', 'textbookId', textbookId) as Record<string, unknown>
      if (textbook && textbook.fileData) {
        // 清空教材中的文件数据
        textbook.fileData = {}
        await this.indexedDBInstance.update('textbooks', textbook)
      }
    } catch {
      // 清理教材相关数据失败
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
          localFiles: (() => {
            const localFiles = (dataRecord.localFiles as LocalFileInfo[]) || []
            // 第1步：瘦身处理 - 去掉fileData字段，避免响应式化大型二进制数据
            return localFiles.map(file => ({
              id: file.id,
              fileName: file.fileName,
              fileSize: file.fileSize,
              checksum: file.checksum,
              isDownloaded: file.isDownloaded,
              thumbnail: file.thumbnail,
              localPath: file.localPath
              // 注意：不包含fileData，需要时通过getFileData(id, fileId)按需获取
            }))
          })(), // 从数据库读取localFiles数据（瘦身版）
          
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
          },
        }
        return textbook
      })
      
      // 调试：验证localFiles数据
      userTextbooks.forEach(textbook => {
        if (textbook.localFiles.length > 0) {
        }
      })
      
      // 获取本地教材完成
      return userTextbooks
      
    } catch {
      return []
    }
  }

  /**
   * 根据主键ID获取单个教材信息
   * @param id 主键ID
   * @returns 教材信息或null
   */
  public async getTextbookInfoById(id: string): Promise<UserTextbookInfo | null> {
    try {
      // 使用主键id直接查询
      const textbook = await this.indexedDBInstance.get('textbooks', id) as UserTextbookInfo
      return textbook || null
    } catch {
      return null
    }
  }

  /**
   * 清理教材文件数据
   * @param id 教材主键ID
   */
  public async clearTextbookFiles(id: string): Promise<void> {
    try {
      // 获取教材信息
      const textbook = await this.indexedDBInstance.get('textbooks', id) as Record<string, unknown>
      if (textbook && textbook.fileData) {
        // 清空教材中的文件数据
        textbook.fileData = {}
        textbook.localFiles = []
        textbook.downloadedFiles = 0
        textbook.isDownloaded = false
        textbook.downloadStatus = 0
        textbook.lastDownloadTime = ''
        await this.indexedDBInstance.update('textbooks', textbook)
      }
    } catch {
      // 清理教材相关数据失败
    }
  }


}

// 创建默认的资源管理器实例
export const resourceManager = ResourceManager.getInstance()
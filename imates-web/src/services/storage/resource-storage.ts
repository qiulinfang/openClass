/**
 * 资源管理服务
 * 对应Android LearnResourceManager，提供统一的资源管理功能
 */

import { IndexedDBService } from './indexeddb-service'
import CryptoJS from 'crypto-js'
import { DebounceUtils } from '@/utils'
import { authStorageService } from './auth-storage-service'
// 注释掉缩略图相关导入以提升性能
// import { isPdfFile } from '../utils/thumbnail/pdf-thumbnail'
// import { thumbnailQueue } from '../utils/thumbnail/thumbnail-queue'
import type {
  UserTextbookInfo,
  ResourceFile,
  ChapterNode,
  LearningPackage,
  LocalFileInfo
} from '@/types'

export class ResourceManager {
  private static instance: ResourceManager | null = null
  private static currentUserId: string | null = null
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
    // 初始化IndexedDB配置 - 分离存储架构：元数据和二进制数据分离
    // 使用用户ID作为数据库名称前缀，实现账号隔离
    const userId = authStorageService.getCurrentUserIdOrDefault()
    const dbName = `TextbookStorage_${userId}`
    this.indexedDBInstance = IndexedDBService.getInstance({
      dbName: dbName,
      // 升级版本号，新增 knowledge_graph_chapter_structure 表用于缓存知识图谱章节结构
      version: 11,
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
        },
        {
          name: 'textbook_files',
          keyPath: 'fileId',
          indexes: [
            { name: 'textbookId', keyPath: 'textbookId' }
          ]
        },
        {
          name: 'ai_textbook_sessions',
          keyPath: 'sessionId',
          indexes: [
            { name: 'resourceId', keyPath: 'resourceId' },
            { name: 'pinned', keyPath: 'pinned' },
            { name: 'updateTime', keyPath: 'updateTime' }
          ]
        },
        {
          name: 'learning_packages',
          keyPath: 'id',
          indexes: [
            { name: 'userId', keyPath: 'userId' },
            { name: 'packageId', keyPath: 'packageId' },
            { name: 'textbookId', keyPath: 'textbookId' },
            { name: 'timestamp', keyPath: 'timestamp' },
          ]
        },
        {
          // 知识图谱章节结构缓存表（/app/teacher-textbook-section-tree）
          name: 'knowledge_graph_chapter_structure',
          keyPath: 'id',
          indexes: [
            { name: 'userId', keyPath: 'userId' },
            { name: 'textbookId', keyPath: 'textbookId' },
            { name: 'timestamp', keyPath: 'timestamp' }
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

  // 获取单例实例
  public static getInstance(): ResourceManager {
    // 检查用户是否切换，如果切换则重新创建实例
    const userId = authStorageService.getCurrentUserIdOrDefault()
    if (!ResourceManager.instance || ResourceManager.currentUserId !== userId) {
      // 如果已有实例，先关闭旧的数据库连接
      if (ResourceManager.instance) {
        ResourceManager.instance.indexedDB.close()
      }
      // 创建新实例
      ResourceManager.instance = new ResourceManager()
      ResourceManager.currentUserId = userId
    }
    return ResourceManager.instance
  }

  /**
   * 检查是否已登录
   */
  public async isLoggedIn(): Promise<boolean> {
    const { getYanbanToken, getUserId } = await import('./auth-storage-service')
    const token = getYanbanToken()
    const userId = getUserId()
    return !!(token && userId && token !== 'undefined')
  }

  /**
   * 获取当前用户信息
   */
  public async getCurrentUser(): Promise<{ token: string; username: string } | null> {
    const { getYanbanToken, getUserId } = await import('./auth-storage-service')
    const token = getYanbanToken()
    const userId = getUserId()
    
    if (token && userId && token !== 'undefined') {
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
   * 保存文件二进制数据 - 分离存储版本
   * 第1步：文件数据存储到textbook_files表
   * 第2步：元数据（不含fileData）存储到textbooks表的localFiles中
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
      // 第1步：存储文件数据到textbook_files表（分离存储）
      await this.indexedDBInstance.update('textbook_files', {
        fileId: fileInfo.id,
        textbookId: fileInfo.textbookId,
        fileData: fileData
      })
      
      // 第2步：获取教材信息 - 优先使用传入的教材信息，避免并发时重复获取
      let textbookInfo: UserTextbookInfo
      if (textbook) {
        textbookInfo = textbook
      } else {
        // 使用降级策略查询：textbookId索引 -> getAll（兼容旧数据库无索引的情况）
        const foundTextbook = await this.getTextbookByTextbookIdWithFallback(
          fileInfo.textbookId,
          'ResourceManager.storeFileData'
        )
        
        if (!foundTextbook) {
          throw new Error(`教材 ${fileInfo.textbookId} 不存在`)
        }
        textbookInfo = foundTextbook
      }
      
      // 第3步：查找对应的学习包
      const packageIndex = textbookInfo.learningPackages.findIndex(p => p.packageId === fileInfo.packageId)
      if (packageIndex === -1) {
        throw new Error(`学习包 ${fileInfo.packageId} 不存在`)
      }
      
      // 第4步：初始化textbookInfo.localFiles数组
      if (!textbookInfo.localFiles) {
        textbookInfo.localFiles = []
      }
      
      // 第5步：查找或创建本地文件元数据（不含fileData）
      const localFiles = textbookInfo.localFiles
      const localFileIndex = localFiles.findIndex(f => f.id === fileInfo.id)
      
      if (localFileIndex === -1) {
        // 创建新的本地文件元数据
        localFiles.push({
          id: fileInfo.id,
          fileName: fileInfo.fileName,
          fileSize: fileData.length,
          checksum: fileInfo.checksum || '',
          isDownloaded: true,
          thumbnail: undefined // 缩略图将异步生成
        })
      } else {
        // 更新现有的本地文件元数据
        localFiles[localFileIndex] = {
          ...localFiles[localFileIndex],
          fileName: fileInfo.fileName,
          fileSize: fileData.length,
          checksum: fileInfo.checksum || '',
          isDownloaded: true,
          thumbnail: localFiles[localFileIndex].thumbnail // 保留已有缩略图
        }
      }
      
      // 第6步：更新已下载文件数（基于 localFiles 中已下载的文件）
      const downloadedFilesCount = localFiles.filter(f => f.isDownloaded).length
      textbookInfo.downloadedFiles = downloadedFilesCount
      
      // 第7步：更新教材元数据到IndexedDB
      const success = await this.updateTextbookInfo(textbookInfo, {
        downloadedFiles: downloadedFilesCount
      })
      
      if (!success) {
        throw new Error('更新教材信息失败')
      }
      
    } catch (error) {
      throw error
    }
  }


  /**
   * 获取文件数据 - 分离存储版本，从textbook_files表按需读取
   * 第1步：直接从textbook_files表查询文件数据
   * @param id 教材主键ID（保留参数以兼容旧代码，实际不使用）
   * @param fileId 文件ID
   * @returns 文件二进制数据，如果不存在则返回null
   */
  public async getFileData(id: string, fileId: string): Promise<Uint8Array | null> {
    try {
      // 直接从textbook_files表查询文件数据（按需读取，性能优化）
      const fileRecord = await this.indexedDBInstance.get('textbook_files', fileId) as { fileId: string; textbookId: string; fileData: Uint8Array } | null
      if (fileRecord && fileRecord.fileData && fileRecord.fileData.length > 0) {
        return fileRecord.fileData
      }
      
      return null
    } catch {
      return null
    }
  }

  /**
   * 更新已存在文件的二进制数据 - 分离存储版本
   * 仅更新 textbook_files 表中的 fileData，不改动教材元数据和缩略图
   * @param fileId 文件ID（即资源ID）
   * @param fileData 新的文件二进制数据
   */
  public async updateFileData(fileId: string, fileData: Uint8Array): Promise<void> {
    try {
      const fileRecord = (await this.indexedDBInstance.get(
        'textbook_files',
        fileId,
      )) as { fileId: string; textbookId: string; fileData: Uint8Array } | null

      if (fileRecord) {
        fileRecord.fileData = fileData
        await this.indexedDBInstance.update('textbook_files', fileRecord)
      } else {
        // 如果记录不存在，降级为插入一条新的记录，仅包含 fileData
        await this.indexedDBInstance.update('textbook_files', {
          fileId,
          textbookId: '',
          fileData,
        })
      }
    } catch {
      // 更新文件失败时静默处理，由调用方决定是否额外提示
    }
  }

  /**
   * 检查文件数据是否存在 - 分离存储版本，检查textbook_files表
   * 第1步：直接从textbook_files表查询是否存在
   * @param id 教材主键ID（保留参数以兼容旧代码，实际不使用）
   * @param fileId 文件ID
   * @returns 文件数据是否存在
   */
  public async hasFileData(id: string, fileId: string): Promise<boolean> {
    try {
      // 直接从textbook_files表查询是否存在（轻量级查询）
      const fileRecord = await this.indexedDBInstance.get('textbook_files', fileId) as { fileId: string; textbookId: string; fileData: Uint8Array } | null
      return !!(fileRecord && fileRecord.fileData && fileRecord.fileData.length > 0)
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
      // 第1步：获取教材信息（使用降级策略：textbookId索引 -> getAll）
      const textbook = await this.getTextbookByTextbookIdWithFallback(
        textbookId,
        'ResourceManager.updateThumbnail'
      )
      
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
   * 清理教材相关的所有数据 - 分离存储版本
   * 第1步：清理textbook_files表中的文件数据
   * 第2步：清理textbooks表中的元数据
   */
  private async cleanupTextbookRelatedData(textbookId: string): Promise<void> {
    try {
      // 第1步：获取教材信息（使用降级策略：textbookId索引 -> getAll）
      const textbook = await this.getTextbookByTextbookIdWithFallback(
        textbookId,
        'ResourceManager.cleanupTextbookRelatedData'
      )
      
      if (!textbook) {
        return
      }
      
      // 第2步：删除textbook_files表中该教材的所有文件
      if (textbook.localFiles && textbook.localFiles.length > 0) {
        const deletePromises = textbook.localFiles.map(file => 
          this.indexedDBInstance.delete('textbook_files', file.id)
        )
        await Promise.all(deletePromises)
      }
      
      // 第3步：清空教材中的元数据
      textbook.localFiles = []
      textbook.downloadedFiles = 0
      textbook.isDownloaded = false
      textbook.downloadStatus = 0
      await this.indexedDBInstance.update('textbooks', textbook)
      
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
   * 根据 textbookId 获取教材信息（带降级策略）
   * 降级策略：textbookId 索引 -> getAll（兼容旧数据库无索引的情况）
   * @param textbookId 教材ID
   * @param context 调用上下文，用于日志记录（可选）
   * @returns 教材信息或null
   */
  public async getTextbookByTextbookIdWithFallback(
    textbookId: string,
  ): Promise<UserTextbookInfo | null> {
    try {
      // 优先使用 textbookId 索引查询
      return await this.indexedDBInstance.getByIndex('textbooks', 'textbookId', textbookId) as UserTextbookInfo
    } catch (error: unknown) {
      // 如果索引不存在（旧数据库可能没有textbookId索引），改用getAll在内存中查找
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorName = (error as { name?: string })?.name
      if (errorName === 'NotFoundError' || errorMessage.includes('index')) {
        const allTextbooks = await this.indexedDBInstance.getAll<UserTextbookInfo>('textbooks')
        return allTextbooks.find(t => t.textbookId === textbookId) || null
      } else {
        // 其他错误，返回null
        return null
      }
    }
  }

  /**
   * 根据 id 或 textbookId 获取教材信息（带三层降级策略）
   * 降级策略：id主键 -> textbookId索引 -> getAll（兼容旧数据库无索引的情况）
   * @param id 主键ID（可选）
   * @param textbookId 教材ID（可选）
   * @param context 调用上下文，用于日志记录（可选）
   * @returns 教材信息或null
   */
  public async getTextbookByIdOrTextbookIdWithFallback(
    id?: string,
    textbookId?: string,
    context?: string
  ): Promise<UserTextbookInfo | null> {
    // 优先使用主键 id 查询（性能最优）
    if (id) {
      try {
        const textbook = await this.indexedDBInstance.get('textbooks', id) as UserTextbookInfo
        if (textbook) {
          return textbook
        }
      } catch {
        // 主键查询失败，继续降级策略
      }
    }

    // 如果通过主键查不到，尝试通过 textbookId 索引查询
    if (textbookId) {
      return await this.getTextbookByTextbookIdWithFallback(textbookId, context)
    }

    return null
  }

  /**
   * 清理教材文件数据 - 分离存储版本
   * 第1步：清理textbook_files表中的文件数据
   * 第2步：清理textbooks表中的元数据
   * @param id 教材主键ID
   */
  public async clearTextbookFiles(id: string): Promise<void> {
    try {
      // 第1步：获取教材信息
      const textbook = await this.indexedDBInstance.get('textbooks', id) as UserTextbookInfo
      if (!textbook) {
        return
      }
      
      // 第2步：删除textbook_files表中该教材的所有文件
      if (textbook.localFiles && textbook.localFiles.length > 0) {
        const deletePromises = textbook.localFiles.map(file => 
          this.indexedDBInstance.delete('textbook_files', file.id)
        )
        await Promise.all(deletePromises)
      }
      
      // 第3步：清空教材中的元数据
      textbook.localFiles = []
      textbook.downloadedFiles = 0
      textbook.isDownloaded = false
      textbook.downloadStatus = 0
      textbook.lastDownloadTime = ''
      await this.indexedDBInstance.update('textbooks', textbook)
      
    } catch {
      // 清理教材相关数据失败
    }
  }

  /**
   * 删除教材 - 完全删除教材及其所有相关数据
   * 第1步：删除textbook_files表中该教材的所有文件
   * 第2步：删除textbooks表中的教材记录
   * @param id 教材主键ID
   * @returns 是否删除成功
   */
  public async deleteTextbook(id: string): Promise<boolean> {
    try {
      // 第1步：获取教材信息
      const textbook = await this.indexedDBInstance.get('textbooks', id) as UserTextbookInfo
      if (!textbook) {
        return false
      }
      
      // 第2步：删除textbook_files表中该教材的所有文件
      if (textbook.localFiles && textbook.localFiles.length > 0) {
        const deletePromises = textbook.localFiles.map(file => 
          this.indexedDBInstance.delete('textbook_files', file.id)
        )
        await Promise.all(deletePromises)
      }
      
      // 第3步：删除textbooks表中的教材记录
      await this.indexedDBInstance.delete('textbooks', id)
      
      return true
    } catch (error) {
      console.error('删除教材失败:', error)
      return false
    }
  }


}

// 创建资源管理器代理对象，确保用户切换时能获取正确的实例
// 使用Proxy确保每次访问时都获取最新的实例
class ResourceManagerProxy {
  private get instance(): ResourceManager {
    return ResourceManager.getInstance()
  }
  
  get indexedDB(): IndexedDBService {
    return this.instance.indexedDB
  }
  
  isLoggedIn(): boolean {
    return this.instance.isLoggedIn()
  }
  
  getCurrentUser(): { token: string; username: string } | null {
    return this.instance.getCurrentUser()
  }
  
  async verifyLocalFileIntegrity(fileData: Uint8Array, expectedChecksum: string): Promise<boolean> {
    return this.instance.verifyLocalFileIntegrity(fileData, expectedChecksum)
  }
  
  async updateTextbookInfo(
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
    return this.instance.updateTextbookInfo(textbook, updates)
  }
  
  async forceFlushPendingUpdates(): Promise<void> {
    return this.instance.forceFlushPendingUpdates()
  }
  
  async storeFileData(fileInfo: {
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
    return this.instance.storeFileData(fileInfo, fileData, textbook)
  }
  
  async getFileData(id: string, fileId: string): Promise<Uint8Array | null> {
    return this.instance.getFileData(id, fileId)
  }
  
  async hasFileData(id: string, fileId: string): Promise<boolean> {
    return this.instance.hasFileData(id, fileId)
  }

  async updateFileData(fileId: string, fileData: Uint8Array): Promise<void> {
    return this.instance.updateFileData(fileId, fileData)
  }
  
  async updateThumbnail(textbookId: string, fileId: string, thumbnail: string): Promise<void> {
    return this.instance.updateThumbnail(textbookId, fileId, thumbnail)
  }
  
  async cleanupExpiredData(): Promise<void> {
    return this.instance.cleanupExpiredData()
  }
  
  async getUserLocalTextbooks(): Promise<UserTextbookInfo[]> {
    return this.instance.getUserLocalTextbooks()
  }
  
  async getTextbookInfoById(id: string): Promise<UserTextbookInfo | null> {
    return this.instance.getTextbookInfoById(id)
  }
  
  async getTextbookByTextbookIdWithFallback(
    textbookId: string,
    context?: string
  ): Promise<UserTextbookInfo | null> {
    return this.instance.getTextbookByTextbookIdWithFallback(textbookId, context)
  }
  
  async getTextbookByIdOrTextbookIdWithFallback(
    id?: string,
    textbookId?: string,
    context?: string
  ): Promise<UserTextbookInfo | null> {
    return this.instance.getTextbookByIdOrTextbookIdWithFallback(id, textbookId, context)
  }
  
  async clearTextbookFiles(id: string): Promise<void> {
    return this.instance.clearTextbookFiles(id)
  }
  
  async deleteTextbook(id: string): Promise<boolean> {
    return this.instance.deleteTextbook(id)
  }
}

// 导出代理对象，确保用户切换时能获取正确的实例
export const resourceManager = new ResourceManagerProxy()

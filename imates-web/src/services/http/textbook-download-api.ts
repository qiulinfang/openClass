import { httpClient } from '../http/http-client'
import { getYanbanToken } from './auth-service'
import { saveLearningPackagesToDB, loadLearningPackagesFromDB } from '../storage/learning-packages-storage'
import { resourceManager, ResourceManager } from '../storage/resource-storage'
import { AndroidBridge } from '../business/android-bridge'
import { getCurrentEnvType, AppEnvType } from '@/config/env-config'
import { parseChapterOrderFromFileName as parseChapterOrderFromFileNameUtil } from '@/utils/business/chapter-utils'
import type {
  ApiResponse,
  ChapterNode,
  LearningPackage,
  LearningResourcesRequest,
  LocalFileInfo,
  ResourceFile,
  TextbookStructureRequest,
  TextbookVersion,
  UserTextbookInfo,
} from '@/types'

export interface TopicQuestionItem {
  id: string
  questionData: string
  [key: string]: unknown
}

export interface TopicPackageItem {
  id: string
  name?: string
  tags?: string
  topicList: TopicQuestionItem[]
  [key: string]: unknown
}

export interface TopicPackagePageResponse {
  records: TopicPackageItem[]
  pageNumber: number
  pageSize: number
  totalPage: number
  totalRow: number
}

export class TextbookDownloadApi {
  private readonly androidBridge: AndroidBridge

  // 下载请求管理
  private downloadControllers = new Map<string, AbortController>() // 存储每个教材的下载控制器

  constructor(androidBridge: AndroidBridge) {
    this.androidBridge = androidBridge
  }

  /**
   * 暂停教材下载
   * 对应Android LearnResourceManager.pauseDownload
   */
  public async pauseDownload(id: string): Promise<boolean> {
    try {
      const controller = this.downloadControllers.get(id)
      if (controller) {
        controller.abort()
        this.downloadControllers.delete(id)
        return true
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * 取消教材下载
   * 取消下载会清理已下载的文件数据
   */
  public async cancelDownload(id: string): Promise<boolean> {
    try {
      const controller = this.downloadControllers.get(id)
      if (controller) {
        controller.abort()
        this.downloadControllers.delete(id)
      }

      const rm = ResourceManager.getInstance()
      await rm.clearTextbookFiles(id)
      return true
    } catch {
      return false
    }
  }

  /**
   * 检查是否有活跃的下载任务
   */
  public hasActiveDownload(textbookId: string): boolean {
    return this.downloadControllers.has(textbookId)
  }

  private async callYanban<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
    const envType = getCurrentEnvType()

    // 临时绕过原生桥：测试环境直接走 httpClient，以使用前端的 routeBaseMap/yanbanBaseUrl
    if (envType === AppEnvType.INTERNAL_TEST) {
      return await httpClient.post<T>(url, body)
    }

    if (this.androidBridge.isAndroidBridgeAvailable()) {
      const apiPath = url.replace('/blw-edu-yb', '')
      const yanbanToken = getYanbanToken() || ''
      const result = await this.androidBridge.callYanbanApi(apiPath, body, 'POST', envType, yanbanToken)

      return {
        success: (result as any)?.success ?? false,
        data: ((result as any)?.data ?? result) as T,
        code: (result as any)?.code ?? ((result as any)?.success ? 200 : 0),
        message: (result as any)?.message,
      }
    }

    return await httpClient.post<T>(url, body)
  }

  public async getTextbookVersions(): Promise<TextbookVersion[]> {
    const endpoint = '/blw-edu-yb/api/app/teacher-textbook'

    const response = await this.callYanban<{
      code: number
      success: boolean
      message: string
      data: TextbookVersion[]
    }>(endpoint, {})

    const respData = response.data as any
    const textbooks = respData?.data || respData

    if (response.success && Array.isArray(textbooks)) {
      return textbooks
    }
    return []
  }

  public async getTextbookStructure(id: string): Promise<ChapterNode[]> {
    const endpoint = '/blw-edu-yb/api/app/teacher-textbook-section-tree'
    const request: TextbookStructureRequest = { id }

    const response = await this.callYanban<{
      code: number
      success: boolean
      message: string
      data: ChapterNode[]
    }>(endpoint, request)

    const respData = response.data as any
    const structure = respData?.data || respData

    if (response.success && Array.isArray(structure) && structure.length > 0 && structure[0]?.children?.length > 0) {
      return structure[0].children
    }

    return []
  }

  public async getLearningResources(id: string, useCache: boolean = true): Promise<LearningPackage[]> {
    const endpoint = '/blw-edu-yb/api/app/teacher-textbook-learning-package'
    const request: LearningResourcesRequest = { id }

    try {
      const response = await this.callYanban<{ data: LearningPackage[] }>(endpoint, request)

      const respData = response.data as any
      const packagesData = respData?.data || respData

      if (response.success && Array.isArray(packagesData)) {
        const packages = packagesData.map((pkg: LearningPackage) => ({
          ...pkg,
          packageId: (pkg as any).id,
          sectionId: (pkg as any).sectionId || '',
          packageName: (pkg as any).packageName || '未命名方案',
          description: (pkg as any).description || '暂无描述',
          updateTime: (pkg as any).updateTime || new Date().toISOString(),
          isDefault: (pkg as any).isDefault || 0,
          userId: (pkg as any).userId || '',
          releaseStatus: (pkg as any).releaseStatus || false,
          visibility: (pkg as any).visibility || 0,
          authors: (pkg as any).authors || '{}',
          tags: (pkg as any).tags || '{}',
          resourceList: (pkg as any).resourceList || [],
        }))

        if (useCache) {
          try {
            await saveLearningPackagesToDB(id, packages)
          } catch {
          }
        }

        return packages
      }

      return []
    } catch {
      if (useCache) {
        try {
          const cached = await loadLearningPackagesFromDB(id)
          if (cached && Array.isArray(cached)) {
            return cached
          }
        } catch {
        }
      }

      return []
    }
  }

  public async fetchUserAllOnlineTextbooks(): Promise<UserTextbookInfo[]> {
    const endpoint = '/blw-edu-yb/api/app/teacher-textbook'

    const response = await this.callYanban<{
      code: number
      success: boolean
      message: string
      data: UserTextbookInfo[]
    }>(endpoint, {})

    const respData = response.data as any
    const textbooks = respData?.data || respData

    if (response.success && Array.isArray(textbooks)) {
      const BASE_URL = 'https://www.imates.com.cn:9099'

      return textbooks.map((textbook: UserTextbookInfo) => {
        if (textbook.textbookCover && !textbook.textbookCover.startsWith('http')) {
          textbook.textbookCover = BASE_URL + textbook.textbookCover
        }
        return textbook
      })
    }

    return []
  }

  public async submitTopicAnswer(id: string, answerContent: string[]): Promise<boolean> {
    const requestBody = {
      id,
      answerContent,
    }

    const endpoint = '/blw-edu-yb/api/app/topic-package-answer'
    const envType = getCurrentEnvType()

    const response = await (async () => {
      if (envType === AppEnvType.INTERNAL_TEST && this.androidBridge.isAndroidBridgeAvailable()) {
        const apiPath = endpoint.replace('/blw-edu-yb', '')
        const yanbanToken = getYanbanToken() || ''
        const result = await this.androidBridge.callYanbanApi(apiPath, requestBody, 'POST', envType, yanbanToken)
        return {
          success: (result as any)?.success ?? false,
          data: ((result as any)?.data ?? result) as any,
          code: (result as any)?.code ?? ((result as any)?.success ? 200 : 0),
          message: (result as any)?.message,
        }
      }

      return httpClient.post<{
        code?: number
        data?: unknown
        message?: string
      }>(endpoint, requestBody)
    })()

    return !!(response.success && (response as any).data?.code === 200)
  }

  public async getTopicPackagePage(
    pageNumber: number,
    pageSize: number,
    updateTime?: string,
    subject?: string,
  ): Promise<TopicPackagePageResponse | null> {
    const endpoint = '/blw-edu-yb/api/app/topic-package-page'
    const requestBody = { pageNumber, pageSize, updateTime, subject }
    const envType = getCurrentEnvType()

    const response = await (async () => {
      if (envType === AppEnvType.INTERNAL_TEST && this.androidBridge.isAndroidBridgeAvailable()) {
        const apiPath = endpoint.replace('/blw-edu-yb', '')
        const yanbanToken = getYanbanToken() || ''
        const result = await this.androidBridge.callYanbanApi(apiPath, requestBody, 'POST', envType, yanbanToken)
        return {
          success: (result as any)?.success ?? false,
          data: ((result as any)?.data ?? result) as any,
          code: (result as any)?.code ?? ((result as any)?.success ? 200 : 0),
          message: (result as any)?.message,
        }
      }

      return httpClient.post<any>(endpoint, requestBody)
    })()

    const respData = (response as any).data
    const pageData = respData?.data || respData

    if ((response as any).success && pageData) {
      return pageData as TopicPackagePageResponse
    }

    return null
  }

  /**
   * 下载教材资源 - 增量下载优化版本（只下载需要更新的文件）
   * 对应Android LearnResourceManager.downloadAllResources
   */
  public async downloadTextbook(
    textbook: UserTextbookInfo,
    onProgress?: (progress: number, downloadedCount: number, totalToDownload: number) => void,
  ): Promise<boolean> {
    const startTime = Date.now()
    try {
      // 第1步：初始化下载控制器
      const controller = new AbortController()
      this.downloadControllers.set(textbook.textbookId, controller)

      // 第2步：获取学习资源包（优先使用本地数据）
      let serverPackages: any[] = []

      if (textbook.learningPackages && textbook.learningPackages.length > 0) {
        serverPackages = textbook.learningPackages
      } else {
        serverPackages = await this.getServerLearningPackages(textbook)
      }

      if (!serverPackages || serverPackages.length === 0) {
        return true
      }

      // 第3步：增量文件筛选（收集需要更新的文件）
      const { filesToUpdate, totalServerFiles } = await this.collectFilesToUpdate(textbook, serverPackages)
      const filesToDownload = filesToUpdate.length

      // 第4步：保存学习资源包到IndexedDB
      const rm = ResourceManager.getInstance()
      await rm.updateTextbookInfo(textbook, undefined)

      // 第5步：设置教材总文件数
      const textbooks = await rm.getUserLocalTextbooks()
      const textbookRecord = textbooks.find(t => t.textbookId === textbook.textbookId)
      if (textbookRecord) {
        textbookRecord.totalFiles = totalServerFiles
        await rm.updateTextbookInfo(textbookRecord, { totalFiles: totalServerFiles })
      }
      textbook.totalFiles = totalServerFiles

      if (filesToDownload === 0) {
        return true
      }

      // 第6步：并发下载需要更新的文件
      const alreadyDownloadedFiles = totalServerFiles - filesToDownload

      const result = await this.downloadFilesConcurrently(
        filesToUpdate,
        filesToDownload,
        textbook.textbookId,
        controller,
        (progress, newlyDownloadedCount) => {
          const totalDownloadedFiles = alreadyDownloadedFiles + newlyDownloadedCount
          onProgress?.(progress, totalDownloadedFiles, filesToDownload)
        },
        textbook,
      )

      // 第7步：强制刷新IndexedDB
      await rm.forceFlushPendingUpdates()

      // 第8步：清理下载控制器
      this.downloadControllers.delete(textbook.textbookId)

      return result.successCount === filesToDownload
    } catch (error) {
      console.error('[TextbookDownloadApi.下载] 下载过程发生异常', {
        textbookId: textbook.textbookId,
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        elapsedTime: Date.now() - startTime + 'ms',
      })

      if (error instanceof Error && error.name === 'AbortError') {
        this.downloadControllers.delete(textbook.textbookId)
        throw error
      }

      this.downloadControllers.delete(textbook.textbookId)
      return false
    }
  }

  private async getServerLearningPackages(textbook: UserTextbookInfo): Promise<any[]> {
    let serverPackages: any[]

    if (textbook.learningPackages && textbook.learningPackages.length > 0) {
      serverPackages = textbook.learningPackages
    } else {
      serverPackages = await this.getLearningResources(textbook.id)

      if (!serverPackages || serverPackages.length === 0) {
        return []
      }

      textbook.learningPackages = serverPackages
    }

    return serverPackages
  }

  private async collectFilesToUpdate(textbook: UserTextbookInfo, serverPackages: any[]): Promise<{
    filesToUpdate: Array<{ resource: any; pkg: any }>
    totalServerFiles: number
  }> {
    const filesToUpdate: Array<{ resource: any; pkg: any }> = []
    let totalServerFiles = 0

    const localLearningPackages = textbook.learningPackages || []

    const rm = ResourceManager.getInstance()
    let latestTextbook = await rm.getTextbookByIdOrTextbookIdWithFallback(
      textbook.id,
      textbook.textbookId,
      'TextbookDownloadApi.collectFilesToUpdate',
    )

    if (!latestTextbook) {
      latestTextbook = textbook
    }

    const localFiles = latestTextbook.localFiles || []
    const localFileMap = new Map<string, LocalFileInfo>()
    for (const file of localFiles) {
      localFileMap.set(file.id, file)
    }

    for (const serverPackage of serverPackages) {
      if (serverPackage.resourceList && serverPackage.resourceList.length > 0) {
        totalServerFiles += serverPackage.resourceList.length

        const localLearningPackage = localLearningPackages.find(p => p.packageId === serverPackage.packageId)
        if (!localLearningPackage) {
          for (const resource of serverPackage.resourceList) {
            filesToUpdate.push({ resource, pkg: serverPackage })
          }
        } else {
          for (const serverFile of serverPackage.resourceList) {
            const localFile = localFileMap.get(serverFile.id)

            let needsDownload = false
            if (!localFile) {
              needsDownload = true
            } else if (serverFile.checksum !== localFile.checksum) {
              needsDownload = true
            } else {
              const textbookId = latestTextbook.id || latestTextbook.textbookId || ''
              if (textbookId) {
                const hasFileData = await rm.hasFileData(textbookId, serverFile.id)
                if (!hasFileData) {
                  needsDownload = true
                }
              } else {
                needsDownload = true
              }
            }

            if (needsDownload) {
              filesToUpdate.push({ resource: serverFile, pkg: serverPackage })
            }
          }
        }
      }
    }

    return { filesToUpdate, totalServerFiles }
  }

  private parseChapterOrderFromFileName(fileName: string): number {
    return parseChapterOrderFromFileNameUtil(fileName)
  }

  private async downloadFilesConcurrently(
    allResources: Array<{ resource: any; pkg: any }>,
    totalFiles: number,
    textbookId: string,
    controller: AbortController,
    onProgress?: (progress: number, downloadedCount: number) => void,
    textbook?: any,
  ): Promise<{ successCount: number; errorCount: number; totalDownloadedBytes: number; averageSpeed: string }> {
    const downloadStartTime = Date.now()
    let totalDownloadedBytes = 0

    const CONCURRENT_DOWNLOADS = 6
    const downloadQueue = [...allResources]
    const results: Array<{ success: boolean; fileName: string; fileSize: number }> = []
    let completedFiles = 0
    let successCount = 0
    let errorCount = 0

    const downloadTask = async (resourceInfo: { resource: any; pkg: any }): Promise<void> => {
      const { resource, pkg } = resourceInfo

      if (controller.signal.aborted) {
        results.push({ success: false, fileName: resource.fileName, fileSize: 0 })
        errorCount++
        return
      }

      try {
        const fileData = await this.downloadSingleFileStreaming(resource, controller)

        if (fileData) {
          totalDownloadedBytes += fileData.length

          try {
            const rm = ResourceManager.getInstance()
            const chapterOrder = this.parseChapterOrderFromFileName(resource.fileName)

            const fileInfo = {
              id: resource.id,
              textbookId: textbookId,
              packageId: pkg.packageId,
              fileName: resource.fileName,
              fileType: resource.fileType || 'unknown',
              fileSize: fileData.length,
              checksum: resource.checksum,
              chapterOrder: chapterOrder,
              sortOrder: chapterOrder,
            }

            await rm.storeFileData(fileInfo, fileData, textbook)
          } catch {
          }

          results.push({ success: true, fileName: resource.fileName, fileSize: fileData.length })
          successCount++
        } else {
          results.push({ success: false, fileName: resource.fileName, fileSize: 0 })
          errorCount++
        }
      } catch {
        results.push({ success: false, fileName: resource.fileName, fileSize: 0 })
        errorCount++
      } finally {
        completedFiles++
        const progress = Math.round((completedFiles / totalFiles) * 100)
        onProgress?.(progress, successCount)
      }
    }

    const downloadPromises: Promise<void>[] = []
    for (let i = 0; i < Math.min(CONCURRENT_DOWNLOADS, downloadQueue.length); i++) {
      const resourceInfo = downloadQueue.shift()
      if (resourceInfo) {
        downloadPromises.push(downloadTask(resourceInfo))
      }
    }

    while (downloadQueue.length > 0) {
      if (controller.signal.aborted) {
        break
      }

      await Promise.race(downloadPromises.filter(p => p))

      const newResource = downloadQueue.shift()
      if (newResource) {
        downloadPromises.push(downloadTask(newResource))
      }
    }

    await Promise.all(downloadPromises)

    const downloadDuration = Date.now() - downloadStartTime
    const downloadDurationSeconds = downloadDuration / 1000
    const averageSpeed = downloadDurationSeconds > 0 ? `${(totalDownloadedBytes / downloadDurationSeconds / 1024 / 1024).toFixed(2)}MB/s` : '0B/s'

    if (controller.signal.aborted) {
      throw new DOMException('下载被用户取消', 'AbortError')
    }

    return { successCount, errorCount, totalDownloadedBytes, averageSpeed }
  }

  private async downloadSingleFileStreaming(
    resource: { fileName: string; fileUrl: string; checksum?: string },
    controller: AbortController,
  ): Promise<Uint8Array | null> {
    try {
      const resourceUrl = resource.fileUrl.startsWith('/') ? resource.fileUrl : `/${resource.fileUrl}`

      const response = await httpClient.downloadStream(resourceUrl, {
        signal: controller.signal,
      })

      if (!response.body) {
        throw new Error('响应体为空')
      }

      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []

      try {
        while (true) {
          if (controller.signal.aborted) {
            reader.releaseLock()
            throw new Error('Download aborted')
          }

          const { done, value } = await reader.read()
          if (done) break

          chunks.push(value)
        }
      } finally {
        reader.releaseLock()
      }

      const result = this.mergeChunksEfficiently(chunks)

      if (resource.checksum) {
        const rm = ResourceManager.getInstance()
        const isValid = await rm.verifyLocalFileIntegrity(result, resource.checksum)
        if (!isValid) {
          throw new Error(`文件校验失败: ${resource.fileName}`)
        }
      }

      return result
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Download aborted')) {
        return null
      }

      return null
    }
  }

  private mergeChunksEfficiently(chunks: Uint8Array[]): Uint8Array {
    if (chunks.length === 0) {
      return new Uint8Array(0)
    }

    if (chunks.length === 1) {
      return chunks[0]
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  }

  /**
   * 检查教材更新 - 三级对比版本
   * 对应Android LearnResourceManager.checkForUpdates
   * 实现教材→包→文件三级对比逻辑
   */
  public async checkForUpdates(): Promise<TextbookVersion[]> {
    try {
      // 第1步：获取服务器端教材版本列表
      const serverTextbooks = await this.getTextbookVersions()

      // 第2步：获取本地教材信息
      const localTextbooks = await resourceManager.getUserLocalTextbooks()

      // 第3步：执行三级对比检查
      const updatedTextbooks: TextbookVersion[] = []

      for (const serverTextbook of serverTextbooks) {
        const localTextbook = localTextbooks.find((t: UserTextbookInfo) => t.textbookId === serverTextbook.textbookId)

        // 检查是否需要更新
        const needsUpdate = await this.checkTextbookUpdate(serverTextbook, localTextbook)

        if (needsUpdate) {
          updatedTextbooks.push(serverTextbook)
        }
      }

      return updatedTextbooks
    } catch (error) {
      return []
    }
  }

  /**
   * 检查单个教材是否需要更新 - 三级对比逻辑
   * 对应Android LearnResourceManager.checkTextbookUpdate
   */
  private async checkTextbookUpdate(serverTextbook: TextbookVersion, localTextbook?: UserTextbookInfo): Promise<boolean> {
    try {
      // 第一级：教材级别检查
      if (!localTextbook) {
        return true
      }

      // 教材更新时间比较
      const textbookUpdated = this.isNewer(serverTextbook.textbookUpdateTime, localTextbook.textbookUpdateTime)

      if (textbookUpdated) {
        return true
      }

      // 第二级：包级别检查
      const packageUpdated = await this.checkLearningPackageUpdates(serverTextbook, localTextbook)

      if (packageUpdated) {
        return true
      }

      return false
    } catch (error) {
      // 出错时默认需要更新（安全策略）
      return true
    }
  }

  /**
   * 检查学习包更新
   * 对应Android LearnResourceManager.checkLearningPackageUpdates
   */
  private async checkLearningPackageUpdates(serverTextbook: TextbookVersion, localTextbook: UserTextbookInfo): Promise<boolean> {
    try {
      // 获取服务器端学习包
      const serverPackages = await this.getLearningResources(serverTextbook.id)

      // 获取本地学习包
      const localPackages = localTextbook.learningPackages || []

      for (const serverPackage of serverPackages) {
        const localPackage = localPackages.find(p => p.id === serverPackage.id)

        if (!localPackage) {
          return true
        }

        // 包更新时间比较
        if (this.isNewer(serverPackage.updateTime, localPackage.updateTime)) {
          return true
        }

        // 第三级：文件级别检查
        const fileUpdated = this.hasFileUpdates(serverPackages, localTextbook)

        if (fileUpdated) {
          return true
        }
      }

      // 检查是否有包被删除
      for (const localPackage of localPackages) {
        const foundOnServer = serverPackages.some(p => p.id === localPackage.id)
        if (!foundOnServer) {
          return true
        }
      }

      return false
    } catch (error) {
      return true
    }
  }

  /**
   * 检查文件更新 - 重构版本，现在使用textbook.localFiles
   * 对应Android LearnResourceManager.hasFileUpdates
   * 检查整个教材的所有文件，而不是单个包的文件
   */
  private hasFileUpdates(serverPackages: LearningPackage[], textbook: UserTextbookInfo): boolean {
    try {
      // 如果教材没有localFiles属性，说明还没有下载过，需要更新
      if (!textbook.localFiles || !Array.isArray(textbook.localFiles)) {
        return true
      }

      // 收集所有服务器文件
      const allServerFiles: ResourceFile[] = []
      for (const serverPackage of serverPackages) {
        if (serverPackage.resourceList && serverPackage.resourceList.length > 0) {
          allServerFiles.push(...serverPackage.resourceList)
        }
      }

      // 检查服务器文件
      for (const serverFile of allServerFiles) {
        const localFile = textbook.localFiles.find(f => f.id === serverFile.id)

        if (!localFile) {
          return true
        }

        // 文件校验和比较
        if (serverFile.checksum !== localFile.checksum) {
          return true
        }
      }

      // 检查是否有文件被删除
      for (const localFile of textbook.localFiles) {
        const foundOnServer = allServerFiles.some(f => f.id === localFile.id)
        if (!foundOnServer) {
          return true
        }
      }

      return false
    } catch (error) {
      return true
    }
  }

  /**
   * 时间比较方法
   * 对应Android LearnResourceManager.isNewer
   */
  private isNewer(newTime: string, oldTime: string): boolean {
    try {
      const newDate = new Date(newTime)
      const oldDate = new Date(oldTime)

      if (isNaN(newDate.getTime()) || isNaN(oldDate.getTime())) {
        return true // 解析失败时默认需要更新（安全策略）
      }

      return newDate > oldDate
    } catch (error) {
      return true // 出错时默认需要更新（安全策略）
    }
  }
}

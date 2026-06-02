import { httpClient } from './http-client'
import { resourceManager, ResourceManager } from '../storage/resource-storage'
import { AndroidBridge } from '../business/android-bridge'
import { parseChapterOrderFromFileName as parseChapterOrderFromFileNameUtil } from '@/utils/business/chapter-utils'
import { getApiPaths, getIsInternalTest } from '@/config/env-config'
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

/**
 * 动态配额调度器
 * 实现逻辑：
 * 1. 全局总并发限制为 6。
 * 2. 单个教材最大并发限制为 4（“最多四格”）。
 * 3. 动态计算每本书的配额：quota = min(4, floor(6 / 活跃教材数))，最小为 1。
 */
class DynamicDownloadScheduler {
  private activeTextbookIds = new Set<string>();
  private globalActiveCount = 0;
  private readonly globalLimit = 6;
  private readonly perTextbookLimit = 4;
  private waitingTasks: Array<{
    textbookId: string;
    resolve: () => void;
  }> = [];

  // 教材注册/注销（在下载开始和结束时调用）
  registerTextbook(textbookId: string) {
    this.activeTextbookIds.add(textbookId);
  }

  unregisterTextbook(textbookId: string) {
    this.activeTextbookIds.delete(textbookId);
    this.checkWaitingTasks();
  }

  async acquire(textbookId: string): Promise<void> {
    if (this.canExecute(textbookId)) {
      this.globalActiveCount++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waitingTasks.push({ textbookId, resolve });
    });
  }

  release(textbookId: string) {
    this.globalActiveCount--;
    this.checkWaitingTasks();
  }

  private canExecute(textbookId: string): boolean {
    if (this.globalActiveCount >= this.globalLimit) return false;

    const activeCount = this.activeTextbookIds.size;
    if (activeCount <= 1) return true;

    // 计算当前教材应得的动态配额
    const quota = Math.max(1, Math.floor(this.globalLimit / activeCount));
    
    // 统计当前教材正在运行的任务数
    const textbookActiveCount = this.getTextbookActiveCount(textbookId);
    
    return textbookActiveCount < quota;
  }

  private getTextbookActiveCount(textbookId: string): number {
    // 简单实现：通过当前正在执行的任务数统计
    // 这里我们可以简化逻辑，或者在内部维护一个 Map
    return this.runningTasksInTextbook.get(textbookId) || 0;
  }

  private runningTasksInTextbook = new Map<string, number>();

  // 增强版的 acquire/release 逻辑
  async acquireStrict(textbookId: string): Promise<void> {
    while (true) {
      const activeCount = this.activeTextbookIds.size;
      // 计算动态配额：全局 6 个，单本最高 4 个
      let quota = activeCount > 0 ? Math.floor(this.globalLimit / activeCount) : this.globalLimit;
      quota = Math.min(this.perTextbookLimit, Math.max(1, quota));
      
      const currentRunning = this.runningTasksInTextbook.get(textbookId) || 0;

      if (this.globalActiveCount < this.globalLimit && currentRunning < quota) {
        this.globalActiveCount++;
        this.runningTasksInTextbook.set(textbookId, currentRunning + 1);
        return;
      }
      
      await new Promise<void>(resolve => {
        this.waitingTasks.push({ textbookId, resolve });
      });
    }
  }

  releaseStrict(textbookId: string) {
    this.globalActiveCount--;
    const currentRunning = this.runningTasksInTextbook.get(textbookId) || 0;
    this.runningTasksInTextbook.set(textbookId, Math.max(0, currentRunning - 1));
    this.checkWaitingTasks();
  }

  private checkWaitingTasks() {
    if (this.waitingTasks.length === 0) return;

    const activeCount = this.activeTextbookIds.size;
    let quota = activeCount > 0 ? Math.floor(this.globalLimit / activeCount) : this.globalLimit;
    quota = Math.min(this.perTextbookLimit, Math.max(1, quota));

    for (let i = 0; i < this.waitingTasks.length; i++) {
      const task = this.waitingTasks[i];
      const currentRunning = this.runningTasksInTextbook.get(task.textbookId) || 0;

      if (this.globalActiveCount < this.globalLimit && currentRunning < quota) {
        this.waitingTasks.splice(i, 1);
        task.resolve();
        break;
      }
    }
  }
}

const SCHEDULER = new DynamicDownloadScheduler();

export class TextbookDownloadApi {
  private readonly androidBridge: AndroidBridge

  // 下载请求管理
  private downloadControllers = new Map<string, AbortController>() // 存储每个教材的下载控制器

  constructor(androidBridge: AndroidBridge) {
    this.androidBridge = androidBridge
  }

  private safeArraySample<T>(arr: T[] | undefined | null, max: number = 5): T[] {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return []
    return arr.slice(0, max)
  }

  private createEmptyLearningPackagesError(textbookId: string): Error {
    const err = new Error('EMPTY_LEARNING_PACKAGES')
    err.name = 'EmptyLearningPackages'
    ;(err as any).textbookId = textbookId
    return err
  }

  private normalizeFileUrl(fileUrl: string): string {
    if (!fileUrl) return fileUrl

    const resourceBase = getApiPaths().yanban.resource.base

    if (fileUrl.startsWith('/resource/')) {
      return `${resourceBase}${fileUrl.substring('/resource'.length)}`
    }

    return fileUrl
  }

  private async reconcileExtraLocalFiles(
    serverPackages: LearningPackage[],
    textbook: UserTextbookInfo,
    context?: { textbookId?: string; serverId?: string; textbookName?: string },
  ): Promise<void> {
    try {
      if (!textbook.localFiles || !Array.isArray(textbook.localFiles) || textbook.localFiles.length === 0) {
        return
      }

      const serverFileIdSet = new Set<string>()
      let serverFilesCount = 0
      for (const pkg of serverPackages || []) {
        const list = (pkg as any)?.resourceList as ResourceFile[] | undefined
        if (Array.isArray(list) && list.length > 0) {
          serverFilesCount += list.length
          for (const f of list) {
            if (f?.id) serverFileIdSet.add(f.id)
          }
        }
      }

      const extraLocalFiles = (textbook.localFiles || []).filter(f => f?.id && !serverFileIdSet.has(f.id))
      if (extraLocalFiles.length === 0) {
        return
      }

      console.warn('[TextbookDownloadApi.reconcileExtraLocalFiles] 严格对账：检查更新时发现本地多余文件，开始自动清理', {
        ...context,
        localTextbookRecordId: (textbook as any).id,
        serverFilesCount,
        localFilesCount: (textbook.localFiles || []).length,
        extraCount: extraLocalFiles.length,
        extraFileIds: extraLocalFiles.map(f => f.id).slice(0, 5),
        extraFileNames: extraLocalFiles.map(f => (f as any).fileName).slice(0, 5),
      })

      try {
        const deletePromises = extraLocalFiles.map(f => resourceManager.indexedDB.delete('textbook_files', f.id))
        await Promise.allSettled(deletePromises)
      } catch {
      }

      const extraIdSet = new Set(extraLocalFiles.map(f => f.id))
      const prunedLocalFiles = (textbook.localFiles || []).filter(f => f?.id && !extraIdSet.has(f.id))
      textbook.localFiles = prunedLocalFiles
      textbook.downloadedFiles = Math.min(textbook.downloadedFiles || 0, serverFilesCount)

      await resourceManager.updateTextbookInfo(textbook, {
        localFiles: prunedLocalFiles,
        downloadedFiles: textbook.downloadedFiles,
      })
    } catch (error) {
      console.warn('[TextbookDownloadApi.reconcileExtraLocalFiles] 严格对账清理失败', {
        ...context,
        localTextbookRecordId: (textbook as any).id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
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

  public async getTextbookVersions(): Promise<TextbookVersion[]> {
    const endpoint = getApiPaths().yanban.textbook.teacherTextbook

    const response = await httpClient.post<{
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
    const endpoint = getApiPaths().yanban.textbook.teacherTextbookSectionTree
    const request: TextbookStructureRequest = { id }

    const response = await httpClient.post<{
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
    const endpoint = getApiPaths().yanban.textbook.teacherTextbookLearningPackage
    const request: LearningResourcesRequest = { id }

    try {
      const response = await httpClient.post<{ data: LearningPackage[] }>(endpoint, request)

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
          resourceList: Array.isArray((pkg as any).resourceList)
            ? ((pkg as any).resourceList as ResourceFile[]).map((r: ResourceFile) => {
                const rewritten = this.normalizeFileUrl((r as any).fileUrl)
                return { ...(r as any), fileUrl: rewritten } as ResourceFile
              })
            : [],
        }))

        return packages
      }

      return []
    } catch {
      return []
    }
  }

  public async fetchUserAllOnlineTextbooks(): Promise<UserTextbookInfo[]> {
    const endpoint = getApiPaths().yanban.textbook.teacherTextbook

    const response = await httpClient.post<{
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

    const endpoint = getApiPaths().yanban.textbook.topicPackageAnswer
    const response = await httpClient.post<{
      code?: number
      data?: unknown
      message?: string
    }>(endpoint, requestBody)

    return !!(response.success && (response as any).data?.code === 200)
  }

  public async getTopicPackagePage(
    pageNumber: number,
    pageSize: number,
    updateTime?: string,
    subject?: string,
  ): Promise<TopicPackagePageResponse | null> {
    const endpoint = getApiPaths().yanban.textbook.topicPackagePage
    const requestBody = { pageNumber, pageSize, updateTime, subject }
    const response = await httpClient.post<any>(endpoint, requestBody)

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
      // 注册教材到调度器
      SCHEDULER.registerTextbook(textbook.textbookId);
      
      // 初始化下载控制器
      const controller = new AbortController()
      this.downloadControllers.set(textbook.textbookId, controller)

      // 获取学习资源包（优先使用本地数据）
      let serverPackages: any[] = []

      if (textbook.learningPackages && textbook.learningPackages.length > 0) {
        serverPackages = textbook.learningPackages
      } else {
        serverPackages = await this.getServerLearningPackages(textbook)
      }

      if (!serverPackages || serverPackages.length === 0) {
        throw this.createEmptyLearningPackagesError(textbook.textbookId)
      }

      // 增量文件筛选（收集需要更新的文件）
      const { filesToUpdate, totalServerFiles } = await this.collectFilesToUpdate(textbook, serverPackages)
      const filesToDownload = filesToUpdate.length

      // 保存学习资源包到IndexedDB
      const rm = ResourceManager.getInstance()
      await rm.updateTextbookInfo(textbook, undefined)

      // 设置教材总文件数
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

      // 并发下载需要更新的文件
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

      // 强制刷新IndexedDB
      await rm.forceFlushPendingUpdates()

      // 清理下载控制器并从调度器注销
      this.downloadControllers.delete(textbook.textbookId)
      SCHEDULER.unregisterTextbook(textbook.textbookId);

      return result.successCount === filesToDownload
    } catch (error) {
      // 确保发生异常时也能注销
      SCHEDULER.unregisterTextbook(textbook.textbookId);
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

      if (error instanceof Error && error.name === 'EmptyLearningPackages') {
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
    // 更新/下载阶段严格按教材版本 id 对账（不使用 textbookId 回退），避免多版本/历史残留时清理写回到错误记录。
    let latestTextbook: UserTextbookInfo | null = null
    try {
      latestTextbook = await rm.getTextbookInfoById(textbook.id)
    } catch {
      latestTextbook = null
    }

    if (!latestTextbook) {
      console.warn('[TextbookDownloadApi.collectFilesToUpdate] 未在本地按教材版本id找到教材记录，将使用传入对象进行对账/清理（可能无法持久化）', {
        textbookId: textbook.textbookId,
        localTextbookRecordId: textbook.id,
        textbookName: textbook.textbookName,
      })
      latestTextbook = textbook
    } else if (latestTextbook.id !== textbook.id) {
      console.warn('[TextbookDownloadApi.collectFilesToUpdate] 本地教材记录id与传入教材id不一致（可能导致对账/清理不生效）', {
        textbookId: textbook.textbookId,
        passedInId: textbook.id,
        loadedLocalId: latestTextbook.id,
        textbookName: textbook.textbookName,
      })
    }

    const localFiles = latestTextbook.localFiles || []
    const localFileMap = new Map<string, LocalFileInfo>()
    for (const file of localFiles) {
      localFileMap.set(file.id, file)
    }

    // 严格对账：如果本地存在服务端已经移除的文件，需要同步清理本地数据，避免一直提示“有更新”。
    // 清理策略：
    // 1) 删除 textbook_files 表中的 fileData（key 为文件 id）
    // 2) 从 textbooks.localFiles 元数据中移除该文件
    // 说明：这里的“服务端文件全集”来自 serverPackages 的 resourceList 合并。
    const serverFileIdSet = new Set<string>()

    for (const serverPackage of serverPackages) {
      if (serverPackage.resourceList && serverPackage.resourceList.length > 0) {
        totalServerFiles += serverPackage.resourceList.length

        for (const resource of serverPackage.resourceList) {
          if (resource?.id) {
            serverFileIdSet.add(resource.id)
          }
        }

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

    const extraLocalFiles = localFiles.filter(f => f?.id && !serverFileIdSet.has(f.id))
    if (extraLocalFiles.length > 0) {
      console.warn('[TextbookDownloadApi.collectFilesToUpdate] 严格对账：发现本地存在服务端已移除的文件，开始清理', {
        textbookId: latestTextbook.textbookId,
        localTextbookRecordId: latestTextbook.id,
        extraCount: extraLocalFiles.length,
        extraFileIds: extraLocalFiles.map(f => f.id).slice(0, 5),
        extraFileNames: extraLocalFiles.map(f => f.fileName).slice(0, 5),
      })

      try {
        const deletePromises = extraLocalFiles.map(f => rm.indexedDB.delete('textbook_files', f.id))
        await Promise.allSettled(deletePromises)

        const extraIdSet = new Set(extraLocalFiles.map(f => f.id))
        const prunedLocalFiles = localFiles.filter(f => f?.id && !extraIdSet.has(f.id))

        latestTextbook.localFiles = prunedLocalFiles
        // downloadedFiles 代表“服务端清单中的已下载数量”，清理掉服务端不存在文件后需要夹逼。
        latestTextbook.downloadedFiles = Math.min(latestTextbook.downloadedFiles || 0, totalServerFiles)

        // 同步更新传入的 textbook 对象，避免后续 updateTextbookInfo(textbook, undefined)
        // 将旧 localFiles 再次写回 IndexedDB 导致清理被回滚。
        if (textbook && textbook.id === latestTextbook.id) {
          textbook.localFiles = prunedLocalFiles
          textbook.downloadedFiles = latestTextbook.downloadedFiles
        }

        await rm.updateTextbookInfo(latestTextbook, {
          localFiles: prunedLocalFiles,
          downloadedFiles: latestTextbook.downloadedFiles,
        })
      } catch (error) {
        console.warn('[TextbookDownloadApi.collectFilesToUpdate] 严格对账：清理本地多余文件失败（将继续按需要更新处理）', {
          textbookId: latestTextbook.textbookId,
          localTextbookRecordId: latestTextbook.id,
          error: error instanceof Error ? error.message : String(error),
        })
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

      // 获取全局下载名额（动态配额管理）
      await SCHEDULER.acquireStrict(textbookId)

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
        // 释放名额
        SCHEDULER.releaseStrict(textbookId)
        
        completedFiles++
        // 进度精确到小数点后两位
        const progress = parseFloat(((completedFiles / totalFiles) * 100).toFixed(2))
        onProgress?.(progress, successCount)
      }
    }

    // 优化：不再使用私有 while 循环进行贪婪补充
    // 而是直接一次性将所有任务映射为 Promise 数组
    // 依赖全局 Semaphore 进行流量调度
    const allTaskPromises = allResources.map(resourceInfo => downloadTask(resourceInfo))

    // 并行等待所有任务完成（底层已由 Semaphore 控制并发）
    await Promise.all(allTaskPromises)

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
      // 获取服务器端教材版本列表
      const serverTextbooks = await this.getTextbookVersions()

      // 获取本地教材信息
      const localTextbooks = await resourceManager.getUserLocalTextbooks()

      // 执行三级对比检查
      const updatedTextbooks: TextbookVersion[] = []

      for (const serverTextbook of serverTextbooks) {
        // 三级对比：本地教材必须按“教材版本id（serverTextbook.id）”匹配
        // 不使用 textbookId，避免同 textbookId 多版本时拿错本地记录导致误判。
        const localTextbook = localTextbooks.find((t: UserTextbookInfo) => t.id === serverTextbook.id)

        // 只对已下载的教材进行更新检查
        if (!localTextbook || !localTextbook.isDownloaded) {
          continue
        }

        // 检查是否需要更新（仅对已下载的教材）
        const needsUpdate = await this.checkTextbookUpdate(serverTextbook, localTextbook)

        if (needsUpdate) {
          console.warn('[TextbookDownloadApi.checkForUpdates] 教材需要更新', {
            textbookId: serverTextbook.textbookId,
            serverId: serverTextbook.id,
            textbookName: serverTextbook.textbookName,
          })
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
        console.warn('[TextbookDownloadApi.checkTextbookUpdate] 需要更新：本地无教材记录', {
          textbookId: serverTextbook.textbookId,
          serverId: serverTextbook.id,
          textbookName: serverTextbook.textbookName,
        })
        return true
      }

      // 教材更新时间比较
      const textbookUpdated = this.isNewer(serverTextbook.textbookUpdateTime, localTextbook.textbookUpdateTime)

      if (textbookUpdated) {
        console.warn('[TextbookDownloadApi.checkTextbookUpdate] 需要更新：教材更新时间变更', {
          textbookId: serverTextbook.textbookId,
          serverId: serverTextbook.id,
          textbookName: serverTextbook.textbookName,
          serverTextbookUpdateTime: serverTextbook.textbookUpdateTime,
          localTextbookUpdateTime: localTextbook.textbookUpdateTime,
        })
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
      let localPackages = localTextbook.learningPackages || []

      // 策略：如果服务端确实没有学习包数据，且本地也没有学习包数据，则认为“无可更新内容”，不标记更新。
      if (!Array.isArray(serverPackages) || serverPackages.length === 0) {
        if (!localPackages || localPackages.length === 0) {
          return false
        }
        // 服务端为空但本地不为空：可能为服务端删除/异常，按需要更新处理
        return true
      }

      // 按需求：仅使用 localTextbook.learningPackages 作为本地学习包来源。
      // 如果为空，则视为本地无学习包数据，需要更新。
      if (!localPackages || localPackages.length === 0) {
        // 自愈：如果服务端已经返回了学习包（非空），说明“本地无学习包”只是未持久化/历史数据缺失。
        // 这种情况不应当长期导致“需要更新”，因此在检查更新时将服务端学习包写回教材表。
        if (Array.isArray(serverPackages) && serverPackages.length > 0) {
          // 先用服务端数据作为本次对比口径，避免因写回失败导致误判需要更新
          localPackages = serverPackages
          try {
            localTextbook.learningPackages = serverPackages
            await resourceManager.updateTextbookInfo(localTextbook, {
              learningPackages: serverPackages,
            })

            console.warn('[TextbookDownloadApi.checkLearningPackageUpdates] 本地无学习包但服务端返回非空，已写回教材表用于后续对账', {
              textbookId: serverTextbook.textbookId,
              serverId: serverTextbook.id,
              textbookName: serverTextbook.textbookName,
              localTextbookRecordId: (localTextbook as any).id,
              serverPackagesCount: serverPackages.length,
            })

            localPackages = serverPackages
          } catch (error) {
            console.warn('[TextbookDownloadApi.checkLearningPackageUpdates] 写回教材表learningPackages失败，仍按需要更新处理', {
              textbookId: serverTextbook.textbookId,
              serverId: serverTextbook.id,
              textbookName: serverTextbook.textbookName,
              localTextbookRecordId: (localTextbook as any).id,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }

        // 如果自愈写回失败或服务端返回空，则仍认为需要更新
        if (!localPackages || localPackages.length === 0) {
          console.warn('[TextbookDownloadApi.checkLearningPackageUpdates] 需要更新：本地无学习包缓存', {
            textbookId: serverTextbook.textbookId,
            serverId: serverTextbook.id,
            textbookName: serverTextbook.textbookName,
            localTextbookRecordId: (localTextbook as any).id,
            localTextbookIdMatchesServerId: (localTextbook as any).id === serverTextbook.id,
            serverPackagesCount: Array.isArray(serverPackages) ? serverPackages.length : 0,
          })
          return true
        }
      }

      for (const serverPackage of serverPackages) {
        const localPackage = localPackages.find(p => p.id === serverPackage.id)

        if (!localPackage) {
          console.warn('[TextbookDownloadApi.checkLearningPackageUpdates] 需要更新：发现新学习包/本地缺包', {
            textbookId: serverTextbook.textbookId,
            serverId: serverTextbook.id,
            textbookName: serverTextbook.textbookName,
            serverPackageId: (serverPackage as any).id,
          })
          return true
        }

        // 包更新时间比较
        if (this.isNewer(serverPackage.updateTime, localPackage.updateTime)) {
          console.warn('[TextbookDownloadApi.checkLearningPackageUpdates] 需要更新：学习包更新时间变更', {
            textbookId: serverTextbook.textbookId,
            serverId: serverTextbook.id,
            textbookName: serverTextbook.textbookName,
            packageId: (serverPackage as any).id,
            serverUpdateTime: (serverPackage as any).updateTime,
            localUpdateTime: (localPackage as any).updateTime,
          })
          return true
        }

        // 第三级：文件级别检查
        const fileUpdated = this.hasFileUpdates(serverPackages, localTextbook, {
          textbookId: serverTextbook.textbookId,
          serverId: serverTextbook.id,
          textbookName: serverTextbook.textbookName,
        })

        if (fileUpdated) {
          return true
        }
      }

      // 检查是否有包被删除
      for (const localPackage of localPackages) {
        const foundOnServer = serverPackages.some(p => p.id === localPackage.id)
        if (!foundOnServer) {
          console.warn('[TextbookDownloadApi.checkLearningPackageUpdates] 需要更新：本地学习包在服务端已删除', {
            textbookId: serverTextbook.textbookId,
            serverId: serverTextbook.id,
            textbookName: serverTextbook.textbookName,
            localPackageId: (localPackage as any).id,
          })
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
  private hasFileUpdates(
    serverPackages: LearningPackage[],
    textbook: UserTextbookInfo,
    context?: { textbookId?: string; serverId?: string; textbookName?: string },
  ): boolean {
    try {
      // 如果教材没有localFiles属性，说明还没有下载过，需要更新
      if (!textbook.localFiles || !Array.isArray(textbook.localFiles)) {
        console.warn('[TextbookDownloadApi.hasFileUpdates] 需要更新：本地无localFiles', {
          ...context,
          localTextbookRecordId: (textbook as any).id,
        })
        return true
      }

      // 收集所有服务器文件
      const allServerFiles: ResourceFile[] = []
      for (const serverPackage of serverPackages) {
        if (serverPackage.resourceList && serverPackage.resourceList.length > 0) {
          allServerFiles.push(...serverPackage.resourceList)
        }
      }

      const serverFileIdSet = new Set(allServerFiles.map(f => f.id))
      const localFileIdSet = new Set((textbook.localFiles || []).map(f => f.id))

      // 检查服务器文件
      for (const serverFile of allServerFiles) {
        const localFile = textbook.localFiles.find(f => f.id === serverFile.id)

        if (!localFile) {
          console.warn('[TextbookDownloadApi.hasFileUpdates] 需要更新：本地缺文件', {
            ...context,
            localTextbookRecordId: (textbook as any).id,
            serverFileId: (serverFile as any).id,
            serverFileName: (serverFile as any).fileName,
            serverPackagesCount: Array.isArray(serverPackages) ? serverPackages.length : 0,
            serverFilesCount: allServerFiles.length,
            localFilesCount: (textbook.localFiles || []).length,
            sampleServerPackageIds: this.safeArraySample(serverPackages, 3).map(p => (p as any).id),
          })
          return true
        }

        // 文件校验和比较
        if (serverFile.checksum !== localFile.checksum) {
          console.warn('[TextbookDownloadApi.hasFileUpdates] 需要更新：文件checksum变化', {
            ...context,
            localTextbookRecordId: (textbook as any).id,
            fileId: (serverFile as any).id,
            serverChecksum: (serverFile as any).checksum,
            localChecksum: (localFile as any).checksum,
            serverFilesCount: allServerFiles.length,
            localFilesCount: (textbook.localFiles || []).length,
          })
          return true
        }
      }

      // 检查是否有文件被删除
      for (const localFile of textbook.localFiles) {
        const foundOnServer = allServerFiles.some(f => f.id === localFile.id)
        if (!foundOnServer) {
          const sampleExtraLocalFileIds: string[] = []
          for (const id of localFileIdSet) {
            if (!serverFileIdSet.has(id)) {
              sampleExtraLocalFileIds.push(id)
              if (sampleExtraLocalFileIds.length >= 5) break
            }
          }
          console.warn('[TextbookDownloadApi.hasFileUpdates] 需要更新：本地文件在服务端已删除', {
            ...context,
            localTextbookRecordId: (textbook as any).id,
            localFileId: (localFile as any).id,
            localFileName: (localFile as any).fileName,
            serverPackagesCount: Array.isArray(serverPackages) ? serverPackages.length : 0,
            serverFilesCount: allServerFiles.length,
            localFilesCount: (textbook.localFiles || []).length,
            serverReturnedNoFiles: allServerFiles.length === 0,
            sampleServerPackageIds: this.safeArraySample(serverPackages, 3).map(p => (p as any).id),
            sampleExtraLocalFileIds,
          })
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

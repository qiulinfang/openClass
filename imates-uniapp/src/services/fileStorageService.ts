import { StorageService } from './storageService'
import { ADDRESS_CATALOG } from '@/config/env-config'

/**
 * 本地文件元数据（对应 imates-web 的 LocalFileInfo）
 */
export interface LocalFileInfo {
  fileId: string
  textbookId: string
  fileName: string
  localPath: string       // uni.saveFile 后的本地沙箱路径
  fileSize: number
  checksum?: string       // 用于增量对账
  downloadedAt: string
}

/**
 * 下载进度回调
 */
export type DownloadProgressCallback = (progress: number, fileIndex: number, total: number) => void

/**
 * 文件下载存储服务（对应 imates-web 的 ResourceManager + TextbookDownloadApi）
 * - 使用 uni.downloadFile 真实下载文件到设备沙箱
 * - 使用 uni.saveFile 将临时文件持久化
 * - 使用 StorageService 保存文件元数据（路径、checksum 等）
 */
export class FileStorageService {
  private static readonly META_KEY_PREFIX = 'file_meta_'
  private static readonly MAX_CONCURRENCY = 3 // 最大并发下载数

  /**
   * 下载教材下的全部资源文件（并发控制，真实进度回调）
   * @param textbookId 教材 ID
   * @param resources  资源文件列表（来自 getLearningPackage 接口）
   * @param onProgress 进度回调 (总体百分比, 已完成数, 总数)
   */
  static async downloadAllFiles(
    textbookId: string,
    resources: any[],
    onProgress?: DownloadProgressCallback
  ): Promise<boolean> {
    const flatFiles = this.flattenResources(resources)
    const total = flatFiles.length

    if (total === 0) {
      console.warn('[FileStorageService] 无可下载资源文件')
      return true
    }

    console.log(`[FileStorageService] 开始下载 ${total} 个文件（并发=${this.MAX_CONCURRENCY}）`)

    let completedCount = 0
    let failedCount = 0

    // 并发队列控制
    const queue = [...flatFiles]
    const workers = Array.from({ length: Math.min(this.MAX_CONCURRENCY, total) }, async () => {
      while (queue.length > 0) {
        const resource = queue.shift()
        if (!resource) break

        const success = await this.downloadSingleFile(textbookId, resource)
        if (success) completedCount++
        else failedCount++

        const progressPct = Math.floor((completedCount + failedCount) / total * 100)
        onProgress?.(progressPct, completedCount + failedCount, total)
        console.log(`[FileStorageService] 进度 ${progressPct}% (${completedCount + failedCount}/${total}) | ${resource.fileName || resource.name}`)
      }
    })

    await Promise.all(workers)

    console.log(`[FileStorageService] 下载完成：成功 ${completedCount}，失败 ${failedCount}，共 ${total}`)
    return failedCount === 0
  }

  /**
   * 下载单个文件，保存至设备沙箱，并记录元数据
   */
  static async downloadSingleFile(textbookId: string, resource: any): Promise<boolean> {
    const fileId = resource.id || resource.fileId
    const fileName = resource.fileName || resource.name || `file_${fileId}`
    const rawUrl = resource.fileUrl || resource.url || resource.downloadUrl || ''

    if (!rawUrl) {
      console.warn(`[FileStorageService] 资源无 URL，跳过: ${fileName}`)
      return false
    }

    let fullUrl = rawUrl
    // #ifdef H5
    if (rawUrl.startsWith('https://www.imates.com.cn')) {
      fullUrl = rawUrl.replace('https://www.imates.com.cn', '')
    } else if (rawUrl.startsWith('http://www.imates.com.cn')) {
      fullUrl = rawUrl.replace('http://www.imates.com.cn', '')
    }
    // #endif
    // #ifndef H5
    if (!rawUrl.startsWith('http')) {
      fullUrl = `${ADDRESS_CATALOG.IMATES_HTTP}${rawUrl}`
    }
    // #endif

    // 检查是否已下载（增量对账）
    const existing = this.getFileMeta(textbookId, fileId)
    if (existing && existing.localPath) {
      const fileExists = await this.checkFileExists(existing.localPath)
      if (fileExists) {
        console.log(`[FileStorageService] 文件已存在，跳过下载: ${fileName}`)
        return true
      }
    }

    try {
      console.log(`[FileStorageService] 正在下载: ${fileName}`)
      const tempPath = await this.fetchTempFile(fullUrl)
      const savedPath = await this.persistFile(tempPath)

      // 保存文件元数据
      const meta: LocalFileInfo = {
        fileId,
        textbookId,
        fileName,
        localPath: savedPath,
        fileSize: resource.fileSize || 0,
        checksum: resource.checksum,
        downloadedAt: new Date().toISOString()
      }
      this.saveFileMeta(textbookId, fileId, meta)

      console.log(`[FileStorageService] ✅ 下载完成: ${fileName} -> ${savedPath}`)
      return true
    } catch (err) {
      console.error(`[FileStorageService] ❌ 下载失败: ${fileName}`, err)
      return false
    }
  }

  /**
   * 使用 uni.downloadFile 下载文件到临时路径
   */
  private static fetchTempFile(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const downloadTask = uni.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.tempFilePath)
          } else {
            reject(new Error(`HTTP ${res.statusCode}`))
          }
        },
        fail: (err) => reject(err)
      })

      // 支持进度监听（H5 以外平台）
      if (downloadTask && typeof downloadTask.onProgressUpdate === 'function') {
        downloadTask.onProgressUpdate((progress) => {
          console.log(`[FileStorageService] 单文件进度: ${progress.progress}%`)
        })
      }
    })
  }

  /**
   * 使用 uni.saveFile 将临时文件持久化到应用沙箱
   */
  private static persistFile(tempFilePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // H5 环境不支持 saveFile，直接使用临时路径
      // #ifdef H5
      resolve(tempFilePath)
      // #endif

      // #ifndef H5
      uni.saveFile({
        tempFilePath,
        success: (res) => resolve(res.savedFilePath),
        fail: (err) => {
          // saveFile 失败时降级：使用 tempFilePath（应用生命周期内有效）
          console.warn('[FileStorageService] saveFile 失败，降级使用 tempFilePath:', err)
          resolve(tempFilePath)
        }
      })
      // #endif
    })
  }

  /**
   * 检查本地文件是否存在
   */
  static async checkFileExists(localPath: string): Promise<boolean> {
    // H5 环境无本地文件系统
    // #ifdef H5
    return false
    // #endif

    // #ifndef H5
    return new Promise((resolve) => {
      uni.getSavedFileInfo({
        filePath: localPath,
        success: () => resolve(true),
        fail: () => resolve(false)
      })
    })
    // #endif
  }

  /**
   * 获取教材的本地文件路径（用于 viewer 打开本地文件）
   */
  static getLocalFilePath(textbookId: string, fileId: string): string | null {
    const meta = this.getFileMeta(textbookId, fileId)
    return meta?.localPath || null
  }

  /**
   * 获取教材所有已下载文件元数据
   */
  static getAllFileMetas(textbookId: string): LocalFileInfo[] {
    try {
      const key = `${this.META_KEY_PREFIX}${textbookId}`
      const data = uni.getStorageSync(key)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  /**
   * 删除教材的所有本地文件及元数据（对应 imates-web clearTextbookFiles）
   */
  static async clearTextbookFiles(textbookId: string): Promise<void> {
    const metas = this.getAllFileMetas(textbookId)

    for (const meta of metas) {
      try {
        await this.removeLocalFile(meta.localPath)
      } catch (err) {
        console.warn(`[FileStorageService] 删除文件失败: ${meta.fileName}`, err)
      }
    }

    const key = `${this.META_KEY_PREFIX}${textbookId}`
    uni.removeStorageSync(key)
    StorageService.removeDownloadedTextbookId(textbookId)
    console.log(`[FileStorageService] 已清理教材所有本地文件: textbookId=${textbookId}`)
  }

  // ─── 私有辅助方法 ──────────────────────────────────────────────

  private static getFileMeta(textbookId: string, fileId: string): LocalFileInfo | null {
    const all = this.getAllFileMetas(textbookId)
    return all.find(m => m.fileId === fileId) || null
  }

  private static saveFileMeta(textbookId: string, fileId: string, meta: LocalFileInfo): void {
    const all = this.getAllFileMetas(textbookId).filter(m => m.fileId !== fileId)
    all.push(meta)
    const key = `${this.META_KEY_PREFIX}${textbookId}`
    uni.setStorageSync(key, JSON.stringify(all))
  }

  private static removeLocalFile(localPath: string): Promise<void> {
    return new Promise((resolve) => {
      // #ifdef H5
      resolve()
      return
      // #endif

      // #ifndef H5
      uni.removeSavedFile({
        filePath: localPath,
        success: () => resolve(),
        fail: () => resolve()
      })
      // #endif
    })
  }

  /**
   * 将多个 learningPackages 中的 resourceList 拍平为一维列表
   */
  private static flattenResources(packages: any[]): any[] {
    const files: any[] = []
    for (const pkg of packages) {
      const list = pkg.resourceList || pkg.resources || []
      for (const res of list) {
        files.push({ ...res, _packageId: pkg.id || pkg.packageId })
      }
    }
    return files
  }
}

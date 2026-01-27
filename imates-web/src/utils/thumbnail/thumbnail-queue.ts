/**
 * 缩略图异步生成队列
 * 在后台异步生成PDF、图片、HTML和视频缩略图，不阻塞主流程
 */

import { generatePdfThumbnail, isPdfFile } from './pdf-thumbnail'
import { generateImageThumbnail, isImageFile } from './image-thumbnail'
import { generateHtmlThumbnail, isHtmlFile } from './html-thumbnail'
import { generateVideoThumbnail, isVideoFile } from './video-thumbnail'
import { ResourceManager } from '../../services/storage/resource-storage'

interface ThumbnailTask {
  fileId: string
  textbookId: string
  fileName: string
  fileData: Uint8Array
  onComplete?: (fileId: string, thumbnail: string) => void // 缩略图生成完成回调
}

class ThumbnailQueue {
  private static instance: ThumbnailQueue
  private queue: ThumbnailTask[] = []
  private processing = false
  private maxConcurrent = 2 // 最多2个并发生成缩略图，避免资源竞争
  private processingFileIds = new Set<string>() // 正在处理的文件ID集合，避免重复添加

  private constructor() {}

  public static getInstance(): ThumbnailQueue {
    if (!ThumbnailQueue.instance) {
      ThumbnailQueue.instance = new ThumbnailQueue()
    }
    return ThumbnailQueue.instance
  }

  /**
   * 添加缩略图生成任务到队列
   * @param task 缩略图任务
   */
  public addTask(task: ThumbnailTask): void {
    // 检查是否已经在处理或队列中
    if (this.processingFileIds.has(task.fileId)) {
      return
    }
    
    // 添加到处理集合
    this.processingFileIds.add(task.fileId)
    
    // 添加任务到队列
    this.queue.push(task)
    
    // 如果没有在处理，启动处理
    if (!this.processing) {
      this.processQueue()
    }
  }

  /**
   * 处理队列中的任务
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return
    
    this.processing = true
    
    while (this.queue.length > 0) {
      // 取出一批任务（最多maxConcurrent个）
      const batch = this.queue.splice(0, this.maxConcurrent)
      
      // 并发处理这批任务
      await Promise.all(
        batch.map(task => this.processTask(task))
      )
    }
    
    this.processing = false
  }

  /**
   * 处理单个缩略图任务
   * @param task 缩略图任务
   */
  private async processTask(task: ThumbnailTask): Promise<void> {
    const { fileId, textbookId, fileName, fileData } = task
    
    try {
      // 根据文件类型选择生成方式
      let thumbnail: string
      
      if (isPdfFile(fileName)) {
        // PDF文件：使用 MuPDF 生成缩略图
        thumbnail = await generatePdfThumbnail(fileData)
      } else if (isImageFile(fileName)) {
        // 图片文件：使用canvas生成缩略图
        thumbnail = await generateImageThumbnail(fileData)
      } else if (isHtmlFile(fileName)) {
        // HTML文件：使用iframe生成缩略图
        thumbnail = await generateHtmlThumbnail(fileData)
      } else if (isVideoFile(fileName)) {
        // 视频文件：捕获第一帧生成缩略图
        thumbnail = await generateVideoThumbnail(fileData)
      } else {
        // 不支持的文件类型，跳过
        console.warn(`不支持生成缩略图的文件类型: ${fileName}`)
        // 从处理集合中移除
        this.processingFileIds.delete(fileId)
        return
      }
      
      // 更新IndexedDB中的缩略图
      const resourceManager = ResourceManager.getInstance()
      await resourceManager.updateThumbnail(textbookId, fileId, thumbnail)
      
      // 如果提供了回调，执行回调通知外部
      if (task.onComplete) {
        task.onComplete(fileId, thumbnail)
      }
      
    } catch (error) {
      // 缩略图生成失败不影响其他任务
      console.warn(`后台生成缩略图失败: ${fileName}`, error)
    } finally {
      // 无论成功还是失败，都要从处理集合中移除
      this.processingFileIds.delete(fileId)
    }
  }

  /**
   * 清空队列
   */
  public clear(): void {
    this.queue = []
  }

  /**
   * 获取队列中待处理任务数
   */
  public getQueueLength(): number {
    return this.queue.length
  }

  /**
   * 检查是否正在处理任务
   */
  public isProcessing(): boolean {
    return this.processing
  }

  /**
   * 恢复未完成的缩略图生成任务
   * 在应用启动时调用，扫描所有没有缩略图的PDF文件
   */
  public async recoverPendingTasks(): Promise<void> {
    try {
      const resourceManager = ResourceManager.getInstance()
      
      // 获取所有本地教材
      const textbooks = await resourceManager.getUserLocalTextbooks()
      
      let recoveredCount = 0
      
      // 遍历所有教材，查找没有缩略图的PDF文件
      for (const textbook of textbooks) {
        if (!textbook.localFiles || textbook.localFiles.length === 0) {
          continue
        }
        
        for (const file of textbook.localFiles) {
          // 检查是否是已下载的文件且没有缩略图
          // 支持PDF、图片、HTML和视频文件
          const isPdf = isPdfFile(file.fileName)
          const isImage = isImageFile(file.fileName)
          const isHtml = isHtmlFile(file.fileName)
          const isVideo = isVideoFile(file.fileName)
          
          if (file.isDownloaded && 
              (isPdf || isImage || isHtml || isVideo) &&
              !file.thumbnail) {
            
            // 从textbook_files表读取文件数据
            const fileData = await resourceManager.getFileData(textbook.id, file.id)
            if (fileData && fileData.length > 0) {
              // 添加到队列
              this.addTask({
                fileId: file.id,
                textbookId: textbook.textbookId,
                fileName: file.fileName,
                fileData: fileData
              })
              
              recoveredCount++
            }
          }
        }
      }
      
      if (recoveredCount > 0) {
      }
      
    } catch (error) {
      console.warn('[缩略图恢复] 恢复失败:', error)
    }
  }
}

export const thumbnailQueue = ThumbnailQueue.getInstance()


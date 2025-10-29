/**
 * PDF缩略图异步生成队列
 * 在后台异步生成PDF缩略图，不阻塞主流程
 */

import { generatePdfThumbnail } from './pdf-thumbnail'
import { ResourceManager } from '../services/resource-manager'

interface ThumbnailTask {
  fileId: string
  textbookId: string
  fileName: string
  fileData: Uint8Array
}

class ThumbnailQueue {
  private static instance: ThumbnailQueue
  private queue: ThumbnailTask[] = []
  private processing = false
  private maxConcurrent = 2 // 最多2个并发生成缩略图，避免资源竞争

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
    // 第1步：添加任务到队列
    this.queue.push(task)
    
    // 第2步：如果没有在处理，启动处理
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
      // 第1步：取出一批任务（最多maxConcurrent个）
      const batch = this.queue.splice(0, this.maxConcurrent)
      
      // 第2步：并发处理这批任务
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
      // 第1步：生成缩略图
      const thumbnail = await generatePdfThumbnail(fileData)
      
      // 第2步：更新IndexedDB中的缩略图
      const resourceManager = ResourceManager.getInstance()
      await resourceManager.updateThumbnail(textbookId, fileId, thumbnail)
      
    } catch (error) {
      // 缩略图生成失败不影响其他任务
      console.warn(`后台生成缩略图失败: ${fileName}`, error)
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
      
      // 第1步：获取所有本地教材
      const textbooks = await resourceManager.getUserLocalTextbooks()
      
      let recoveredCount = 0
      
      // 第2步：遍历所有教材，查找没有缩略图的PDF文件
      for (const textbook of textbooks) {
        if (!textbook.localFiles || textbook.localFiles.length === 0) {
          continue
        }
        
        for (const file of textbook.localFiles) {
          // 第3步：检查是否是已下载的PDF文件且没有缩略图
          if (file.isDownloaded && 
              file.fileData && 
              file.fileName.toLowerCase().endsWith('.pdf') &&
              !file.thumbnail) {
            
            // 第4步：添加到队列
            this.addTask({
              fileId: file.id,
              textbookId: textbook.textbookId,
              fileName: file.fileName,
              fileData: file.fileData
            })
            
            recoveredCount++
          }
        }
      }
      
      if (recoveredCount > 0) {
        console.log(`[缩略图恢复] 发现${recoveredCount}个PDF文件缺少缩略图，已加入队列`)
      }
      
    } catch (error) {
      console.warn('[缩略图恢复] 恢复失败:', error)
    }
  }
}

export const thumbnailQueue = ThumbnailQueue.getInstance()


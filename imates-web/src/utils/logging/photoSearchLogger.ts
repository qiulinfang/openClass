/**
 * 拍照搜题流程日志工具
 * 用于记录拍照搜题的完整流程，便于调试和问题排查
 */

import { androidBridge } from '@/services/android-bridge'

interface LogEntry {
  timestamp: string
  step: string
  data?: any
  error?: any
}

class PhotoSearchLogger {
  private logs: LogEntry[] = []
  private maxLogs = 100 // 最多保存100条日志
  private readonly logTag = '[PhotoSearch]'

  /**
   * 记录日志
   */
  private log(step: string, data?: any, error?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      step,
      data,
      error,
    }

    // 保存到内存
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift() // 移除最旧的日志
    }

    // 输出到控制台
    const message = this.formatLogMessage(entry)
    console.log(`${this.logTag} ${message}`)

    // 如果Android Bridge可用，也发送到原生日志
    if (androidBridge.isAndroidBridgeAvailable()) {
      try {
        const androidMessage = `${this.logTag} ${message}`
        // 通过Android Bridge发送日志（如果支持）
        if (typeof (window as any).AndroidBridge?.logMessage === 'function') {
          ;(window as any).AndroidBridge.logMessage('INFO', androidMessage)
        }
      } catch (e) {
        // 忽略日志发送失败
      }
    }
  }

  /**
   * 格式化日志消息
   */
  private formatLogMessage(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })

    let message = `[${time}] ${entry.step}`
    
    if (entry.data) {
      const dataStr = typeof entry.data === 'object' 
        ? JSON.stringify(entry.data, null, 2)
        : String(entry.data)
      message += `\n数据: ${dataStr}`
    }
    
    if (entry.error) {
      const errorStr = entry.error instanceof Error
        ? `${entry.error.message}\n${entry.error.stack}`
        : String(entry.error)
      message += `\n错误: ${errorStr}`
    }

    return message
  }

  /**
   * 记录流程开始
   */
  start(subject: string, source: 'camera' | 'gallery' | 'unknown') {
    this.log('流程开始', { subject, source })
  }

  /**
   * 记录路由导航
   */
  navigateToPhotoSearch(subject: string, currentQuestion?: any) {
    this.log('导航到拍照搜题页面', {
      subject,
      currentQuestionId: currentQuestion?.id || currentQuestion?.bmNo,
      currentQuestionSubject: currentQuestion?.subject,
    })
  }

  /**
   * 记录页面加载
   */
  pageMounted(subject: string) {
    this.log('拍照搜题页面加载', { subject })
  }

  /**
   * 记录拍照/选择图片
   */
  captureImage(source: 'camera' | 'gallery', success: boolean, imageSize?: number, base64Length?: number) {
    this.log(`从${source === 'camera' ? '相机' : '相册'}获取图片`, {
      success,
      imageSize: imageSize ? `${(imageSize / 1024).toFixed(2)}KB` : undefined,
      base64Length,
    })
  }

  /**
   * 记录base64转File
   */
  convertBase64ToFile(filename: string, fileSize: number, mimeType: string) {
    this.log('Base64转File对象', {
      filename,
      fileSize: `${(fileSize / 1024).toFixed(2)}KB`,
      mimeType,
    })
  }

  /**
   * 记录初始化裁剪画布
   */
  initCropCanvas(canvasWidth: number, canvasHeight: number, imageWidth: number, imageHeight: number, scale: number) {
    this.log('初始化裁剪画布', {
      canvasWidth,
      canvasHeight,
      imageWidth,
      imageHeight,
      scale: scale.toFixed(2),
    })
  }

  /**
   * 记录裁剪区域变化
   */
  cropRectChanged(rect: { x: number; y: number; width: number; height: number }) {
    this.log('裁剪区域变化', {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      area: rect.width * rect.height,
    })
  }

  /**
   * 记录开始搜索
   */
  startSearch(cropRect: { x: number; y: number; width: number; height: number }, subject: string) {
    this.log('开始图片识别', {
      cropRect,
      subject,
    })
  }

  /**
   * 记录获取裁剪后的图片
   */
  getCroppedImage(croppedWidth: number, croppedHeight: number, blobSize?: number) {
    this.log('获取裁剪后的图片', {
      width: croppedWidth,
      height: croppedHeight,
      blobSize: blobSize ? `${(blobSize / 1024).toFixed(2)}KB` : undefined,
    })
  }

  /**
   * 记录API调用 - 图片识别
   */
  apiRecognizeImage(subject: string, endpoint: string, imageSize: number) {
    this.log('调用图片识别API', {
      subject,
      endpoint,
      imageSize: `${(imageSize / 1024).toFixed(2)}KB`,
    })
  }

  /**
   * 记录API响应 - 图片识别
   */
  apiRecognizeImageResponse(success: boolean, questionData?: any, error?: any) {
    if (success && questionData) {
      this.log('图片识别API响应成功', {
        questionId: questionData.id || questionData.bmNo,
        questionTitle: questionData.title?.substring(0, 50) + '...',
        hasAnswer: !!questionData.answer,
        hasExplanation: !!questionData.explanation,
      })
    } else {
      this.log('图片识别API响应失败', { error }, error)
    }
  }

  /**
   * 记录文本搜索
   */
  textSearch(searchText: string, subject: string) {
    this.log('开始文本搜索', {
      searchText: searchText.substring(0, 50) + (searchText.length > 50 ? '...' : ''),
      subject,
    })
  }

  /**
   * 记录文本搜索响应
   */
  textSearchResponse(success: boolean, questionData?: any) {
    if (success && questionData) {
      this.log('文本搜索响应成功', {
        questionId: questionData.id || questionData.bmNo,
        questionTitle: questionData.title?.substring(0, 50) + '...',
      })
    } else {
      this.log('文本搜索响应失败', {})
    }
  }

  /**
   * 记录添加到列表
   */
  startAddToList(questionData: any, subject: string, exercisesId: string) {
    this.log('开始添加到列表', {
      questionId: questionData.id || questionData.bmNo,
      subject,
      exercisesId: exercisesId.substring(0, 100) + (exercisesId.length > 100 ? '...' : ''),
      existingQuestionCount: exercisesId ? exercisesId.split(',').length : 0,
    })
  }

  /**
   * 记录API调用 - 添加到列表
   */
  apiAddToList(url: string, requestBody: any) {
    this.log('调用添加到列表API', {
      url,
      bmNo: requestBody.bmNo,
      type: requestBody.type,
      exercisesIdLength: requestBody.exercisesId?.length || 0,
    })
  }

  /**
   * 记录API响应 - 添加到列表
   */
  apiAddToListResponse(success: boolean, error?: any) {
    if (success) {
      this.log('添加到列表API响应成功', {})
    } else {
      this.log('添加到列表API响应失败', { error }, error)
    }
  }

  /**
   * 记录刷新题目列表
   */
  refreshQuestionList(subject: string) {
    this.log('刷新题目列表', { subject })
  }

  /**
   * 记录返回习题页面
   */
  navigateBack(subject: string) {
    this.log('返回习题解答页面', { subject })
  }

  /**
   * 记录重拍
   */
  retake() {
    this.log('重拍/重新搜索', {})
  }

  /**
   * 记录退出
   */
  exit() {
    this.log('退出拍照搜题', {})
  }

  /**
   * 记录错误
   */
  error(step: string, error: any, context?: any) {
    this.log(`错误: ${step}`, context, error)
  }

  /**
   * 获取所有日志
   */
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * 清空日志
   */
  clear() {
    this.logs = []
    this.log('日志已清空', {})
  }

  /**
   * 导出日志为文本
   */
  exportLogs(): string {
    return this.logs.map(entry => this.formatLogMessage(entry)).join('\n\n')
  }
}

// 导出单例
export const photoSearchLogger = new PhotoSearchLogger()

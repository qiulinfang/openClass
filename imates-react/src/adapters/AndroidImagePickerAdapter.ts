/**
 * Android 图片选择适配器
 * 使用 Android Bridge 实现图片选择功能
 */
import type { IImagePickerAdapter } from './IImagePickerAdapter'
import type { ImageData } from '../types'
import { androidBridge } from '../services/business/android-bridge'

export class AndroidImagePickerAdapter implements IImagePickerAdapter {
  private eventListeners: Map<string, (event: Event) => void> = new Map()
  private pendingResolve: {
    resolve: (value: ImageData | null) => void
    reject: (reason?: any) => void
  } | null = null
  private source: 'camera' | 'gallery' | null = null

  constructor() {
    this.setupEventListeners()
  }

  /**
   * 设置事件监听器
   * 注意：适配器是单例的，事件监听器只需要设置一次
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return

    // 检查是否已经设置过事件监听器（避免重复设置）
    if (this.eventListeners.size > 0) {
      return
    }

    // 处理原生图片选择结果
    const handleNativeImagePickResult = async (event: Event) => {
      const customEvent = event as CustomEvent
      await this.processImageResult(customEvent.detail, 'gallery')
    }

    // 处理原生拍照结果
    const handleNativeImageCaptureResult = async (event: Event) => {
      const customEvent = event as CustomEvent
      await this.processImageResult(customEvent.detail, 'camera')
    }

    window.addEventListener('nativeImagePickResult', handleNativeImagePickResult)
    window.addEventListener('nativeImageCaptureResult', handleNativeImageCaptureResult)

    this.eventListeners.set('nativeImagePickResult', handleNativeImagePickResult)
    this.eventListeners.set('nativeImageCaptureResult', handleNativeImageCaptureResult)
  }

  /**
   * 处理图片结果
   */
  private async processImageResult(
    imageData: {
      success: boolean
      filePath?: string
      width?: number
      height?: number
      fileSize?: number
      base64DataUrl?: string
    },
    source: 'camera' | 'gallery'
  ): Promise<void> {
    if (!this.pendingResolve || this.source !== source) {
      return
    }

    const { success, filePath, width, height, fileSize, base64DataUrl } = imageData

    if (success && base64DataUrl) {
      const imageInfo: ImageData = {
        filePath: filePath || '',
        width: width || 0,
        height: height || 0,
        fileSize: fileSize || 0,
        base64DataUrl: base64DataUrl
      }
      this.pendingResolve.resolve(imageInfo)
    } else if (success && !base64DataUrl) {
      console.error('[AndroidImagePickerAdapter] ❌ 原生端未返回base64DataUrl数据')
      this.pendingResolve.reject(new Error('原生端未返回base64DataUrl数据'))
    } else {
      // 用户在原生界面取消了选择
      this.pendingResolve.resolve(null)
    }

    // 清理状态
    this.pendingResolve = null
    this.source = null
  }

  /**
   * 从相机拍照
   */
  async captureFromCamera(): Promise<ImageData | null> {
    return new Promise((resolve, reject) => {
      if (!this.isAvailable()) {
        reject(new Error('Android Bridge 不可用'))
        return
      }

      // 保存 resolve 和 reject
      this.pendingResolve = { resolve, reject }
      this.source = 'camera'

      // 调用原生拍照
      const result = androidBridge.captureImageFromCamera()

      if (!result.success) {
        this.pendingResolve = null
        this.source = null
        reject(new Error(result.message || '启动相机失败'))
      }
      // 注意：如果成功，等待原生通过事件返回结果
    })
  }

  /**
   * 从相册选择图片
   */
  async selectFromGallery(): Promise<ImageData | null> {
    return new Promise((resolve, reject) => {
      if (!this.isAvailable()) {
        reject(new Error('Android Bridge 不可用'))
        return
      }

      // 保存 resolve 和 reject
      this.pendingResolve = { resolve, reject }
      this.source = 'gallery'

      // 调用原生相册
      const result = androidBridge.selectImageFromGallery()

      if (!result.success) {
        this.pendingResolve = null
        this.source = null
        reject(new Error(result.message || '打开相册失败'))
      }
      // 注意：如果成功，等待原生通过事件返回结果
    })
  }

  /**
   * 检查适配器是否可用
   */
  isAvailable(): boolean {
    return androidBridge.isAndroidBridgeAvailable()
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (typeof window === 'undefined') return

    this.eventListeners.forEach((handler, eventName) => {
      window.removeEventListener(eventName, handler)
    })
    this.eventListeners.clear()

    // 如果有待处理的 Promise，取消它
    if (this.pendingResolve) {
      this.pendingResolve.resolve(null)
      this.pendingResolve = null
    }
    this.source = null
  }
}


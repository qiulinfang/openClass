/**
 * Web 图片选择适配器
 * 使用 HTML input file 实现图片选择功能
 */
import type { IImagePickerAdapter } from './IImagePickerAdapter'
import type { ImageData } from '../types'

export class WebImagePickerAdapter implements IImagePickerAdapter {
  /**
   * 从相机拍照（Web 环境直接调用电脑摄像头）
   * 检查浏览器是否支持 getUserMedia
   * 请求摄像头权限并获取视频流
   * 创建预览界面显示摄像头画面
   * 用户点击拍照按钮时捕获画面
   * 将捕获的画面转换为 base64 数据
   * 清理资源并返回图片数据
   */
  async captureFromCamera(): Promise<ImageData | null> {
    // 检查浏览器是否支持 getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('[WebImagePickerAdapter] ❌ 浏览器不支持摄像头访问')
      return null
    }

    let stream: MediaStream | null = null
    let video: HTMLVideoElement | null = null
    let modal: HTMLDivElement | null = null

    try {
      // 请求摄像头权限并获取视频流
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user' // 使用前置摄像头（电脑通常只有前置摄像头）
        }
      })

      // 创建预览界面
      modal = this.createCameraModal()
      video = document.createElement('video')
      video.autoplay = true
      video.playsInline = true
      video.srcObject = stream

      // 等待视频元数据加载
      await new Promise<void>((resolve, reject) => {
        video!.onloadedmetadata = () => {
          video!.play()
            .then(() => resolve())
            .catch(reject)
        }
        video!.onerror = () => reject(new Error('视频加载失败'))
      })

      // 等待用户点击拍照按钮
      const capturedData = await this.waitForCapture(video, modal)

      // 清理资源
      this.cleanup(stream, video, modal)

      return capturedData
    } catch (error) {
      // 清理资源
      this.cleanup(stream, video, modal)

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          console.error('[WebImagePickerAdapter] ❌ 用户拒绝了摄像头权限')
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          console.error('[WebImagePickerAdapter] ❌ 未找到摄像头设备')
        } else {
          console.error('[WebImagePickerAdapter] ❌ 摄像头访问失败:', error.message)
        }
      }
      return null
    }
  }

  /**
   * 从相册选择图片（Web 环境使用文件选择）
   */
  async selectFromGallery(): Promise<ImageData | null> {
    return this.selectImageFromInput(false)
  }

  /**
   * 创建摄像头预览模态框
   * 创建模态框容器
   * 创建视频预览区域
   * 创建拍照按钮和取消按钮
   * 添加样式并返回模态框元素
   */
  private createCameraModal(): HTMLDivElement {
    // 创建模态框容器
    const modal = document.createElement('div')
    modal.className = 'camera-modal-overlay'
    
    // 创建内容区域
    const content = document.createElement('div')
    content.className = 'camera-modal-content'
    
    // 创建视频预览区域
    const videoContainer = document.createElement('div')
    videoContainer.className = 'camera-video-container'
    const videoPreview = document.createElement('div')
    videoPreview.className = 'camera-video-preview'
    videoPreview.id = 'camera-video-preview'
    videoContainer.appendChild(videoPreview)
    
    // 创建按钮区域
    const buttonContainer = document.createElement('div')
    buttonContainer.className = 'camera-button-container'
    
    const captureButton = document.createElement('button')
    captureButton.className = 'camera-capture-button'
    captureButton.innerHTML = '拍照'
    captureButton.id = 'camera-capture-btn'
    
    const cancelButton = document.createElement('button')
    cancelButton.className = 'camera-cancel-button'
    cancelButton.innerHTML = '取消'
    cancelButton.id = 'camera-cancel-btn'
    
    buttonContainer.appendChild(cancelButton)
    buttonContainer.appendChild(captureButton)
    
    content.appendChild(videoContainer)
    content.appendChild(buttonContainer)
    modal.appendChild(content)
    
    // 添加样式
    this.injectCameraModalStyles()
    
    // 添加到页面
    document.body.appendChild(modal)
    
    return modal
  }

  /**
   * 等待用户点击拍照按钮
   * 将视频元素添加到预览区域
   * 等待用户点击拍照或取消按钮
   * 如果点击拍照，使用 canvas 捕获画面
   * 将 canvas 转换为 base64 数据并返回
   */
  private waitForCapture(video: HTMLVideoElement, modal: HTMLDivElement): Promise<ImageData | null> {
    return new Promise((resolve) => {
      const videoPreview = modal.querySelector('#camera-video-preview') as HTMLDivElement
      const captureButton = modal.querySelector('#camera-capture-btn') as HTMLButtonElement
      const cancelButton = modal.querySelector('#camera-cancel-btn') as HTMLButtonElement
      
      // 将视频元素添加到预览区域
      if (videoPreview) {
        video.style.width = '100%'
        video.style.height = '100%'
        video.style.objectFit = 'cover'
        videoPreview.appendChild(video)
      }
      
      // 处理拍照按钮点击
      const handleCapture = () => {
        try {
          // 创建 canvas 并捕获画面
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }
          
          // 绘制当前视频帧到 canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          
          // 转换为 base64
          const base64DataUrl = canvas.toDataURL('image/jpeg', 0.9)
          
          // 构造图片数据
          const imageData: ImageData = {
            filePath: `camera_${Date.now()}.jpg`,
            width: canvas.width,
            height: canvas.height,
            fileSize: this.estimateFileSize(base64DataUrl),
            base64DataUrl: base64DataUrl
          }
          
          resolve(imageData)
        } catch (error) {
          console.error('[WebImagePickerAdapter] ❌ 拍照失败:', error)
          resolve(null)
        }
      }
      
      // 处理取消按钮点击
      const handleCancel = () => {
        resolve(null)
      }
      
      captureButton.addEventListener('click', handleCapture, { once: true })
      cancelButton.addEventListener('click', handleCancel, { once: true })
    })
  }

  /**
   * 清理资源
   * 停止视频流
   * 移除模态框
   */
  private cleanup(stream: MediaStream | null, video: HTMLVideoElement | null, modal: HTMLDivElement | null): void {
    // 停止视频流中的所有轨道
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    
    // 移除视频元素的源对象
    if (video) {
      video.srcObject = null
    }
    
    // 移除模态框
    if (modal && modal.parentNode) {
      document.body.removeChild(modal)
    }
  }

  /**
   * 估算 base64 数据的大小（字节）
   */
  private estimateFileSize(base64DataUrl: string): number {
    // base64 编码后的长度约为原始数据的 4/3
    // 减去 data URL 前缀的长度
    const base64Data = base64DataUrl.split(',')[1] || ''
    return Math.floor((base64Data.length * 3) / 4)
  }

  /**
   * 注入摄像头模态框样式
   */
  private injectCameraModalStyles(): void {
    // 检查样式是否已注入
    if (document.getElementById('camera-modal-styles')) {
      return
    }
    
    const style = document.createElement('style')
    style.id = 'camera-modal-styles'
    style.textContent = `
      .camera-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      
      .camera-modal-content {
        background: #ffffff;
        border-radius: 16px;
        padding: 20px;
        max-width: 90vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .camera-video-container {
        width: 100%;
        max-width: 640px;
        aspect-ratio: 4 / 3;
        background: #000000;
        border-radius: 12px;
        overflow: hidden;
      }
      
      .camera-video-preview {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .camera-button-container {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      
      .camera-capture-button,
      .camera-cancel-button {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .camera-capture-button {
        background: #9c27b0;
        color: #ffffff;
      }
      
      .camera-capture-button:hover {
        background: #7b1fa2;
      }
      
      .camera-cancel-button {
        background: #f5f5f5;
        color: #333333;
      }
      
      .camera-cancel-button:hover {
        background: #eeeeee;
      }
      
      @media (prefers-color-scheme: dark) {
        .camera-modal-content {
          background: #2a2a2a;
        }
        
        .camera-cancel-button {
          background: #3a3a3a;
          color: #e0e0e0;
        }
        
        .camera-cancel-button:hover {
          background: #444444;
        }
      }
    `
    
    document.head.appendChild(style)
  }

  /**
   * 通过 HTML input 选择图片
   * @param useCamera 是否使用摄像头（true=拍照，false=选择文件）
   */
  private selectImageFromInput(useCamera: boolean): Promise<ImageData | null> {
    return new Promise((resolve, reject) => {
      // 创建 input 元素
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      
      // 如果使用摄像头，设置 capture 属性
      if (useCamera) {
        input.capture = 'environment' // 优先使用后置摄像头
      }

      // 处理文件选择
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0]
        
        // 清理 input 元素
        if (input.parentNode) {
          document.body.removeChild(input)
        }
        
        // 如果用户没有选择文件，视为取消
        if (!file) {
          resolve(null)
          return
        }

        try {
          // 读取文件为 base64
          const base64DataUrl = await this.fileToBase64(file)
          
          // 获取图片尺寸
          const dimensions = await this.getImageDimensions(base64DataUrl)
          
          // 构造图片数据
          const imageData: ImageData = {
            filePath: file.name,
            width: dimensions.width,
            height: dimensions.height,
            fileSize: file.size,
            base64DataUrl: base64DataUrl
          }

          resolve(imageData)
        } catch (error) {
          console.error('[WebImagePickerAdapter] ❌ 图片处理失败:', error)
          reject(error)
        }
      }

      // 添加到 DOM 并触发点击
      input.style.display = 'none'
      document.body.appendChild(input)
      input.click()
    })
  }

  /**
   * 将文件转换为 base64
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result)
      }
      reader.onerror = () => {
        reject(new Error('文件读取失败'))
      }
      reader.readAsDataURL(file)
    })
  }

  /**
   * 获取图片尺寸
   */
  private getImageDimensions(base64DataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        })
      }
      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }
      img.src = base64DataUrl
    })
  }

  /**
   * 检查适配器是否可用（Web 环境始终可用）
   */
  isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
  }
}


/**
 * 相机流服务
 * 用于接收和播放Android端传输的相机实时流
 */
import mpegts from 'mpegts.js'

export interface CameraStreamConfig {
  width?: number
  height?: number
  frameRate?: number
  bitrate?: number
}

export interface CameraStreamStatus {
  isRunning: boolean
  port?: number
  error?: string
}

export class CameraStreamService {
  private static instance: CameraStreamService
  private player: mpegts.Player | null = null
  private videoElement: HTMLVideoElement | null = null
  private isStreaming = false
  private streamPort = 20251 // UdpForwarderManager.STREAMING_LOCAL_PORT + 1

  private constructor() {}

  public static getInstance(): CameraStreamService {
    if (!CameraStreamService.instance) {
      CameraStreamService.instance = new CameraStreamService()
    }
    return CameraStreamService.instance
  }

  /**
   * 启动相机流
   * @param videoElement 用于播放视频的video元素
   * @param config 流配置
   * @returns Promise<CameraStreamStatus>
   */
  public async startStream(
    videoElement: HTMLVideoElement,
    config?: CameraStreamConfig
  ): Promise<CameraStreamStatus> {
    if (this.isStreaming) {
      return {
        isRunning: true,
        port: this.streamPort,
      }
    }

    try {
      // 检查Android Bridge
      if (!window.AndroidBridge) {
        throw new Error('Android Bridge not available')
      }

      // 调用Android端启动相机流
      const width = config?.width || 1920
      const height = config?.height || 1080
      const frameRate = config?.frameRate || 30
      const bitrate = config?.bitrate || 4000000

      const resultStr = window.AndroidBridge.startCameraStream(
        width,
        height,
        frameRate,
        bitrate
      )

      const result = JSON.parse(resultStr)
      if (!result.success) {
        throw new Error(result.message || 'Failed to start camera stream')
      }

      // 保存端口信息
      if (result.port) {
        this.streamPort = result.port
      }
      
      // 获取HTTP端口
      const httpPort = result.httpPort || 20252

      // 等待一小段时间让Android端准备好
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // 初始化mpegts播放器
      this.videoElement = videoElement
      await this.initPlayer(httpPort)

      this.isStreaming = true

      return {
        isRunning: true,
        port: this.streamPort,
      }
    } catch (error) {
      console.error('[CameraStreamService] Failed to start stream:', error)
      return {
        isRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 停止相机流
   */
  public async stopStream(): Promise<void> {
    if (!this.isStreaming) {
      return
    }

    try {
      // 停止播放器
      if (this.player) {
        this.player.destroy()
        this.player = null
      }

      // 调用Android端停止相机流
      if (window.AndroidBridge) {
        window.AndroidBridge.stopCameraStream()
      }

      // 清空video元素
      if (this.videoElement) {
        this.videoElement.srcObject = null
        this.videoElement = null
      }

      this.isStreaming = false
    } catch (error) {
      console.error('[CameraStreamService] Failed to stop stream:', error)
    }
  }

  /**
   * 检查流是否正在运行
   */
  public async checkStatus(): Promise<CameraStreamStatus> {
    try {
      if (!window.AndroidBridge) {
        return {
          isRunning: false,
          error: 'Android Bridge not available',
        }
      }

      const resultStr = window.AndroidBridge.isCameraStreamRunning()
      const result = JSON.parse(resultStr)

      return {
        isRunning: result.isRunning || false,
        port: this.streamPort,
        error: result.success ? undefined : result.message,
      }
    } catch (error) {
      console.error('[CameraStreamService] Failed to check status:', error)
      return {
        isRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 初始化mpegts播放器
   */
  private async initPlayer(httpPort: number): Promise<void> {
    if (!this.videoElement) {
      throw new Error('Video element not set')
    }

    // 检查浏览器支持
    if (!mpegts.isSupported()) {
      throw new Error('mpegts.js is not supported in this browser')
    }

    const tsStreamUrl = `http://127.0.0.1:${httpPort}/stream.ts`

    try {
      // 创建播放器
      this.player = mpegts.createPlayer(
        {
          type: 'mpegts', // 或 'flv'
          url: tsStreamUrl,
          isLive: true,
          hasAudio: false,
          hasVideo: true,
        },
        {
          enableWorker: true,
          enableStashBuffer: false,
          stashInitialSize: 128,
          autoCleanupSourceBuffer: true,
        }
      )

      // 附加到video元素
      this.player.attachMediaElement(this.videoElement)

      // 加载并播放
      this.player.load()
      await this.videoElement.play()
    } catch (error) {
      console.error('[CameraStreamService] Failed to initialize player:', error)
      throw error
    }
  }

  /**
   * 获取当前流状态
   */
  public getIsStreaming(): boolean {
    return this.isStreaming
  }
}

// 扩展Window接口
declare global {
  interface Window {
    AndroidBridge?: {
      startCameraStream: (
        width: number,
        height: number,
        frameRate: number,
        bitrate: number
      ) => string
      stopCameraStream: () => string
      isCameraStreamRunning: () => string
    }
  }
}

export const cameraStreamService = CameraStreamService.getInstance()


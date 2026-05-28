/**
 * Android Bridge 工具类
 * 统一管理与原生Android端的通信
 * 
 * 注意：HTTP相关接口（题目管理、AI聊天、老师对话等）已移至API服务层
 * 此类现在只处理原生功能：相机、录音、语音播放、图片处理等
 */

// 使用统一类型定义（仅保留原生功能相关的类型）
import type {
  UserInfo,
  VoiceRecordingResponse,
  ImagePickerResponse,
} from '@/types'

// 枚举需要普通导入才能作为值使用
import { MessageType } from '@/types'

// 使用统一类型定义
import type {
  VoiceRecordingStatus,
  ImageCompressionResult,
} from '@/types'

import type { VoiceData, ImageData, BridgeClassroomStatus } from '@/types'

// HTTP相关的接口定义已移至types/index.ts


export class AndroidBridge {
  private static instance: AndroidBridge
  private isAvailable: boolean = false
  private eventListeners: Map<string, Function[]> = new Map()
  private lastFloatingFabVisible: boolean | null = null

  private createFabTraceId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  }

  private constructor() {
    this.checkAvailability()
    this.setupCallbacks()
  }

  public static getInstance(): AndroidBridge {
    if (!AndroidBridge.instance) {
      AndroidBridge.instance = new AndroidBridge()
    }
    return AndroidBridge.instance
  }


  /**
   * 检查Android Bridge是否可用
   */
  private checkAvailability(): void {
    this.isAvailable = typeof window !== 'undefined' && 
                      typeof window.AndroidBridge !== 'undefined'
  }

  /**
   * 设置Android事件回调
   */
  private setupCallbacks(): void {
    if (typeof window === 'undefined') return

    // 设置流式响应回调
    if (!window.onStreamResponse) {
      window.onStreamResponse = (requestId: string, chunk: string, isComplete: boolean) => {
        const event = new CustomEvent('nativeStreamResponse', {
          detail: { requestId, chunk, isComplete }
        })
        window.dispatchEvent(event)
      }
    }

    // 设置完整响应回调
    if (!window.onChatResponse) {
      window.onChatResponse = (requestId: string, response: any) => {
        const event = new CustomEvent('nativeChatResponse', {
          detail: { requestId, response }
        })
        window.dispatchEvent(event)
      }
    }

    // 确保回调函数存在
    if (!window.onAndroidReady) {
      window.onAndroidReady = () => {
        this.checkAvailability()
        this.onAndroidReady()
      }
    }

    // 设置图片相关回调
    this.setupImageCallbacks()
    
    // 设置课堂相关回调
    this.setupClassroomCallbacks()
  }

  /**
   * 通用：安全调用原生方法并返回字符串
   */
  private callString(fn: (() => string | undefined) | undefined, fallback: string = ''): string {
    try {
      if (this.isAvailable && fn) {
        const result = fn()
        return typeof result === 'string' ? result : fallback
      }
    } catch (err) {
      // 静默处理
    }
    return fallback
  }

  /**
   * 通用：安全调用原生方法（无返回）
   */
  private callVoid(fn: (() => void) | undefined): void {
    try {
      if (this.isAvailable && fn) return fn()
    } catch (err) {
      // 静默处理
    }
  }

  /**
   * 通用：解析 JSON 字符串
   */
  private parseJSON<T>(jsonStr: string, defaultValue: T): T {
    try {
      if (!jsonStr) return defaultValue
      return JSON.parse(jsonStr) as T
    } catch (err) {
      console.warn('[AndroidBridge] parseJSON failed:', { jsonStr }, err)
      return defaultValue
    }
  }

  /**
   * 获取Android Bridge是否可用
   */
  public isAndroidBridgeAvailable(): boolean {
    return this.isAvailable
  }

  /**
   * 显示Toast消息
   */
  public showToast(message: string): void {
    if (this.isAvailable && window.AndroidBridge) {
      window.AndroidBridge.showToast(message)
    }
  }

  /**
   * 控制系统级悬浮 FAB 显示/隐藏
   * 由 Web 侧根据路由与面板状态计算后同步给原生
   */
  public setFloatingFabVisible(visible: boolean): void {
    const traceId = this.createFabTraceId('fab-native')
    const hasAndroidBridge = typeof window !== 'undefined' && typeof window.AndroidBridge !== 'undefined'
    const hasMethod =
      typeof window !== 'undefined' &&
      typeof window.AndroidBridge !== 'undefined' &&
      typeof (window.AndroidBridge as any).setFloatingFabVisible === 'function'

    console.log('[AndroidBridge][Web->Native] setFloatingFabVisible', {
      traceId,
      visible,
      isAvailable: this.isAvailable,
      hasAndroidBridge,
      hasMethod,
    })

    this.lastFloatingFabVisible = visible

    try {
      if (!hasAndroidBridge || !hasMethod) return
      this.callVoid(() => (window.AndroidBridge as any)?.setFloatingFabVisible?.(visible))
      console.log('[AndroidBridge][Web->Native] setFloatingFabVisible done', { traceId, visible })
    } catch (error) {
      console.error('[AndroidBridge][Web->Native] setFloatingFabVisible failed', { traceId, visible }, error)
    }
  }

  public getLastFloatingFabVisible(): boolean | null {
    return this.lastFloatingFabVisible
  }

  /**
   * 获取用户Token
   */
  public getUserToken(): string {
    return this.callString(() => window.AndroidBridge?.getUserToken?.(), '')
  }

  /**
   * 获取用户信息（对象）
   */
  public getUserInfo(): Partial<UserInfo> | null {
    const json = this.callString(() => window.AndroidBridge?.getUserInfo?.())
    if (!json) return null
    const info = this.parseJSON<any>(json, null as any)
    return info
  }

  /**
   * 通知Android端Web应用已就绪
   * 替代Android端的轮询检测机制，由Web端主动通知
   * 注意：在调用前重新检查可用性，因为 window.AndroidBridge 可能在初始化时还不存在
   */
  public notifyWebAppReady(): void {
    try {
      // 重新检查可用性，因为 window.AndroidBridge 可能在初始化时还不存在
      const isAvailableNow = typeof window !== 'undefined' && 
                            typeof window.AndroidBridge !== 'undefined' &&
                            typeof window.AndroidBridge.notifyWebAppReady === 'function'
      
      if (isAvailableNow) {
        const bridge = window.AndroidBridge
        bridge?.notifyWebAppReady?.()
        console.log('[AndroidBridge] 已通知Android端Web应用就绪')
        // 更新 isAvailable 状态
        this.isAvailable = true
      } else {
        console.warn('[AndroidBridge] AndroidBridge不可用，无法通知就绪状态', {
          hasWindow: typeof window !== 'undefined',
          hasAndroidBridge: typeof window !== 'undefined' && typeof window.AndroidBridge !== 'undefined',
          hasNotifyMethod: typeof window !== 'undefined' && 
                          typeof window.AndroidBridge !== 'undefined' &&
                          typeof window.AndroidBridge.notifyWebAppReady === 'function'
        })
      }
    } catch (error) {
      console.error('[AndroidBridge] 通知Web应用就绪失败:', error)
    }
  }

  /**
   * 同步Web端用户信息到Android原生ViewModel
   * 用于Web登录后同步状态，确保Android原生接口能正常工作
   * 
   * @param userId 用户ID
   * @param token 用户Token (JWT)
   * @param password 用户密码（可选）
   * @returns 同步是否成功
   */
  public syncUserInfo(userId: string, token: string, password?: string): boolean {
    try {
      if (!window.AndroidBridge?.syncUserInfo) {
        return false
      }

      const result = window.AndroidBridge.syncUserInfo(
        userId,
        token,
        password || ''
      )

      const response = this.parseJSON<{ success: boolean; message: string }>(result, {
        success: false,
        message: '解析响应失败'
      })

      return response.success
    } catch (error) {
      return false
    }
  }

  // HTTP相关接口已移至API服务层，此处不再提供

  // AI聊天、老师对话、进度保存等HTTP接口已移至API服务层，此处不再提供

  // 题目置顶功能已改为纯前端实现，不需要Android接口调用

  // ========== 事件监听器管理 ==========

  /**
   * 添加事件监听器
   */
  public addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  /**
   * 移除事件监听器
   */
  public removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(...args)
        } catch (err) {
          // 静默处理
        }
      })
    }
  }

  // ========== Android 事件回调处理 ==========

  /**
   * Android 准备就绪回调
   */
  private onAndroidReady(): void {
    this.emit('androidReady')
  }

  // 其他题目相关回调已移除（未使用）

  // ========== 便捷方法 ==========

  /**
   * 监听Android准备就绪事件
   */
  public onReady(callback: () => void): void {
    this.addEventListener('androidReady', callback)
    // 如果已经准备就绪，立即执行
    if (this.isAvailable) {
      callback()
    }
  }

  // ========== MediaProjection 截图相关接口 ==========
  
  /**
   * 使用第三方工具打开文档（Word, Excel, PPT, PDF 等）
   * 
   * @param url 文档的下载地址
   * @param fileName 文档名称（包含后缀）
   */
  public openDocument(url: string, fileName: string): void {
    if (this.isAvailable && window.AndroidBridge && (window.AndroidBridge as any).openDocument) {
      (window.AndroidBridge as any).openDocument(url, fileName)
    } else {
      console.warn('[AndroidBridge] openDocument: AndroidBridge 不可用或方法不存在')
    }
  }

  /**
   * 使用第三方工具打开本地文档（Base64 格式）
   * 
   * @param base64Data Base64 编码的文件内容
   * @param fileName 文档名称（包含后缀）
   */
  public openDocumentFromBase64(base64Data: string, fileName: string): void {
    if (this.isAvailable && window.AndroidBridge && (window.AndroidBridge as any).openDocumentFromBase64) {
      (window.AndroidBridge as any).openDocumentFromBase64(base64Data, fileName)
    } else {
      console.warn('[AndroidBridge] openDocumentFromBase64: AndroidBridge 不可用或方法不存在')
    }
  }

  /**
   * 检查是否有 MediaProjection 权限
   */
  public hasMediaProjectionPermission(): boolean {
    return this.callBoolean(() => window.AndroidBridge?.hasMediaProjectionPermission?.()) || false
  }
  
  /**
   * 请求 MediaProjection 权限
   */
  public requestMediaProjectionPermission(): boolean {
    const resp = this.callString(() => window.AndroidBridge?.requestMediaProjectionPermission?.(), '')
    return resp === 'true'
  }
  
  /**
   * 释放 MediaProjection 资源
   */
  public releaseMediaProjection(): boolean {
    const resp = this.callString(() => window.AndroidBridge?.releaseMediaProjection?.(), '')
    return resp === 'true'
  }
  
  /**
   * 通用：安全调用原生方法并返回布尔值
   */
  private callBoolean(fn: (() => boolean | undefined) | undefined): boolean {
    try {
      if (this.isAvailable && fn) {
        const result = fn()
        return typeof result === 'boolean' ? result : false
      }
    } catch (err) {
      // 静默处理
    }
    return false
  }

  // ========== 语音录制相关接口 ==========

  /**
   * 开始录音
   */
  public startVoiceRecording(): VoiceRecordingResponse {
    const resp = this.callString(() => window.AndroidBridge?.startVoiceRecording?.())
    return this.parseJSON<VoiceRecordingResponse>(resp, { 
      success: false, 
      message: '录音功能不可用', 
      data: null 
    })
  }

  /**
   * 停止录音
   */
  public stopVoiceRecording(): VoiceRecordingResponse & { voiceInfo?: VoiceData } {
    const resp = this.callString(() => window.AndroidBridge?.stopVoiceRecording?.())
    const result = this.parseJSON<VoiceRecordingResponse>(resp, { 
      success: false, 
      message: '录音功能不可用', 
      data: null 
    })
    
    // 如果成功且有数据，解析语音信息
    if (result.success && result.data) {
      try {
        const voiceInfo = typeof result.data === 'string' 
          ? this.parseJSON<VoiceData>(result.data, {} as VoiceData)
          : result.data as VoiceData
        return { ...result, voiceInfo }
      } catch (error) {
        // 静默处理
      }
    }
    
    return result
  }

  /**
   * 取消录音
   */
  public cancelVoiceRecording(): VoiceRecordingResponse {
    const resp = this.callString(() => window.AndroidBridge?.cancelVoiceRecording?.())
    return this.parseJSON<VoiceRecordingResponse>(resp, { 
      success: false, 
      message: '录音功能不可用', 
      data: null 
    })
  }

  // ========== 语音播放相关接口 ==========

  /**
   * 播放语音消息
   */
  public playVoiceMessage(filePath: string): VoiceRecordingResponse {
    const resp = this.callString(() => window.AndroidBridge?.playVoiceMessage?.(filePath))
    return this.parseJSON<VoiceRecordingResponse>(resp, { 
      success: false, 
      message: '播放功能不可用', 
      data: null 
    })
  }

  /**
   * 停止播放语音
   */
  public stopVoicePlayback(): VoiceRecordingResponse {
    const resp = this.callString(() => window.AndroidBridge?.stopVoicePlayback?.())
    return this.parseJSON<VoiceRecordingResponse>(resp, { 
      success: false, 
      message: '播放功能不可用', 
      data: null 
    })
  }


  // ========== 图片发送相关接口 ==========

  /**
   * 从相册选择图片
   */
  public selectImageFromGallery(): ImagePickerResponse {
    const resp = this.callString(() => window.AndroidBridge?.selectImageFromGallery?.())
    return this.parseJSON<ImagePickerResponse>(resp, { 
      success: false, 
      message: '图片选择功能不可用', 
      data: null 
    })
  }

  /**
   * 拍照获取图片
   */
  public captureImageFromCamera(): ImagePickerResponse {
    const resp = this.callString(() => window.AndroidBridge?.captureImageFromCamera?.())
    return this.parseJSON<ImagePickerResponse>(resp, { 
      success: false, 
      message: '拍照功能不可用', 
      data: null 
    })
  }

  /**
   * 显示图片选择对话框
   */
  public showImagePickerDialog(): ImagePickerResponse {
    const resp = this.callString(() => window.AndroidBridge?.showImagePickerDialog?.())
    return this.parseJSON<ImagePickerResponse>(resp, { 
      success: false, 
      message: '图片选择对话框不可用', 
      data: null 
    })
  }

  public saveBase64ImageToGallery(base64DataUrl: string, filename: string): ImagePickerResponse {
    const resp = this.callString(() => window.AndroidBridge?.saveBase64ImageToGallery?.(base64DataUrl, filename))
    return this.parseJSON<ImagePickerResponse>(resp, {
      success: false,
      message: '保存图片功能不可用',
      data: null,
    })
  }

  // 移除checkImageResult方法，改用直接回调机制

  /**
   * 设置图片选择完成回调
   */
  public setupImageCallbacks(): void {
    if (typeof window === 'undefined') return

    // 图片选择完成回调
    if (!window.onImageSelected) {
      window.onImageSelected = (imageInfo: any) => {
        this.emit('imageSelected', imageInfo)
      }
    }

    // 拍照完成回调
    if (!window.onImageCaptured) {
      window.onImageCaptured = (imageInfo: any) => {
        this.emit('imageCaptured', imageInfo)
      }
    }
  }

  /**
   * 设置课堂相关回调
   */
  public setupClassroomCallbacks(): void {
    if (typeof window === 'undefined') return

    // 课堂加入完成回调
    if (!window.onClassroomJoined) {
      window.onClassroomJoined = (status: any) => {
        this.emit('classroomJoined', status)
      }
    }

    // 课堂退出完成回调
    if (!window.onClassroomExited) {
      window.onClassroomExited = () => {
        this.emit('classroomExited')
      }
    }

    // 课堂状态变化回调
    if (!window.onClassroomStatusChanged) {
      window.onClassroomStatusChanged = (status: any) => {
        this.emit('classroomStatusChanged', status)
      }
    }

    // 屏幕投屏开始回调
    if (!window.onScreenProjectionStarted) {
      window.onScreenProjectionStarted = () => {
        this.emit('screenProjectionStarted')
      }
    }

    // 屏幕投屏停止回调
    if (!window.onScreenProjectionStopped) {
      window.onScreenProjectionStopped = () => {
        this.emit('screenProjectionStopped')
      }
    }

    // 截图完成回调
    if (!window.onSnapshotTaken) {
      window.onSnapshotTaken = (imageData: unknown) => {
        this.emit('snapshotTaken', imageData)
      }
    }

    // MediaProjection 权限结果回调
    if (!window.onMediaProjectionPermissionResult) {
      window.onMediaProjectionPermissionResult = (granted: boolean) => {
        this.emit('mediaProjectionPermissionResult', granted)
      }
    }
    if (!window.onAndroidLog) {
      window.onAndroidLog = (level: string, tag: string, message: string) => {
        // 根据日志级别在控制台打印
        const logMessage = `[${tag}] ${message}`
        switch (level.toUpperCase()) {
          case 'DEBUG':
            break
          case 'INFO':
            break
          case 'WARN':
            console.warn(`⚠️ [Android ${level}]`, logMessage)
            break
          case 'ERROR':
            console.error(`❌ [Android ${level}]`, logMessage)
            break
          default:
            break
        }
        // 同时通过事件发送，方便其他组件监听
        this.emit('androidLog', { level, tag, message })
      }
    }
  }


  /**
   * 监听图片选择事件
   */
  public onImageSelect(callback: (imageInfo: ImageData) => void): void {
    this.addEventListener('imageSelected', callback)
  }

  /**
   * 监听拍照事件
   */
  public onImageCapture(callback: (imageInfo: ImageData) => void): void {
    this.addEventListener('imageCaptured', callback)
  }

  // ========== 加入课堂相关接口 ==========

  /**
   * 加入课堂
   * @param studentId 学生ID
   * @param studentName 学生姓名
   * @param isGuest 是否为游客模式
   * @returns 操作结果
   */
  public joinClassroom(studentId: string, studentName: string, isGuest: boolean = false): boolean {
    try {
      if (window.AndroidBridge?.joinClassroom) {
        console.log('[Classroom][Bridge][Join] call', { studentId, studentName, isGuest })
        const result = window.AndroidBridge.joinClassroom(studentId, studentName, isGuest)
        console.log('[Classroom][Bridge][Join] raw', { len: typeof result === 'string' ? result.length : -1 })
        
        // 流程：解析原生返回的JSON对象（包含success、message、data字段）
        const response = this.parseJSON<{ success: boolean, message: string, data?: string }>(result, { 
          success: false, 
          message: '解析失败' 
        })

        console.log('[Classroom][Bridge][Join] resp', { success: response.success, message: response.message })
        
        // 流程：如果data字段是字符串形式的JSON，进行二次解析（可选）
        if (response.success && response.data && typeof response.data === 'string') {
          try {
            JSON.parse(response.data)
          } catch (e) {
            // data字段解析失败不影响整体成功状态
          }
        }
        
        return response.success
      }

      console.error('[AndroidBridge] joinClassroom: window.AndroidBridge.joinClassroom not found')
      return false
    } catch (error) {
      console.error('[AndroidBridge] joinClassroom error:', error)
      return false
    }
  }

  /**
   * 退出课堂
   * @returns 操作结果
   */
  public exitClassroom(): boolean {
    try {
      if (window.AndroidBridge?.exitClassroom) {
        console.log('[Classroom][Bridge][Exit] call')
        const result = window.AndroidBridge.exitClassroom()
        console.log('[Classroom][Bridge][Exit] raw', { len: typeof result === 'string' ? result.length : -1 })
        
        // 流程：解析原生返回的JSON对象（包含success、message、data字段）
        const response = this.parseJSON<{ success: boolean, message: string, data?: string }>(result, { 
          success: false, 
          message: '解析失败' 
        })

        console.log('[Classroom][Bridge][Exit] resp', { success: response.success, message: response.message })
        
        return response.success
      }

      console.error('[AndroidBridge] exitClassroom: window.AndroidBridge.exitClassroom not found')
      return false
    } catch (error) {
      console.error('[AndroidBridge] exitClassroom error:', error)
      return false
    }
  }

  /**
   * 获取课堂状态
   * @returns 课堂状态信息
   */
  public getClassroomStatus(): BridgeClassroomStatus | null {
    try {
      if (window.AndroidBridge?.getClassroomStatus) {
        console.log('[Classroom][Bridge][Status] call')
        const result = window.AndroidBridge.getClassroomStatus()
        console.log('[Classroom][Bridge][Status] raw', { len: typeof result === 'string' ? result.length : -1 })
        
        // 流程：解析原生返回的包装对象（包含success、message、data字段）
        const response = this.parseJSON<{ 
          success: boolean, 
          message: string, 
          data?: {
            isInClass?: boolean
            isProjecting?: boolean
            isGuest?: boolean
            userId?: string
            [key: string]: any
          } 
        }>(result, { 
          success: false, 
          message: '解析失败' 
        })
        
        // 流程：如果成功且有data字段，从data中提取状态
        if (response.success && response.data) {
          const data = response.data
          // 构造 BridgeClassroomStatus 对象（使用可选字段）
          const status: BridgeClassroomStatus = {
            isInClass: data.isInClass ?? false,
            studentId: data.userId ?? '',
            studentName: '',
            localIp: '',
            tsStreamPort: 0,
            status: data.isProjecting ? 'streaming' : 'ready'
          }

          console.log('[Classroom][Bridge][Status] resp', { isInClass: status.isInClass, status: status.status, studentId: status.studentId })
          return status
        }
        
        console.log('[Classroom][Bridge][Status] resp null', { success: response.success, message: response.message })
        return null
      }

      console.error('[AndroidBridge] getClassroomStatus: window.AndroidBridge.getClassroomStatus not found')
      return null
    } catch (error) {
      console.error('[AndroidBridge] getClassroomStatus error:', error)
      return null
    }
  }

  /**
   * 停止屏幕投屏
   * @returns 操作结果
   */
  public stopScreenProjection(): boolean {
    try {
      if (window.AndroidBridge?.stopScreenProjection) {
        const result = window.AndroidBridge.stopScreenProjection()
        return this.parseJSON<boolean>(result, false)
      }

      console.error('[AndroidBridge] stopScreenProjection: method not found on window.AndroidBridge')
      return false
    } catch (error) {
      console.error('[AndroidBridge] stopScreenProjection error:', error)
      return false
    }
  }

  /**
   * 截图
   * @param commandId 命令ID
   * @returns 操作结果
   */
  public takeSnapshot(commandId: string): boolean {
    try {
      if (window.AndroidBridge?.takeSnapshot) {
        const result = window.AndroidBridge.takeSnapshot(commandId)
        return this.parseJSON<boolean>(result, false)
      }

      console.error('[AndroidBridge] takeSnapshot: method not found on window.AndroidBridge')
      return false
    } catch (error) {
      console.error('[AndroidBridge] takeSnapshot error:', error)
      return false
    }
  }

  // ========== 课堂相关事件监听 ==========

  /**
   * 监听课堂加入事件
   */
  public onClassroomJoined(callback: (status: BridgeClassroomStatus) => void): void {
    this.addEventListener('classroomJoined', callback)
  }

  /**
   * 监听课堂退出事件
   */
  public onClassroomExited(callback: () => void): void {
    this.addEventListener('classroomExited', callback)
  }

  /**
   * 监听课堂状态变化事件
   */
  public onClassroomStatusChanged(callback: (status: BridgeClassroomStatus) => void): void {
    this.addEventListener('classroomStatusChanged', callback)
  }

  /**
   * 监听屏幕投屏开始事件
   */
  public onScreenProjectionStarted(callback: () => void): void {
    this.addEventListener('screenProjectionStarted', callback)
  }

  /**
   * 监听屏幕投屏停止事件
   */
  public onScreenProjectionStopped(callback: () => void): void {
    this.addEventListener('screenProjectionStopped', callback)
  }

  /**
   * 监听截图完成事件
   */
  public onSnapshotTaken(callback: (imageData: unknown) => void): void {
    this.addEventListener('snapshotTaken', callback)
  }

  /**
   * 监听 MediaProjection 权限结果事件
   */
  public onMediaProjectionPermissionResult(callback: (granted: boolean) => void): void {
    this.addEventListener('mediaProjectionPermissionResult', callback)
  }

  // ========== 研伴 API 代理接口（测试环境走原生网络） ==========

  /**
   * 通过原生发起研伴 API 请求
   * 用于测试环境下绕过 Web 的 HTTPS 证书问题
   * 
   * @param path 接口路径，如 "/api/app/teacher-textbook"
   * @param body 请求体对象
   * @param method HTTP 方法，默认 POST
   * @param envType 环境类型，如 "INTERNAL_TEST" 或 "RELEASE"
   * @param token 认证 Token
   * @returns Promise<any> 原生返回的响应数据
   */
  public async callYanbanApi(path: string, body: any, method: string = 'POST', envType?: string, token?: string): Promise<any> {
    try {
      if (!this.isAvailable) {
        console.error('[AndroidBridge] ❌ callYanbanApi: AndroidBridge 不可用')
        return { success: false, message: 'AndroidBridge 不可用' }
      }

      if (!window.AndroidBridge?.callYanbanApi) {
        console.error('[AndroidBridge] ❌ callYanbanApi: 方法不存在')
        return { success: false, message: 'callYanbanApi 方法不存在' }
      }

      const hasBody = body !== undefined && body !== null
      const jsonBody = hasBody ? JSON.stringify(body) : ''
      const safeTokenSummary = token ? `${token.slice(0, 6)}...${token.slice(-4)}` : ''
      const bodyPreview = jsonBody.length > 500 ? `${jsonBody.slice(0, 500)}...` : jsonBody
      console.log('[AndroidBridge] 📤 callYanbanApi 请求:', {
        path,
        method,
        envType,
        hasToken: !!token,
        tokenPreview: safeTokenSummary,
        hasBody,
        bodyLength: jsonBody.length,
        bodyPreview,
      })

      // 传递环境类型和 Token 给原生，避免原生侧读 localStorage 导致死锁
      const resp = this.callString(() => window.AndroidBridge?.callYanbanApi?.(path, jsonBody, method, envType || '', token || ''))
      
      if (!resp) {
        console.warn('[AndroidBridge] ⚠️ callYanbanApi 返回空')
        return { success: false, message: '原生返回空响应' }
      }

      const respPreview = resp.length > 800 ? `${resp.slice(0, 800)}...` : resp
      console.log('[AndroidBridge] 📥 callYanbanApi 原生返回:', {
        respLength: resp.length,
        respPreview,
      })

      const result = this.parseJSON<any>(resp, { success: false, message: '解析响应失败' })
      console.log('[AndroidBridge] 📥 callYanbanApi 响应:', {
        success: result.success,
        code: (result as any)?.code,
        message: (result as any)?.message,
        hasData: !!(result as any)?.data,
        dataType: typeof (result as any)?.data,
      })
      
      return result
    } catch (error) {
      console.error('[AndroidBridge] ❌ callYanbanApi 异常:', error)
      return { success: false, message: '调用异常: ' + (error instanceof Error ? error.message : String(error)) }
    }
  }
}

export const androidBridge = AndroidBridge.getInstance()
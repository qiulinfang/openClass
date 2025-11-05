/**
 * Capacitor Bridge 工具类
 * 使用 Capacitor API 替换原生 Android Bridge
 * 
 * 功能分类：
 * 1. 基础功能 - 使用 Capacitor 官方插件实现
 * 2. 业务功能 - 需要自定义插件或保留 Android Bridge 适配
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import { App } from '@capacitor/app'
import { Keyboard } from '@capacitor/keyboard'
import { Capacitor } from '@capacitor/core'

// 使用统一类型定义
import type {
  UserInfo,
  VoiceRecordingResponse,
  ImagePickerResponse,
  VoiceRecordingStatus,
  ImageCompressionResult,
  BridgeClassroomStatus,
  ImageData,
  VoiceData,
} from '../types'
import { getCurrentUserIdOrDefault } from '../utils/user/userId'

// Android Bridge 类型辅助
type AndroidBridgeWindow = {
  AndroidBridge?: {
    showToast?: (message: string) => void
    showNotification?: (message: string, type: string) => void
    getUserToken?: () => string
    getUserInfo?: () => string
    syncUserInfo?: (userId: string, token: string, password: string) => string
    exitActivity?: () => void
    startPhotoSearch?: (subject: string) => void
    selectImageFromGallery?: () => string
    captureImageFromCamera?: () => string
    showImagePickerDialog?: () => string
    compressImage?: (filePath: string, quality: number) => string
    deleteImageFile?: (filePath: string) => string
    loadImageFileToBase64?: (filePath: string) => string
    startVoiceRecording?: () => string
    stopVoiceRecording?: () => string
    cancelVoiceRecording?: () => string
    playVoiceMessage?: (filePath: string) => string
    stopVoicePlayback?: () => string
    getVoiceRecordingStatus?: () => string
    sendTextMessageToTeacher?: (content: string, sessionId: string, subject: string) => string
    sendVoiceMessageToTeacher?: (voicePath: string, duration: string, sessionId: string, subject: string) => string
    sendPictureToTeacher?: (imagePath: string, sessionId: string, subject: string) => string
    joinClassroom?: (studentId: string, studentName: string, isGuest: boolean) => string
    exitClassroom?: () => string
    getClassroomStatus?: () => string
  }
}

function getAndroidBridge(): AndroidBridgeWindow['AndroidBridge'] | undefined {
  if (typeof window === 'undefined') return undefined
  const win = window as unknown as AndroidBridgeWindow
  return win.AndroidBridge
}

export class CapacitorBridge {
  private static instance: CapacitorBridge
  private isAvailable: boolean = false
  private eventListeners: Map<string, ((...args: unknown[]) => void)[]> = new Map()
  private isNativePlatform: boolean = false

  private constructor() {
    this.checkAvailability()
    this.setupCallbacks()
  }

  public static getInstance(): CapacitorBridge {
    if (!CapacitorBridge.instance) {
      CapacitorBridge.instance = new CapacitorBridge()
    }
    return CapacitorBridge.instance
  }

  /**
   * 检查 Capacitor 是否可用
   */
  private checkAvailability(): void {
    this.isAvailable = typeof window !== 'undefined' && Capacitor.isNativePlatform()
    this.isNativePlatform = Capacitor.isNativePlatform()
  }

  /**
   * 设置事件回调
   */
  private setupCallbacks(): void {
    if (typeof window === 'undefined') return

    // 设置应用状态监听
    App.addListener('appStateChange', ({ isActive }) => {
      this.emit('appStateChange', { isActive })
    })

    // 设置键盘监听
    Keyboard.addListener('keyboardWillShow', (info) => {
      this.emit('keyboardShow', { keyboardHeight: info.keyboardHeight })
    })

    Keyboard.addListener('keyboardWillHide', () => {
      this.emit('keyboardHide')
    })

    // 保留 Android Bridge 的回调设置（用于业务特定功能）
    this.setupLegacyCallbacks()
  }

  /**
   * 设置 Android Bridge 遗留回调（用于业务特定功能）
   */
  private setupLegacyCallbacks(): void {
    if (typeof window === 'undefined') return

    const win = window as unknown as {
      AndroidBridge?: {
        [key: string]: unknown
      }
      onImageSelected?: (imageInfo: ImageData) => void
      onImageCaptured?: (imageInfo: ImageData) => void
      onClassroomJoined?: (status: BridgeClassroomStatus) => void
      onClassroomExited?: () => void
      onClassroomStatusChanged?: (status: BridgeClassroomStatus) => void
      onTeacherMessageReceived?: (messageData: unknown) => void
    }

    // 图片选择完成回调
    if (!win.onImageSelected && win.AndroidBridge) {
      win.onImageSelected = (imageInfo: ImageData) => {
        this.emit('imageSelected', imageInfo)
      }
    }

    // 拍照完成回调
    if (!win.onImageCaptured && win.AndroidBridge) {
      win.onImageCaptured = (imageInfo: ImageData) => {
        this.emit('imageCaptured', imageInfo)
      }
    }

    // 课堂相关回调
    if (!win.onClassroomJoined && win.AndroidBridge) {
      win.onClassroomJoined = (status: BridgeClassroomStatus) => {
        this.emit('classroomJoined', status)
      }
    }

    if (!win.onClassroomExited && win.AndroidBridge) {
      win.onClassroomExited = () => {
        this.emit('classroomExited')
      }
    }

    if (!win.onClassroomStatusChanged && win.AndroidBridge) {
      win.onClassroomStatusChanged = (status: BridgeClassroomStatus) => {
        this.emit('classroomStatusChanged', status)
      }
    }

    // 老师消息回调
    if (!win.onTeacherMessageReceived && win.AndroidBridge) {
      win.onTeacherMessageReceived = (messageData: unknown) => {
        this.emit('teacherMessage', messageData)
      }
    }
  }

  /**
   * 获取 Capacitor 是否可用
   */
  public isCapacitorAvailable(): boolean {
    return this.isAvailable
  }

  /**
   * 获取是否是原生平台
   */
  public isNative(): boolean {
    return this.isNativePlatform
  }

  /**
   * 检查 Android Bridge 是否可用（用于业务特定功能）
   */
  public isAndroidBridgeAvailable(): boolean {
    return typeof window !== 'undefined' && getAndroidBridge() !== undefined
  }

  // ========== 基础功能：使用 Capacitor 官方插件 ==========

  /**
   * 显示 Toast 消息
   * 注意：Capacitor 没有官方 Toast 插件，使用浏览器原生 alert 或降级到 Android Bridge
   */
  public async showToast(message: string): Promise<void> {
    const bridge = getAndroidBridge()
    if (bridge?.showToast) {
      bridge.showToast(message)
      return
    }
    
    // Web 环境降级（仅记录日志）
    console.log('[Toast]', message)
  }

  /**
   * 显示通知
   */
  public async showNotification(message: string, type: string = 'info'): Promise<void> {
    const bridge = getAndroidBridge()
    if (bridge?.showNotification) {
      bridge.showNotification(message, type)
      return
    }
    
    // 降级到 Toast
    await this.showToast(message)
  }

  /**
   * 获取用户 Token
   * 使用 Capacitor Preferences 存储
   */
  public async getUserToken(): Promise<string> {
    try {
      const { value } = await Preferences.get({ key: 'XUEBAN_TOKEN' })
      if (value) return value

      // 降级到 Android Bridge
      const bridge = getAndroidBridge()
      if (bridge?.getUserToken) {
        return bridge.getUserToken() || ''
      }

      return ''
    } catch (error) {
      console.error('getUserToken failed:', error)
      return ''
    }
  }

  /**
   * 获取用户信息
   */
  public async getUserInfo(): Promise<Partial<UserInfo> | null> {
    try {
      // 第1步：先尝试从 Android Bridge 获取用户信息（获取用户ID）
      const bridge = getAndroidBridge()
      let user: UserInfo | null = null
      
      if (bridge?.getUserInfo) {
        const json = bridge.getUserInfo()
        if (json) {
          user = JSON.parse(json) as UserInfo
        }
      }
      
      // 第2步：如果有用户ID，尝试从 Preferences 读取带用户ID前缀的缓存
      if (user && user.id) {
        const key = `${user.id}_USER_INFO_CACHE`
        const { value } = await Preferences.get({ key })
        if (value) {
          const cached = JSON.parse(value) as UserInfo
          // 验证缓存中的用户ID是否匹配
          if (cached.id === user.id) {
            return cached
          }
        }
        // 如果没有缓存或缓存不匹配，返回从 Bridge 获取的用户信息
        return user
      }
      
      // 第3步：如果没有从 Bridge 获取到用户信息，尝试读取默认key（向后兼容）
      const userId = getCurrentUserIdOrDefault()
      const key = userId ? `${userId}_USER_INFO_CACHE` : 'USER_INFO_CACHE'
      const { value } = await Preferences.get({ key })
      if (value) {
        return JSON.parse(value) as UserInfo
      }

      // 第4步：如果都没有，返回从 Bridge 获取的用户信息（可能为 null）
      return user
    } catch (error) {
      console.error('getUserInfo failed:', error)
      return null
    }
  }

  /**
   * 同步用户信息
   */
  public async syncUserInfo(userId: string, token: string, password?: string): Promise<boolean> {
    try {
      // 使用 Preferences 存储
      await Preferences.set({ key: 'XUEBAN_TOKEN', value: token })
      await Preferences.set({ key: 'USER_ID', value: userId })
      if (password) {
        await Preferences.set({ key: 'USER_PASSWORD', value: password })
      }

      // 同步到 Android Bridge（如果可用）
      const bridge = getAndroidBridge()
      if (bridge?.syncUserInfo) {
        const result = bridge.syncUserInfo(userId, token, password || '')
        const response = JSON.parse(result || '{}')
        return response.success === true
      }

      return true
    } catch (error) {
      console.error('syncUserInfo failed:', error)
      return false
    }
  }

  /**
   * 退出应用
   */
  public async exitActivity(): Promise<void> {
    try {
      if (this.isNativePlatform) {
        // Capacitor 没有直接退出应用的 API，使用 App.exitApp()
        await App.exitApp()
      } else {
        // Web 环境：降级到 Android Bridge
        const bridge = getAndroidBridge()
        if (bridge?.exitActivity) {
          bridge.exitActivity()
        }
      }
    } catch (error) {
      console.error('exitActivity failed:', error)
    }
  }

  // ========== 图片功能：使用 Capacitor Camera API ==========

  /**
   * 从相册选择图片
   */
  public async selectImageFromGallery(): Promise<ImagePickerResponse> {
    try {
      if (!this.isNativePlatform) {
        // Web 环境：降级到 Android Bridge
        const bridge = getAndroidBridge()
        if (bridge?.selectImageFromGallery) {
          const resp = bridge.selectImageFromGallery()
          return this.parseJSON<ImagePickerResponse>(resp, {
            success: false,
            message: '图片选择功能不可用',
            data: null
          })
        }
        return { success: false, message: '非原生环境，图片选择不可用', data: null }
      }

      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      })

      if (!photo.webPath) {
        return { success: false, message: '未选择图片', data: null }
      }

      // 读取文件信息
      const fileInfo = await Filesystem.stat({
        path: photo.path!,
        directory: Directory.Data,
      })

      // 读取文件内容（转换为 base64）
      const fileContent = await Filesystem.readFile({
        path: photo.path!,
        directory: Directory.Data,
      })

      const imageData: ImageData = {
        filePath: photo.path || photo.webPath || '',
        width: 0, // Camera API 不提供宽高信息，需要额外处理
        height: 0,
        fileSize: fileInfo.size || 0,
        base64DataUrl: `data:image/${photo.format || 'jpeg'};base64,${fileContent.data}`,
      }

      return {
        success: true,
        message: '图片选择成功',
        data: JSON.stringify(imageData),
      }
    } catch (error: unknown) {
      console.error('selectImageFromGallery failed:', error)
      // 用户取消不报错
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('User cancelled') || errorMessage.includes('cancel')) {
        return { success: false, message: '用户取消', data: null }
      }
      return { success: false, message: errorMessage || '图片选择失败', data: null }
    }
  }

  /**
   * 拍照获取图片
   */
  public async captureImageFromCamera(): Promise<ImagePickerResponse> {
    try {
      if (!this.isNativePlatform) {
        // Web 环境：降级到 Android Bridge
        const bridge = getAndroidBridge()
        if (bridge?.captureImageFromCamera) {
          const resp = bridge.captureImageFromCamera()
          return this.parseJSON<ImagePickerResponse>(resp, {
            success: false,
            message: '拍照功能不可用',
            data: null
          })
        }
        return { success: false, message: '非原生环境，拍照功能不可用', data: null }
      }

      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      })

      if (!photo.webPath) {
        return { success: false, message: '拍照失败', data: null }
      }

      // 读取文件信息
      const fileInfo = await Filesystem.stat({
        path: photo.path!,
        directory: Directory.Data,
      })

      // 读取文件内容
      const fileContent = await Filesystem.readFile({
        path: photo.path!,
        directory: Directory.Data,
      })

      const imageData: ImageData = {
        filePath: photo.path || photo.webPath || '',
        width: 0, // Camera API 不提供宽高信息，需要额外处理
        height: 0,
        fileSize: fileInfo.size || 0,
        base64DataUrl: `data:image/${photo.format || 'jpeg'};base64,${fileContent.data}`,
      }

      return {
        success: true,
        message: '拍照成功',
        data: JSON.stringify(imageData),
      }
    } catch (error: unknown) {
      console.error('captureImageFromCamera failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('User cancelled') || errorMessage.includes('cancel')) {
        return { success: false, message: '用户取消', data: null }
      }
      return { success: false, message: errorMessage || '拍照失败', data: null }
    }
  }

  /**
   * 显示图片选择对话框
   * 使用 Capacitor Camera 的图片选择器
   */
  public async showImagePickerDialog(): Promise<ImagePickerResponse> {
    try {
      if (!this.isNativePlatform) {
        // Web 环境：降级到 Android Bridge
        const bridge = getAndroidBridge()
        if (bridge?.showImagePickerDialog) {
          const resp = bridge.showImagePickerDialog()
          return this.parseJSON<ImagePickerResponse>(resp, {
            success: false,
            message: '图片选择对话框不可用',
            data: null
          })
        }
        return { success: false, message: '非原生环境，图片选择对话框不可用', data: null }
      }

      // 使用 Camera API 显示选择对话框（可以选择相册或拍照）
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt, // Prompt 会显示选择对话框
      })

      if (!photo.webPath) {
        return { success: false, message: '未选择图片', data: null }
      }

      const fileInfo = await Filesystem.stat({
        path: photo.path!,
        directory: Directory.Data,
      })

      const fileContent = await Filesystem.readFile({
        path: photo.path!,
        directory: Directory.Data,
      })

      const imageData: ImageData = {
        filePath: photo.path || photo.webPath || '',
        width: 0, // Camera API 不提供宽高信息，需要额外处理
        height: 0,
        fileSize: fileInfo.size || 0,
        base64DataUrl: `data:image/${photo.format || 'jpeg'};base64,${fileContent.data}`,
      }

      return {
        success: true,
        message: '图片选择成功',
        data: JSON.stringify(imageData),
      }
    } catch (error: unknown) {
      console.error('showImagePickerDialog failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('User cancelled') || errorMessage.includes('cancel')) {
        return { success: false, message: '用户取消', data: null }
      }
      return { success: false, message: errorMessage || '图片选择失败', data: null }
    }
  }

  /**
   * 压缩图片
   */
  public async compressImage(filePath: string, quality: number = 80): Promise<ImagePickerResponse & { compressionResult?: ImageCompressionResult }> {
    try {
      // 降级到 Android Bridge（Capacitor 没有图片压缩 API）
      const bridge = getAndroidBridge()
      if (bridge?.compressImage) {
        const resp = bridge.compressImage(filePath, quality)
        const result = this.parseJSON<ImagePickerResponse>(resp, {
          success: false,
          message: '图片压缩功能不可用',
          data: null
        })
        
      if (result.success && result.data) {
        try {
          const compressionResult = typeof result.data === 'string'
            ? this.parseJSON<ImageCompressionResult>(result.data, {} as ImageCompressionResult)
            : result.data as ImageCompressionResult
          return { ...result, compressionResult }
        } catch {
          // 静默处理
        }
      }
        
        return result
      }

      // 如果没有原生支持，返回原文件路径
      return {
        success: true,
        message: '图片压缩功能不可用，使用原图',
        data: null,
        compressionResult: {
          originalPath: filePath,
          compressedPath: filePath,
          originalSize: 0,
          compressedSize: 0,
          compressionRatio: 0
        }
      }
    } catch (error) {
      console.error('compressImage failed:', error)
      return { success: false, message: '图片压缩失败', data: null }
    }
  }

  /**
   * 删除图片文件
   */
  public async deleteImageFile(filePath: string): Promise<ImagePickerResponse> {
    try {
      // 使用 Filesystem API 删除文件
      if (this.isNativePlatform && filePath) {
        await Filesystem.deleteFile({
          path: filePath,
          directory: Directory.Data,
        })
        return { success: true, message: '文件删除成功', data: null }
      }

      // 降级到 Android Bridge
      const bridge = getAndroidBridge()
      if (bridge?.deleteImageFile) {
        const resp = bridge.deleteImageFile(filePath)
        return this.parseJSON<ImagePickerResponse>(resp, {
          success: false,
          message: '删除图片功能不可用',
          data: null
        })
      }

      return { success: false, message: '删除图片功能不可用', data: null }
    } catch (error) {
      console.error('deleteImageFile failed:', error)
      return { success: false, message: '删除失败', data: null }
    }
  }

  /**
   * 拍照搜题
   */
  public async takePicture(subject: string): Promise<string> {
    try {
      // 降级到 Android Bridge（业务特定功能）
      const bridge = getAndroidBridge()
      if (bridge?.startPhotoSearch) {
        bridge.startPhotoSearch(subject)
      }
      return ''
    } catch (error) {
      console.error('takePicture failed:', error)
      return ''
    }
  }

  // ========== 语音功能：需要自定义插件或降级到 Android Bridge ==========

  /**
   * 开始录音
   * 注意：Capacitor 没有官方录音插件，需要自定义插件或降级到 Android Bridge
   */
  public startVoiceRecording(): VoiceRecordingResponse {
    // 降级到 Android Bridge
    const win = window as unknown as {
      AndroidBridge?: {
        startVoiceRecording?: () => string
      }
    }
    if (this.isAndroidBridgeAvailable() && win.AndroidBridge?.startVoiceRecording) {
      const resp = win.AndroidBridge.startVoiceRecording()
      return this.parseJSON<VoiceRecordingResponse>(resp, {
        success: false,
        message: '录音功能不可用',
        data: null
      })
    }

    return {
      success: false,
      message: '录音功能需要自定义插件或 Android Bridge',
      data: null
    }
  }

  /**
   * 停止录音
   */
  public stopVoiceRecording(): VoiceRecordingResponse & { voiceInfo?: VoiceData } {
    const bridge = getAndroidBridge()
    if (bridge?.stopVoiceRecording) {
      const resp = bridge.stopVoiceRecording()
      const result = this.parseJSON<VoiceRecordingResponse>(resp, {
        success: false,
        message: '录音功能不可用',
        data: null
      })

      if (result.success && result.data) {
        try {
          const voiceInfo = typeof result.data === 'string'
            ? this.parseJSON<VoiceData>(result.data, {} as VoiceData)
            : result.data as VoiceData
          return { ...result, voiceInfo }
        } catch {
          // 静默处理
        }
      }

      return result
    }

    return {
      success: false,
      message: '录音功能需要自定义插件或 Android Bridge',
      data: null
    }
  }

  /**
   * 取消录音
   */
  public cancelVoiceRecording(): VoiceRecordingResponse {
    const bridge = getAndroidBridge()
    if (bridge?.cancelVoiceRecording) {
      const resp = bridge.cancelVoiceRecording()
      return this.parseJSON<VoiceRecordingResponse>(resp, {
        success: false,
        message: '录音功能不可用',
        data: null
      })
    }

    return {
      success: false,
      message: '录音功能需要自定义插件或 Android Bridge',
      data: null
    }
  }

  /**
   * 播放语音消息
   */
  public playVoiceMessage(filePath: string): VoiceRecordingResponse {
    const bridge = getAndroidBridge()
    if (bridge?.playVoiceMessage) {
      const resp = bridge.playVoiceMessage(filePath)
      return this.parseJSON<VoiceRecordingResponse>(resp, {
        success: false,
        message: '播放功能不可用',
        data: null
      })
    }

    return {
      success: false,
      message: '播放功能需要自定义插件或 Android Bridge',
      data: null
    }
  }

  /**
   * 停止播放语音
   */
  public stopVoicePlayback(): VoiceRecordingResponse {
    const bridge = getAndroidBridge()
    if (bridge?.stopVoicePlayback) {
      const resp = bridge.stopVoicePlayback()
      return this.parseJSON<VoiceRecordingResponse>(resp, {
        success: false,
        message: '播放功能不可用',
        data: null
      })
    }

    return {
      success: false,
      message: '播放功能需要自定义插件或 Android Bridge',
      data: null
    }
  }

  /**
   * 获取录音状态
   */
  public getVoiceRecordingStatus(): VoiceRecordingStatus {
    const bridge = getAndroidBridge()
    if (bridge?.getVoiceRecordingStatus) {
      const resp = bridge.getVoiceRecordingStatus()
      const response = this.parseJSON<VoiceRecordingResponse>(resp, {
        success: false,
        message: '',
        data: null
      })

      if (response.success && response.data) {
        return this.parseJSON<VoiceRecordingStatus>(response.data, {
          isRecording: false,
          isPlaying: false,
          currentFile: ''
        })
      }
    }

    return {
      isRecording: false,
      isPlaying: false,
      currentFile: ''
    }
  }

  // ========== 业务功能：老师对话、课堂管理等（降级到 Android Bridge） ==========

  /**
   * 发送文本消息给老师
   */
  public sendTextMessageToTeacher(content: string, sessionId: string, subject: string): boolean {
    console.log('[CapacitorBridge] 📤 sendTextMessageToTeacher: 开始发送文本消息')
    console.log('[CapacitorBridge] 📤 sendTextMessageToTeacher: 参数 -', {
      contentLength: content?.length || 0,
      contentPreview: content?.substring(0, 100) || 'null',
      sessionId,
      subject
    })
    
    const startTime = performance.now()
    
    try {
      const bridge = getAndroidBridge()
      if (!bridge) {
        console.error('[CapacitorBridge] ❌ sendTextMessageToTeacher: AndroidBridge不可用')
        return false
      }
      
      if (!bridge.sendTextMessageToTeacher) {
        console.error('[CapacitorBridge] ❌ sendTextMessageToTeacher: 方法不存在')
        return false
      }
      
      console.log('[CapacitorBridge] 📤 sendTextMessageToTeacher: 调用AndroidBridge方法')
      const resp = bridge.sendTextMessageToTeacher(content, sessionId, subject)
      
      const duration = performance.now() - startTime
      console.log('[CapacitorBridge] 📥 sendTextMessageToTeacher: AndroidBridge返回, 耗时=' + duration.toFixed(2) + 'ms')
      console.log('[CapacitorBridge] 📥 sendTextMessageToTeacher: 原始响应类型=' + typeof resp)
      
      // 如果返回的是字符串，需要解析JSON
      let result: { success: boolean; message?: string; data?: any }
      if (typeof resp === 'string') {
        result = this.parseJSON<{ success: boolean; message?: string; data?: any }>(resp, { success: false })
      } else if (typeof resp === 'boolean') {
        result = { success: resp }
      } else {
        result = { success: false, message: '未知响应类型' }
      }
      
      console.log('[CapacitorBridge] 📥 sendTextMessageToTeacher: 解析结果 -', {
        success: result.success,
        message: result.message,
        hasData: !!result.data
      })
      
      if (!result.success) {
        console.error('[CapacitorBridge] ❌ sendTextMessageToTeacher: 发送失败 -', result.message || '未知错误')
      } else {
        console.log('[CapacitorBridge] ✅ sendTextMessageToTeacher: 发送成功')
      }
      
      return result.success
    } catch (error) {
      const duration = performance.now() - startTime
      console.error('[CapacitorBridge] ❌ sendTextMessageToTeacher: 异常 -', error, ', 耗时=' + duration.toFixed(2) + 'ms')
      return false
    }
  }

  /**
   * 发送语音消息给老师
   */
  public sendVoiceMessageToTeacher(voicePath: string, duration: string, sessionId: string, subject: string): boolean {
    console.log('[CapacitorBridge] 📤 sendVoiceMessageToTeacher: 开始发送语音消息')
    console.log('[CapacitorBridge] 📤 sendVoiceMessageToTeacher: 参数 -', {
      voicePath,
      duration,
      sessionId,
      subject
    })
    
    const startTime = performance.now()
    
    try {
      const bridge = getAndroidBridge()
      if (!bridge) {
        console.error('[CapacitorBridge] ❌ sendVoiceMessageToTeacher: AndroidBridge不可用')
        return false
      }
      
      if (!bridge.sendVoiceMessageToTeacher) {
        console.error('[CapacitorBridge] ❌ sendVoiceMessageToTeacher: 方法不存在')
        return false
      }
      
      console.log('[CapacitorBridge] 📤 sendVoiceMessageToTeacher: 调用AndroidBridge方法')
      const resp = bridge.sendVoiceMessageToTeacher(voicePath, duration, sessionId, subject)
      
      const duration = performance.now() - startTime
      console.log('[CapacitorBridge] 📥 sendVoiceMessageToTeacher: AndroidBridge返回, 耗时=' + duration.toFixed(2) + 'ms')
      console.log('[CapacitorBridge] 📥 sendVoiceMessageToTeacher: 原始响应类型=' + typeof resp)
      
      // 如果返回的是字符串，需要解析JSON
      let result: { success: boolean; message?: string; data?: any }
      if (typeof resp === 'string') {
        result = this.parseJSON<{ success: boolean; message?: string; data?: any }>(resp, { success: false })
      } else if (typeof resp === 'boolean') {
        result = { success: resp }
      } else {
        result = { success: false, message: '未知响应类型' }
      }
      
      console.log('[CapacitorBridge] 📥 sendVoiceMessageToTeacher: 解析结果 -', {
        success: result.success,
        message: result.message,
        hasData: !!result.data
      })
      
      if (!result.success) {
        console.error('[CapacitorBridge] ❌ sendVoiceMessageToTeacher: 发送失败 -', result.message || '未知错误')
      } else {
        console.log('[CapacitorBridge] ✅ sendVoiceMessageToTeacher: 发送成功')
      }
      
      return result.success
    } catch (error) {
      const duration = performance.now() - startTime
      console.error('[CapacitorBridge] ❌ sendVoiceMessageToTeacher: 异常 -', error, ', 耗时=' + duration.toFixed(2) + 'ms')
      return false
    }
  }

  /**
   * 发送图片消息给老师
   */
  public sendPictureToTeacher(imagePath: string, sessionId: string, subject: string): boolean {
    const bridge = getAndroidBridge()
    if (bridge?.sendPictureToTeacher) {
      const resp = bridge.sendPictureToTeacher(imagePath, sessionId, subject)
      const result = this.parseJSON<{ success: boolean }>(resp, { success: false })
      return result.success
    }
    return false
  }

  /**
   * 加入课堂
   */
  public joinClassroom(studentId: string, studentName: string, isGuest: boolean = false): boolean {
    const bridge = getAndroidBridge()
    if (bridge?.joinClassroom) {
      const result = bridge.joinClassroom(studentId, studentName, isGuest)
      const response = this.parseJSON<{ success: boolean, message: string }>(result, {
        success: false,
        message: '解析失败'
      })
      return response.success
    }
    return false
  }

  /**
   * 退出课堂
   */
  public exitClassroom(): boolean {
    const bridge = getAndroidBridge()
    if (bridge?.exitClassroom) {
      const result = bridge.exitClassroom()
      const response = this.parseJSON<{ success: boolean, message: string }>(result, {
        success: false,
        message: '解析失败'
      })
      return response.success
    }
    return false
  }

  /**
   * 获取课堂状态
   */
  public getClassroomStatus(): BridgeClassroomStatus | null {
    const bridge = getAndroidBridge()
    if (bridge?.getClassroomStatus) {
      const result = bridge.getClassroomStatus()
      const response = this.parseJSON<{
        success: boolean
        message: string
        data?: {
          isInClass?: boolean
          isProjecting?: boolean
          isGuest?: boolean
          userId?: string
          [key: string]: unknown
        }
      }>(result, {
        success: false,
        message: '解析失败'
      })

      if (response.success && response.data) {
        const data = response.data
        const status: BridgeClassroomStatus = {
          isInClass: data.isInClass ?? false,
          studentId: data.userId ?? '',
          studentName: '',
          localIp: '',
          tsStreamPort: 0,
          status: data.isProjecting ? 'streaming' : 'ready'
        }
        return status
      }
    }

    return null
  }

  // ========== 事件监听器管理 ==========

  public addEventListener(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  public removeEventListener(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args)
        } catch (err) {
          console.error(`Event listener error for ${event}:`, err)
        }
      })
    }
  }

  // ========== 便捷方法 ==========

  public onImageSelect(callback: (imageInfo: ImageData) => void): void {
    this.addEventListener('imageSelected', (args) => {
      callback(args as ImageData)
    })
  }

  public onImageCapture(callback: (imageInfo: ImageData) => void): void {
    this.addEventListener('imageCaptured', (args) => {
      callback(args as ImageData)
    })
  }

  public onClassroomJoined(callback: (status: BridgeClassroomStatus) => void): void {
    this.addEventListener('classroomJoined', (args) => {
      callback(args as BridgeClassroomStatus)
    })
  }

  public onClassroomExited(callback: () => void): void {
    this.addEventListener('classroomExited', () => {
      callback()
    })
  }

  public onClassroomStatusChanged(callback: (status: BridgeClassroomStatus) => void): void {
    this.addEventListener('classroomStatusChanged', (args) => {
      callback(args as BridgeClassroomStatus)
    })
  }

  public onTeacherMessage(callback: (message: unknown) => void): void {
    this.addEventListener('teacherMessage', callback)
  }

  // ========== 工具方法 ==========

  private parseJSON<T>(jsonStr: string, defaultValue: T): T {
    try {
      if (!jsonStr) return defaultValue
      return JSON.parse(jsonStr) as T
    } catch {
      return defaultValue
    }
  }

  /**
   * 获取调试信息
   */
  public getDebugInfo(): object {
    return {
      isAvailable: this.isAvailable,
      isNativePlatform: this.isNativePlatform,
      hasAndroidBridge: this.isAndroidBridgeAvailable(),
      eventListeners: Object.fromEntries(
        Array.from(this.eventListeners.entries()).map(([key, listeners]) => [key, listeners.length])
      ),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      platform: Capacitor.getPlatform(),
    }
  }
}

export const capacitorBridge = CapacitorBridge.getInstance()


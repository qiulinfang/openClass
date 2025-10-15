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
} from '../types'

// 枚举需要普通导入才能作为值使用
import { MessageType, ChatRole } from '../types'

// 使用统一类型定义
import type {
  VoiceRecordingStatus,
  ImageCompressionResult,
} from '../types'

// HTTP相关的接口定义已移至types/index.ts


export class AndroidBridge {
  private static instance: AndroidBridge
  private isAvailable: boolean = false
  private eventListeners: Map<string, Function[]> = new Map()
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
   * 安全的日志输出
   */
  private safeLog(...args: any[]): void {
    try {
      console.log(...args)
    } catch (e) {
      // 静默处理
    }
  }

  /**
   * 安全的警告输出
   */
  private safeWarn(...args: any[]): void {
    try {
      console.warn(...args)
    } catch (e) {
      // 静默处理
    }
  }

  /**
   * 安全的错误输出
   */
  private safeError(...args: any[]): void {
    try {
      console.error(...args)
    } catch (e) {
      // 静默处理
    }
  }

  /**
   * 检查Android Bridge是否可用
   */
  private checkAvailability(): void {
    this.isAvailable = typeof window !== 'undefined' && 
                      typeof window.AndroidBridge !== 'undefined'
    
    if (!this.isAvailable) {
      this.safeWarn('Android Bridge 不可用，将使用模拟数据')
    }
  }

  /**
   * 设置Android事件回调
   */
  private setupCallbacks(): void {
    if (typeof window === 'undefined') return

    // 设置流式响应回调
    if (!window.onStreamResponse) {
      window.onStreamResponse = (requestId: string, chunk: string, isComplete: boolean) => {
        this.safeLog('收到流式响应:', requestId, chunk, isComplete)
        const event = new CustomEvent('nativeStreamResponse', {
          detail: { requestId, chunk, isComplete }
        })
        window.dispatchEvent(event)
      }
    }

    // 设置完整响应回调
    if (!window.onChatResponse) {
      window.onChatResponse = (requestId: string, response: any) => {
        this.safeLog('收到完整响应:', requestId, response)
        const event = new CustomEvent('nativeChatResponse', {
          detail: { requestId, response }
        })
        window.dispatchEvent(event)
      }
    }

    // 确保回调函数存在
    if (!window.onAndroidReady) {
      window.onAndroidReady = () => {
        this.safeLog('Android Bridge 已准备就绪')
        this.checkAvailability()
        this.onAndroidReady()
      }
    }

    if (!window.onExerciseDeleted) {
      window.onExerciseDeleted = (exerciseId: string) => {
        this.safeLog('题目已删除:', exerciseId)
        this.onExerciseDeleted(exerciseId)
      }
    }

    if (!window.onQuestionAdded) {
      window.onQuestionAdded = (questionData: any) => {
        this.safeLog('题目已添加:', questionData)
        this.onQuestionAdded(questionData)
      }
    }

    if (!window.onProgressSaved) {
      window.onProgressSaved = (progressData: any) => {
        this.safeLog('进度已保存:', progressData)
        this.onProgressSaved(progressData)
      }
    }

    if (!window.onDataUpdate) {
      window.onDataUpdate = (type: string, data: any) => {
        this.safeLog('数据更新:', type, data)
        this.onDataUpdate(type, data)
      }
    }

    // 新增：题目列表更新回调
    if (typeof window !== 'undefined' && !window.onExerciseListUpdated) {
      window.onExerciseListUpdated = (questions: any) => {
        this.safeLog('题目列表已更新:', questions)
        this.onExerciseListUpdated(questions)
      }
    }

    // 新增：加载状态变化回调
    if (typeof window !== 'undefined' && !window.onLoadingStateChanged) {
      window.onLoadingStateChanged = (isLoading: boolean) => {
        this.safeLog('加载状态变化:', isLoading)
        this.onLoadingStateChanged(isLoading)
      }
    }

    // 新增：科目变化回调
    if (typeof window !== 'undefined' && !window.onSubjectChanged) {
      window.onSubjectChanged = (subjectName: string) => {
        this.safeLog('科目已切换:', subjectName)
        this.onSubjectChanged(subjectName)
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
      this.safeError('AndroidBridge 调用失败:', err)
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
      this.safeError('AndroidBridge 调用失败:', err)
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
      this.safeWarn('AndroidBridge JSON 解析失败，返回默认值', err)
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
    } else {
      this.safeLog('Toast:', message)
    }
  }

  /**
   * 显示Android原生通知
   * @param message 通知内容
   * @param type 通知类型：success, error, warning, info
   */
  public showNotification(message: string, type: string = 'info'): void {
    if (this.isAvailable && window.AndroidBridge && window.AndroidBridge.showNotification) {
      window.AndroidBridge.showNotification(message, type)
    } else {
      // 降级到Toast或控制台输出
      if (this.isAvailable && window.AndroidBridge) {
        window.AndroidBridge.showToast(message)
      } else {
        this.safeLog(`Notification [${type}]:`, message)
      }
    }
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

  // HTTP相关接口已移至API服务层，此处不再提供

  // AI聊天、老师对话、进度保存等HTTP接口已移至API服务层，此处不再提供

  /**
   * 退出当前 Activity
   */
  public exitActivity(): void {
    this.callVoid(() => window.AndroidBridge?.exitActivity?.())
  }

  /**
   * 拍照搜题（与原生 startPhotoSearch 对齐）
   * 注意：若原生没有返回路径，这里返回空字符串
   */
  public takePicture(subject: string): Promise<string> {
    try {
      window.AndroidBridge?.startPhotoSearch?.(subject)
    } catch (err) {
      this.safeError('调用 startPhotoSearch 失败:', err)
    }
    return Promise.resolve('')
  }

  // 题目置顶功能已改为纯前端实现，不需要Android接口调用

  /**
   * 设置拍照搜题结果回调
   */
  public onPhotoSearchResult(callback: (success: boolean, questionData?: any) => void): void {
    this.addEventListener('photoSearchResult', callback)
    
    // 设置全局回调
    if (typeof window !== 'undefined') {
      ;(window as any).onPhotoSearchResult = (success: boolean, questionData?: any) => {
        this.emit('photoSearchResult', success, questionData)
      }
    }
  }

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
      listeners.forEach(callback => {
        try {
          callback(...args)
        } catch (err) {
          this.safeError(`事件监听器执行失败 [${event}]:`, err)
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

  /**
   * 题目删除回调
   */
  private onExerciseDeleted(exerciseId: string): void {
    this.emit('exerciseDeleted', exerciseId)
  }

  /**
   * 题目添加回调
   */
  private onQuestionAdded(questionData: any): void {
    this.emit('questionAdded', questionData)
  }

  /**
   * 进度保存回调
   */
  private onProgressSaved(progressData: any): void {
    this.emit('progressSaved', progressData)
  }

  /**
   * 数据更新回调
   */
  private onDataUpdate(type: string, data: any): void {
    this.emit('dataUpdate', type, data)
  }

  /**
   * 题目列表更新回调
   */
  private onExerciseListUpdated(questions: any): void {
    this.emit('exerciseListUpdated', questions)
  }

  /**
   * 加载状态变化回调
   */
  private onLoadingStateChanged(isLoading: boolean): void {
    this.emit('loadingStateChanged', isLoading)
  }

  /**
   * 科目变化回调
   */
  private onSubjectChanged(subjectName: string): void {
    this.emit('subjectChanged', subjectName)
  }

  /**
   * 监听题目列表更新事件
   */
  public onExerciseListUpdate(callback: (questions: any) => void): void {
    this.addEventListener('exerciseListUpdated', callback)
  }

  /**
   * 监听加载状态变化事件
   */
  public onLoadingStateChange(callback: (isLoading: boolean) => void): void {
    this.addEventListener('loadingStateChanged', callback)
  }

  /**
   * 监听科目变化事件
   */
  public onSubjectChange(callback: (subjectName: string) => void): void {
    this.addEventListener('subjectChanged', callback)
  }

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

  /**
   * 监听题目删除事件
   */
  public onExerciseDelete(callback: (exerciseId: string) => void): void {
    this.addEventListener('exerciseDeleted', callback)
  }

  /**
   * 监听题目添加事件
   */
  public onQuestionAdd(callback: (questionData: any) => void): void {
    this.addEventListener('questionAdded', callback)
  }

  /**
   * 监听进度保存事件
   */
  public onProgressSave(callback: (progressData: any) => void): void {
    this.addEventListener('progressSaved', callback)
  }

  /**
   * 监听数据更新事件
   */
  public onDataUpdated(callback: (type: string, data: any) => void): void {
    this.addEventListener('dataUpdate', callback)
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
  public stopVoiceRecording(): VoiceRecordingResponse & { voiceInfo?: import('../types').VoiceData } {
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
          ? this.parseJSON<import('../types').VoiceData>(result.data, {} as import('../types').VoiceData)
          : result.data as import('../types').VoiceData
        return { ...result, voiceInfo }
      } catch (error) {
        this.safeError('解析语音录制信息失败:', error)
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

  /**
   * 发送语音消息
   */
  public sendVoiceMessage(filePath: string, duration: string, chatId: string = 'default'): VoiceRecordingResponse {
    const resp = this.callString(() => window.AndroidBridge?.sendVoiceMessage?.(filePath, duration, chatId))
    return this.parseJSON<VoiceRecordingResponse>(resp, { 
      success: false, 
      message: '发送功能不可用', 
      data: null 
    })
  }

  /**
   * 获取录音状态
   */
  public getVoiceRecordingStatus(): VoiceRecordingStatus {
    const resp = this.callString(() => window.AndroidBridge?.getVoiceRecordingStatus?.())
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
    
    return {
      isRecording: false,
      isPlaying: false,
      currentFile: ''
    }
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

  /**
   * 发送图片消息
   */
  public sendImageMessage(filePath: string, chatId: string = 'default'): ImagePickerResponse {
    const resp = this.callString(() => window.AndroidBridge?.sendImageMessage?.(filePath, chatId))
    return this.parseJSON<ImagePickerResponse>(resp, { 
      success: false, 
      message: '发送图片功能不可用', 
      data: null 
    })
  }

  /**
   * 压缩图片
   */
  public compressImage(filePath: string, quality: number = 80): ImagePickerResponse & { compressionResult?: ImageCompressionResult } {
    const resp = this.callString(() => window.AndroidBridge?.compressImage?.(filePath, quality))
    const result = this.parseJSON<ImagePickerResponse>(resp, { 
      success: false, 
      message: '图片压缩功能不可用', 
      data: null 
    })
    
    // 如果成功且有数据，解析压缩结果
    if (result.success && result.data) {
      try {
        const compressionResult = typeof result.data === 'string' 
          ? this.parseJSON<ImageCompressionResult>(result.data, {} as ImageCompressionResult)
          : result.data as ImageCompressionResult
        return { ...result, compressionResult }
      } catch (error) {
        this.safeError('解析图片压缩结果失败:', error)
      }
    }
    
    return result
  }

  /**
   * 删除图片文件
   */
  public deleteImageFile(filePath: string): ImagePickerResponse {
    const resp = this.callString(() => window.AndroidBridge?.deleteImageFile?.(filePath))
    return this.parseJSON<ImagePickerResponse>(resp, { 
      success: false, 
      message: '删除图片功能不可用', 
      data: null 
    })
  }

  /**
   * 获取拍照后的图片信息
   */
  public getCapturedImageInfo(): ImagePickerResponse & { imageInfo?: import('../types').ImageData } {
    const resp = this.callString(() => window.AndroidBridge?.checkImageResult?.())
    const result = this.parseJSON<ImagePickerResponse>(resp, { 
      success: false, 
      message: '获取拍照图片信息功能不可用', 
      data: null 
    })
    
    // 如果成功且有数据，解析图片信息
    if (result.success && result.data) {
      try {
        const imageInfo = typeof result.data === 'string' 
          ? this.parseJSON<import('../types').ImageData>(result.data, {} as import('../types').ImageData)
          : result.data as import('../types').ImageData
        return { ...result, imageInfo }
      } catch (error) {
        this.safeError('解析拍照图片信息失败:', error)
      }
    }
    
    return result
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
        this.safeLog('图片选择完成:', imageInfo)
        this.emit('imageSelected', imageInfo)
      }
    }

    // 拍照完成回调
    if (!window.onImageCaptured) {
      window.onImageCaptured = (imageInfo: any) => {
        this.safeLog('拍照完成:', imageInfo)
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
        this.safeLog('课堂加入完成:', status)
        this.emit('classroomJoined', status)
      }
    }

    // 课堂退出完成回调
    if (!window.onClassroomExited) {
      window.onClassroomExited = () => {
        this.safeLog('课堂退出完成')
        this.emit('classroomExited')
      }
    }

    // 课堂状态变化回调
    if (!window.onClassroomStatusChanged) {
      window.onClassroomStatusChanged = (status: any) => {
        this.safeLog('课堂状态变化:', status)
        this.emit('classroomStatusChanged', status)
      }
    }

    // 屏幕投屏开始回调
    if (!window.onScreenProjectionStarted) {
      window.onScreenProjectionStarted = () => {
        this.safeLog('屏幕投屏开始')
        this.emit('screenProjectionStarted')
      }
    }

    // 屏幕投屏停止回调
    if (!window.onScreenProjectionStopped) {
      window.onScreenProjectionStopped = () => {
        this.safeLog('屏幕投屏停止')
        this.emit('screenProjectionStopped')
      }
    }

    // 截图完成回调
    if (!window.onSnapshotTaken) {
      window.onSnapshotTaken = (imageData: any) => {
        this.safeLog('截图完成:', imageData)
        this.emit('snapshotTaken', imageData)
      }
    }

    // 课堂错误回调
    if (!window.onClassroomError) {
      window.onClassroomError = (error: string) => {
        this.safeLog('课堂错误:', error)
        this.emit('classroomError', error)
      }
    }
  }


  /**
   * 监听图片选择事件
   */
  public onImageSelect(callback: (imageInfo: import('../types').ImageData) => void): void {
    this.addEventListener('imageSelected', callback)
  }

  /**
   * 监听拍照事件
   */
  public onImageCapture(callback: (imageInfo: import('../types').ImageData) => void): void {
    this.addEventListener('imageCaptured', callback)
  }


  // ========== 老师对话相关接口（通过WebView桥接调用原生RabbitMQ） ==========

  /**
   * 创建老师对话会话
   */
  public createTeacherChatSession(aiSessionId: string, aiSessionName: string, subject: string): any {
    console.log('🔍 AndroidBridge创建老师会话 - 开始', {
      aiSessionId,
      aiSessionName,
      subject,
      hasAndroidBridge: !!(window.AndroidBridge?.createTeacherChatSession)
    })

    const resp = this.callString(() => {
      console.log('🔍 AndroidBridge创建老师会话 - 调用原生方法')
      return window.AndroidBridge?.createTeacherChatSession?.(aiSessionId, aiSessionName, subject)
    })
    
    console.log('🔍 AndroidBridge创建老师会话 - 原生方法返回', {
      resp,
      respType: typeof resp
    })
    
    const result = this.parseJSON<any>(resp, null)
    
    console.log('🔍 AndroidBridge创建老师会话 - 解析结果', {
      result,
      hasData: !!result
    })
    
    return result
  }

  /**
   * 发送文本消息给老师
   */
  public sendTextMessageToTeacher(content: string, sessionId: string, subject: string): boolean {
    console.log('🔍 AndroidBridge发送文本消息给老师 - 开始', {
      content: content.substring(0, 50) + '...',
      sessionId,
      subject,
      hasAndroidBridge: !!(window.AndroidBridge?.sendTextMessageToTeacher)
    })

    const resp = this.callString(() => {
      console.log('🔍 AndroidBridge发送文本消息给老师 - 调用原生方法')
      return window.AndroidBridge?.sendTextMessageToTeacher?.(content, sessionId, subject)
    })
    
    console.log('🔍 AndroidBridge发送文本消息给老师 - 原生方法返回', {
      resp,
      respType: typeof resp
    })
    
    const result = this.parseJSON<{ success: boolean }>(resp, { success: false })
    
    console.log('🔍 AndroidBridge发送文本消息给老师 - 解析结果', {
      result,
      success: result.success
    })
    
    return result.success
  }

  /**
   * 发送语音消息给老师
   */
  public sendVoiceMessageToTeacher(voicePath: string, duration: string, sessionId: string, subject: string): boolean {
    const resp = this.callString(() => window.AndroidBridge?.sendVoiceMessageToTeacher?.(voicePath, duration, sessionId, subject))
    const result = this.parseJSON<{ success: boolean }>(resp, { success: false })
    return result.success
  }

  /**
   * 发送图片消息给老师
   */
  public sendPictureToTeacher(imagePath: string, sessionId: string, subject: string): boolean {
    const resp = this.callString(() => window.AndroidBridge?.sendPictureToTeacher?.(imagePath, sessionId, subject))
    const result = this.parseJSON<{ success: boolean }>(resp, { success: false })
    return result.success
  }

  /**
   * 转发AI对话记录给老师
   */
  public forwardAiChatToTeacher(selectedMessagesData: string, teacherSessionId: string): boolean {
    const resp = this.callString(() => {
      return window.AndroidBridge?.forwardAiChatToTeacher?.(selectedMessagesData, teacherSessionId)
    })
    
    const result = this.parseJSON<{ success: boolean }>(resp, { success: false })
    
    return result.success
  }

  /**
   * 获取老师会话的消息历史
   */
  public getTeacherChatHistory(sessionId: string): any[] {
    const resp = this.callString(() => window.AndroidBridge?.getTeacherChatHistory?.(sessionId))
    return this.parseJSON<any[]>(resp, [])
  }

  /**
   * 检查老师会话是否存在
   */
  public checkTeacherSessionExists(sessionId: string): boolean {
    const resp = this.callString(() => window.AndroidBridge?.checkTeacherSessionExists?.(sessionId))
    const result = this.parseJSON<{ exists: boolean }>(resp, { exists: false })
    return result.exists
  }

  /**
   * 获取当前会话的消息数量
   */
  public getCurrentSessionMessageCount(sessionId: string): number {
    const resp = this.callString(() => window.AndroidBridge?.getCurrentSessionMessageCount?.(sessionId))
    const result = this.parseJSON<{ count: number }>(resp, { count: 0 })
    return result.count
  }

  /**
   * 初始化老师消息监听器
   */
  public initTeacherMessageListener(): boolean {
    const resp = this.callString(() => window.AndroidBridge?.initTeacherMessageListener?.())
    const result = this.parseJSON<{ success: boolean }>(resp, { success: false })
    return result.success
  }

  /**
   * 清理老师消息监听器
   */
  public cleanupTeacherMessageListener(): void {
    this.callVoid(() => window.AndroidBridge?.cleanupTeacherMessageListener?.())
  }

  /**
   * 监听老师消息事件
   */
  public onTeacherMessage(callback: (message: any) => void): void {
    this.addEventListener('teacherMessage', callback)
    
    // 设置全局回调
    if (typeof window !== 'undefined') {
      ;(window as any).onTeacherMessageReceived = (messageData: any) => {
        this.emit('teacherMessage', messageData)
      }
    }
  }

  /**
   * 监听老师会话状态变化
   */
  public onTeacherSessionChange(callback: (session: any) => void): void {
    this.addEventListener('teacherSessionChange', callback)
  }

  /**
   * 获取调试信息
   */
  public getDebugInfo(): object {
    return {
      isAvailable: this.isAvailable,
      hasAndroidBridge: typeof window !== 'undefined' && typeof window.AndroidBridge !== 'undefined',
      eventListeners: Object.fromEntries(
        Array.from(this.eventListeners.entries()).map(([key, listeners]) => [key, listeners.length])
      ),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    }
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
    console.log('🔍 AndroidBridge加入课堂 - 开始', {
      studentId,
      studentName,
      isGuest,
      hasAndroidBridge: !!(window.AndroidBridge?.joinClassroom)
    })

    try {
      if (window.AndroidBridge?.joinClassroom) {
        const result = window.AndroidBridge.joinClassroom(studentId, studentName, isGuest)
        console.log('🔍 AndroidBridge加入课堂 - 原生方法返回', result)
        return this.parseJSON<boolean>(result, false)
      }
      
      console.log('🔍 AndroidBridge加入课堂 - AndroidBridge不可用')
      return false
    } catch (error) {
      console.error('🔍 AndroidBridge加入课堂 - 发生错误', error)
      return false
    }
  }

  /**
   * 退出课堂
   * @returns 操作结果
   */
  public exitClassroom(): boolean {
    console.log('🔍 AndroidBridge退出课堂 - 开始')

    try {
      if (window.AndroidBridge?.exitClassroom) {
        const result = window.AndroidBridge.exitClassroom()
        console.log('🔍 AndroidBridge退出课堂 - 原生方法返回', result)
        return this.parseJSON<boolean>(result, false)
      }
      
      console.log('🔍 AndroidBridge退出课堂 - AndroidBridge不可用')
      return false
    } catch (error) {
      console.error('🔍 AndroidBridge退出课堂 - 发生错误', error)
      return false
    }
  }

  /**
   * 获取课堂状态
   * @returns 课堂状态信息
   */
  public getClassroomStatus(): import('../types').BridgeClassroomStatus | null {
    console.log('🔍 AndroidBridge获取课堂状态 - 开始')

    try {
      if (window.AndroidBridge?.getClassroomStatus) {
        const result = window.AndroidBridge.getClassroomStatus()
        console.log('🔍 AndroidBridge获取课堂状态 - 原生方法返回', result)
        const parsedResult = this.parseJSON<import('../types').BridgeClassroomStatus>(result, null)
        return parsedResult
      }
      
      console.log('🔍 AndroidBridge获取课堂状态 - AndroidBridge不可用')
      return null
    } catch (error) {
      console.error('🔍 AndroidBridge获取课堂状态 - 发生错误', error)
      return null
    }
  }

  /**
   * 开始屏幕投屏
   * @returns 操作结果
   */
  public startScreenProjection(): boolean {
    console.log('🔍 AndroidBridge开始屏幕投屏 - 开始')

    try {
      if (window.AndroidBridge?.startScreenProjection) {
        const result = window.AndroidBridge.startScreenProjection()
        console.log('🔍 AndroidBridge开始屏幕投屏 - 原生方法返回', result)
        return this.parseJSON<boolean>(result, false)
      }
      
      console.log('🔍 AndroidBridge开始屏幕投屏 - AndroidBridge不可用')
      return false
    } catch (error) {
      console.error('🔍 AndroidBridge开始屏幕投屏 - 发生错误', error)
      return false
    }
  }

  /**
   * 停止屏幕投屏
   * @returns 操作结果
   */
  public stopScreenProjection(): boolean {
    console.log('🔍 AndroidBridge停止屏幕投屏 - 开始')

    try {
      if (window.AndroidBridge?.stopScreenProjection) {
        const result = window.AndroidBridge.stopScreenProjection()
        console.log('🔍 AndroidBridge停止屏幕投屏 - 原生方法返回', result)
        return this.parseJSON<boolean>(result, false)
      }
      
      console.log('🔍 AndroidBridge停止屏幕投屏 - AndroidBridge不可用')
      return false
    } catch (error) {
      console.error('🔍 AndroidBridge停止屏幕投屏 - 发生错误', error)
      return false
    }
  }

  /**
   * 截图
   * @param commandId 命令ID
   * @returns 操作结果
   */
  public takeSnapshot(commandId: string): boolean {
    console.log('🔍 AndroidBridge截图 - 开始', { commandId })

    try {
      if (window.AndroidBridge?.takeSnapshot) {
        const result = window.AndroidBridge.takeSnapshot(commandId)
        console.log('🔍 AndroidBridge截图 - 原生方法返回', result)
        return this.parseJSON<boolean>(result, false)
      }
      
      console.log('🔍 AndroidBridge截图 - AndroidBridge不可用')
      return false
    } catch (error) {
      console.error('🔍 AndroidBridge截图 - 发生错误', error)
      return false
    }
  }

  /**
   * 设置课堂模式
   * @param classMode 课堂模式状态
   * @returns 操作结果
   */
  public setClassroomMode(classMode: boolean): boolean {
    console.log('🔍 AndroidBridge设置课堂模式 - 开始', { classMode })

    try {
      if (window.AndroidBridge?.setClassroomMode) {
        const result = window.AndroidBridge.setClassroomMode(classMode)
        console.log('🔍 AndroidBridge设置课堂模式 - 原生方法返回', result)
        return this.parseJSON<boolean>(result, false)
      }
      
      console.log('🔍 AndroidBridge设置课堂模式 - AndroidBridge不可用')
      return false
    } catch (error) {
      console.error('🔍 AndroidBridge设置课堂模式 - 发生错误', error)
      return false
    }
  }

  // ========== 课堂相关事件监听 ==========

  /**
   * 监听课堂加入事件
   */
  public onClassroomJoined(callback: (status: import('../types').BridgeClassroomStatus) => void): void {
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
  public onClassroomStatusChanged(callback: (status: import('../types').BridgeClassroomStatus) => void): void {
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
  public onSnapshotTaken(callback: (imageData: any) => void): void {
    this.addEventListener('snapshotTaken', callback)
  }

  /**
   * 监听课堂错误事件
   */
  public onClassroomError(callback: (error: string) => void): void {
    this.addEventListener('classroomError', callback)
  }
}

export const androidBridge = AndroidBridge.getInstance()
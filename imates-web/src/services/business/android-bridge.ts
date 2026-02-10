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

    if (!window.onExerciseDeleted) {
      window.onExerciseDeleted = (exerciseId: string) => {
        this.onExerciseDeleted(exerciseId)
      }
    }

    if (!window.onQuestionAdded) {
      window.onQuestionAdded = (questionData: any) => {
        this.onQuestionAdded(questionData)
      }
    }

    if (!window.onProgressSaved) {
      window.onProgressSaved = (progressData: any) => {
        this.onProgressSaved(progressData)
      }
    }

    if (!window.onDataUpdate) {
      window.onDataUpdate = (type: string, data: any) => {
        this.onDataUpdate(type, data)
      }
    }

    // 新增：题目列表更新回调
    if (typeof window !== 'undefined' && !window.onExerciseListUpdated) {
      window.onExerciseListUpdated = (questions: any) => {
        this.onExerciseListUpdated(questions)
      }
    }

    // 新增：加载状态变化回调
    if (typeof window !== 'undefined' && !window.onLoadingStateChanged) {
      window.onLoadingStateChanged = (isLoading: boolean) => {
        this.onLoadingStateChanged(isLoading)
      }
    }

    // 新增：科目变化回调
    if (typeof window !== 'undefined' && !window.onSubjectChanged) {
      window.onSubjectChanged = (subjectName: string) => {
        this.onSubjectChanged(subjectName)
      }
    }

    // 设置图片相关回调
    this.setupImageCallbacks()
    
    // 设置课堂相关回调
    this.setupClassroomCallbacks()

    // 设置语音识别回调
    this.setupSpeechCallbacks()
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
   * 显示Android原生通知
   * @param message 通知内容
   * @param type 通知类型：success, error, warning, info
   */
  public showNotification(message: string, type: string = 'info'): void {
    if (this.isAvailable && window.AndroidBridge && window.AndroidBridge.showNotification) {
      window.AndroidBridge.showNotification(message, type)
    } else {
      // 降级到Toast
      if (this.isAvailable && window.AndroidBridge) {
        window.AndroidBridge.showToast(message)
      }
    }
  }

  /**
   * 控制系统级悬浮 FAB 显示/隐藏
   * 由 Web 侧根据路由与面板状态计算后同步给原生
   */
  public setFloatingFabVisible(visible: boolean): void {
    this.lastFloatingFabVisible = visible
    this.callVoid(() => (window.AndroidBridge as any)?.setFloatingFabVisible?.(visible))
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

  /**
   * 退出当前 Activity
   */
  public exitActivity(): void {
    this.callVoid(() => window.AndroidBridge?.exitActivity?.())
  }

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
    if (event === 'speechResult') {
      console.log('[AndroidBridge] 📡 [语音识别] emit 方法被调用，事件:', event)
      console.log('[AndroidBridge] 📊 [语音识别] 监听器数量:', listeners ? listeners.length : 0)
    }
    if (listeners) {
      listeners.forEach((callback, index) => {
        try {
          if (event === 'speechResult') {
            console.log(`[AndroidBridge] 🔄 [语音识别] 正在调用第 ${index + 1}/${listeners.length} 个监听器`)
          }
          callback(...args)
          if (event === 'speechResult') {
            console.log(`[AndroidBridge] ✓ [语音识别] 第 ${index + 1}/${listeners.length} 个监听器执行完成`)
          }
        } catch (err) {
          if (event === 'speechResult') {
            console.error(`[AndroidBridge] ❌ [语音识别] 第 ${index + 1}/${listeners.length} 个监听器执行出错:`, err)
          }
          // 静默处理
        }
      })
      if (event === 'speechResult') {
        console.log('[AndroidBridge] ✅ [语音识别] 所有监听器执行完成')
      }
    } else {
      if (event === 'speechResult') {
        console.warn('[AndroidBridge] ⚠️ [语音识别] 没有找到 speechResult 事件的监听器')
      }
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


  // ========== MediaProjection 截图相关接口 ==========
  
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

  // ========== 语音识别相关接口 ==========

  /**
   * 开始语音识别（语音转文字）
   */
  public startSpeech(): VoiceRecordingResponse {
    console.log('[AndroidBridge] 🎤 [语音识别] startSpeech() 被调用')
    
    if (!this.isAvailable) {
      console.error('[AndroidBridge] ❌ [语音识别] AndroidBridge 不可用')
      return { 
        success: false, 
        message: 'AndroidBridge 不可用', 
        data: null 
      }
    }
    
    if (!window.AndroidBridge?.startSpeech) {
      console.error('[AndroidBridge] ❌ [语音识别] startSpeech 方法不存在')
      return { 
        success: false, 
        message: '语音识别功能不可用', 
        data: null 
      }
    }
    
    try {
      const resp = this.callString(() => window.AndroidBridge?.startSpeech?.())
      const result = this.parseJSON<VoiceRecordingResponse>(resp, { 
        success: false, 
        message: '语音识别功能不可用', 
        data: null 
      })
      
      if (result.success) {
        console.log('[AndroidBridge] ✓ [语音识别] 启动成功:', result.message)
      } else {
        console.warn('[AndroidBridge] ⚠️ [语音识别] 启动失败:', result.message)
      }
      
      return result
    } catch (error) {
      console.error('[AndroidBridge] ❌ [语音识别] 启动异常:', error)
      return { 
        success: false, 
        message: '语音识别启动异常: ' + (error instanceof Error ? error.message : String(error)), 
        data: null 
      }
    }
  }

  /**
   * 停止语音识别
   */
  public stopSpeech(): VoiceRecordingResponse {
    console.log('[AndroidBridge] 🛑 [语音识别] stopSpeech() 被调用')
    
    if (!this.isAvailable) {
      console.error('[AndroidBridge] ❌ [语音识别] AndroidBridge 不可用')
      return { 
        success: false, 
        message: 'AndroidBridge 不可用', 
        data: null 
      }
    }
    
    if (!window.AndroidBridge?.stopSpeech) {
      console.error('[AndroidBridge] ❌ [语音识别] stopSpeech 方法不存在')
      return { 
        success: false, 
        message: '停止语音识别功能不可用', 
        data: null 
      }
    }
    
    try {
      const resp = this.callString(() => window.AndroidBridge?.stopSpeech?.())
      const result = this.parseJSON<VoiceRecordingResponse>(resp, { 
        success: false, 
        message: '停止语音识别功能不可用', 
        data: null 
      })
      
      if (result.success) {
        console.log('[AndroidBridge] ✓ [语音识别] 停止成功:', result.message)
      } else {
        console.warn('[AndroidBridge] ⚠️ [语音识别] 停止失败:', result.message)
      }
      
      return result
    } catch (error) {
      console.error('[AndroidBridge] ❌ [语音识别] 停止异常:', error)
      return { 
        success: false, 
        message: '停止语音识别异常: ' + (error instanceof Error ? error.message : String(error)), 
        data: null 
      }
    }
  }

  /**
   * 设置语音识别回调
   */
  public setupSpeechCallbacks(): void {
    if (typeof window === 'undefined') return

    // 语音识别结果回调
    if (!window.onSpeechResult) {
      console.log('[AndroidBridge] 📝 [语音识别] 设置 onSpeechResult 回调')
      window.onSpeechResult = (text: string | null, error: string | null) => {
        console.log('[AndroidBridge] 🔔 [语音识别] window.onSpeechResult 回调被触发')
        console.log('[AndroidBridge] 📥 [语音识别] 接收参数 - text:', text ? `"${text}" (长度: ${text.length})` : 'null', 'error:', error || 'null')
        
        if (error) {
          console.error('[AndroidBridge] ❌ [语音识别] 收到识别错误:', error)
        } else if (text) {
          console.log('[AndroidBridge] ✓ [语音识别] 收到识别结果:', `"${text}" (长度: ${text.length})`)
        } else {
          console.warn('[AndroidBridge] ⚠️ [语音识别] 收到空结果')
        }
        
        const eventData = { text, error }
        console.log('[AndroidBridge] 📤 [语音识别] 准备触发 speechResult 事件，数据:', eventData)
        this.emit('speechResult', eventData)
        console.log('[AndroidBridge] ✅ [语音识别] speechResult 事件已触发')
      }
    } else {
      console.log('[AndroidBridge] 📝 [语音识别] onSpeechResult 回调已存在，跳过设置')
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
        // 静默处理
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

  public saveBase64ImageToGallery(base64DataUrl: string, filename: string): ImagePickerResponse {
    const resp = this.callString(() => window.AndroidBridge?.saveBase64ImageToGallery?.(base64DataUrl, filename))
    return this.parseJSON<ImagePickerResponse>(resp, {
      success: false,
      message: '保存图片功能不可用',
      data: null,
    })
  }

  /**
   * 获取拍照后的图片信息
   */
  public getCapturedImageInfo(): ImagePickerResponse & { imageInfo?: ImageData } {
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
          ? this.parseJSON<ImageData>(result.data, {} as ImageData)
          : result.data as ImageData
        return { ...result, imageInfo }
      } catch (error) {
        // 静默处理
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
      window.onSnapshotTaken = (imageData: any) => {
        this.emit('snapshotTaken', imageData)
      }
    }

    // 课堂错误回调
    if (!window.onClassroomError) {
      window.onClassroomError = (error: string) => {
        this.emit('classroomError', error)
      }
    }

    // Android日志回调
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
   * 获取教室树数据
   * @returns 教室树JSON对象，失败时返回 null
   */
  public fetchClassroomTree(): any | null {
    try {
      if (window.AndroidBridge?.fetchClassroomTree) {
        console.log('[Classroom][Bridge][Tree] call')
        const result = window.AndroidBridge.fetchClassroomTree()
        console.log('[Classroom][Bridge][Tree] raw', { len: typeof result === 'string' ? result.length : -1 })

        const response = this.parseJSON<{
          success: boolean
          message: string
          data?: any
        }>(result, {
          success: false,
          message: '解析失败'
        })

        if (response.success && response.data) {
          const data = response.data as any
          if (typeof data === 'string') {
            const trimmed = data.trim()
            if (!trimmed) {
              return null
            }
            // 原生侧可能通过 createResponseWithJsonData 返回 JSON 字符串，这里做二次解析
            const parsed = this.parseJSON<any>(trimmed, null)
            console.log('[Classroom][Bridge][Tree] resp', { type: typeof parsed, keys: parsed && typeof parsed === 'object' ? Object.keys(parsed).length : -1 })
            return parsed
          }

          console.log('[Classroom][Bridge][Tree] resp', { type: typeof data, keys: data && typeof data === 'object' ? Object.keys(data).length : -1 })
          return data
        }

        console.log('[Classroom][Bridge][Tree] resp null', { success: response.success, message: response.message })
        return null
      }

      console.error('[AndroidBridge] fetchClassroomTree: window.AndroidBridge.fetchClassroomTree not found')
      return null
    } catch (error) {
      console.error('[AndroidBridge] fetchClassroomTree error:', error)
      return null
    }
  }

  /**
   * 开始屏幕投屏
   * @returns 操作结果
   */
  public startScreenProjection(): boolean {
    try {
      if (window.AndroidBridge?.startScreenProjection) {
        const result = window.AndroidBridge.startScreenProjection()
        return this.parseJSON<boolean>(result, false)
      }

      console.error('[AndroidBridge] startScreenProjection: method not found on window.AndroidBridge')
      return false
    } catch (error) {
      console.error('[AndroidBridge] startScreenProjection error:', error)
      return false
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

  /**
   * 设置课堂模式
   * @param classMode 课堂模式状态
   * @returns 操作结果
   */
  public setClassroomMode(classMode: boolean): boolean {
    try {
      if (window.AndroidBridge?.setClassroomMode) {
        const result = window.AndroidBridge.setClassroomMode(classMode)
        return this.parseJSON<boolean>(result, false)
      }

      console.error('[AndroidBridge] setClassroomMode: method not found on window.AndroidBridge')
      return false
    } catch (error) {
      console.error('[AndroidBridge] setClassroomMode error:', error)
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
  public onSnapshotTaken(callback: (imageData: any) => void): void {
    this.addEventListener('snapshotTaken', callback)
  }

  /**
   * 监听课堂错误事件
   */
  public onClassroomError(callback: (error: string) => void): void {
    this.addEventListener('classroomError', callback)
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
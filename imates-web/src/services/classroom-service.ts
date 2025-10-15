/**
 * 课堂服务类
 * 处理加入课堂相关的业务逻辑
 * 基于安卓原生加入课堂技术文档实现
 */

import { androidBridge } from './android-bridge'
import type { 
  BridgeClassroomStatus
} from '../types'

export interface ClassroomState {
  isInClass: boolean
  studentId: string
  studentName: string
  localIp: string
  tsStreamPort: number
  status: 'ready' | 'streaming'
  isGuest: boolean
}

export interface ClassroomServiceConfig {
  multicastAddress: string
  controlMulticastPort: number
  teacherPadControlPort: number
  studentControlPort: number
  tsStreamPortBase: number
  snapshotTcpPort: number
}

export class ClassroomService {
  private static instance: ClassroomService
  private state: ClassroomState
  private config: ClassroomServiceConfig
  private eventListeners: Map<string, Function[]> = new Map()

  private constructor() {
    this.state = {
      isInClass: false,
      studentId: '',
      studentName: '',
      localIp: '',
      tsStreamPort: 0,
      status: 'ready',
      isGuest: false
    }

    // 默认配置，基于技术文档
    this.config = {
      multicastAddress: '239.255.100.1',
      controlMulticastPort: 5000,
      teacherPadControlPort: 5986,
      studentControlPort: 5987,
      tsStreamPortBase: 10000,
      snapshotTcpPort: 5002
    }

    this.setupEventListeners()
  }

  public static getInstance(): ClassroomService {
    if (!ClassroomService.instance) {
      ClassroomService.instance = new ClassroomService()
    }
    return ClassroomService.instance
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听课堂加入事件
    androidBridge.onClassroomJoined((status: BridgeClassroomStatus) => {
      this.updateState(status)
      this.emit('classroomJoined', status)
    })

    // 监听课堂退出事件
    androidBridge.onClassroomExited(() => {
      this.state.isInClass = false
      this.state.status = 'ready'
      this.emit('classroomExited')
    })

    // 监听课堂状态变化事件
    androidBridge.onClassroomStatusChanged((status: BridgeClassroomStatus) => {
      this.updateState(status)
      this.emit('statusChanged', status)
    })

    // 监听屏幕投屏开始事件
    androidBridge.onScreenProjectionStarted(() => {
      this.state.status = 'streaming'
      this.emit('projectionStarted')
    })

    // 监听屏幕投屏停止事件
    androidBridge.onScreenProjectionStopped(() => {
      this.state.status = 'ready'
      this.emit('projectionStopped')
    })

    // 监听截图完成事件
    androidBridge.onSnapshotTaken((imageData: any) => {
      this.emit('snapshotTaken', imageData)
    })

    // 监听课堂错误事件
    androidBridge.onClassroomError((error: string) => {
      this.emit('error', error)
    })
  }

  /**
   * 更新课堂状态
   */
  private updateState(status: BridgeClassroomStatus): void {
    this.state.isInClass = status.isInClass
    this.state.studentId = status.studentId
    this.state.studentName = status.studentName
    this.state.localIp = status.localIp
    this.state.tsStreamPort = status.tsStreamPort
    this.state.status = status.status
  }

  /**
   * 加入课堂
   * @param studentId 学生ID
   * @param studentName 学生姓名
   * @param isGuest 是否为游客模式
   * @returns Promise<boolean> 操作结果
   */
  public async joinClassroom(
    studentId: string, 
    studentName: string, 
    isGuest: boolean = false
  ): Promise<boolean> {
    console.log('🔍 ClassroomService加入课堂 - 开始', {
      studentId,
      studentName,
      isGuest
    })

    try {
      // 检查是否已在课堂中
      if (this.state.isInClass) {
        console.log('🔍 ClassroomService加入课堂 - 已在课堂中')
        return false
      }

      // 更新本地状态
      this.state.studentId = studentId
      this.state.studentName = studentName
      this.state.isGuest = isGuest

      // 调用Android Bridge
      const result = androidBridge.joinClassroom(studentId, studentName, isGuest)
      
      if (result) {
        console.log('🔍 ClassroomService加入课堂 - 成功')
        this.state.isInClass = true
        this.state.status = 'ready'
        this.emit('joinRequested', { studentId, studentName, isGuest })
        return true
      } else {
        console.log('🔍 ClassroomService加入课堂 - 失败')
        return false
      }
    } catch (error) {
      console.error('🔍 ClassroomService加入课堂 - 发生错误', error)
      this.emit('error', `加入课堂失败: ${error}`)
      return false
    }
  }

  /**
   * 退出课堂
   * @returns Promise<boolean> 操作结果
   */
  public async exitClassroom(): Promise<boolean> {
    console.log('🔍 ClassroomService退出课堂 - 开始')

    try {
      // 检查是否在课堂中
      if (!this.state.isInClass) {
        console.log('🔍 ClassroomService退出课堂 - 不在课堂中')
        return false
      }

      // 调用Android Bridge
      const result = androidBridge.exitClassroom()
      
      if (result) {
        console.log('🔍 ClassroomService退出课堂 - 成功')
        this.state.isInClass = false
        this.state.status = 'ready'
        this.emit('exitRequested')
        return true
      } else {
        console.log('🔍 ClassroomService退出课堂 - 失败')
        return false
      }
    } catch (error) {
      console.error('🔍 ClassroomService退出课堂 - 发生错误', error)
      this.emit('error', `退出课堂失败: ${error}`)
      return false
    }
  }

  /**
   * 获取当前课堂状态
   * @returns ClassroomState 当前状态
   */
  public getCurrentState(): ClassroomState {
    return { ...this.state }
  }

  /**
   * 检查是否在课堂中
   * @returns boolean 是否在课堂中
   */
  public isInClassroom(): boolean {
    return this.state.isInClass
  }

  /**
   * 检查是否为游客模式
   * @returns boolean 是否为游客模式
   */
  public isGuestMode(): boolean {
    return this.state.isGuest
  }

  /**
   * 检查是否正在投屏
   * @returns boolean 是否正在投屏
   */
  public isStreaming(): boolean {
    return this.state.status === 'streaming'
  }

  /**
   * 获取学生信息
   * @returns {studentId: string, studentName: string} 学生信息
   */
  public getStudentInfo(): { studentId: string, studentName: string } {
    return {
      studentId: this.state.studentId,
      studentName: this.state.studentName
    }
  }

  /**
   * 获取网络信息
   * @returns {localIp: string, tsStreamPort: number} 网络信息
   */
  public getNetworkInfo(): { localIp: string, tsStreamPort: number } {
    return {
      localIp: this.state.localIp,
      tsStreamPort: this.state.tsStreamPort
    }
  }

  /**
   * 刷新课堂状态
   * @returns Promise<BridgeClassroomStatus | null> 最新状态
   */
  public async refreshStatus(): Promise<BridgeClassroomStatus | null> {
    console.log('🔍 ClassroomService刷新状态 - 开始')

    try {
      const status = androidBridge.getClassroomStatus()
      if (status) {
        this.updateState(status)
        console.log('🔍 ClassroomService刷新状态 - 成功', status)
        return status
      } else {
        console.log('🔍 ClassroomService刷新状态 - 获取状态失败')
        return null
      }
    } catch (error) {
      console.error('🔍 ClassroomService刷新状态 - 发生错误', error)
      return null
    }
  }

  /**
   * 设置课堂模式
   * @param classMode 课堂模式状态
   * @returns Promise<boolean> 操作结果
   */
  public async setClassroomMode(classMode: boolean): Promise<boolean> {
    console.log('🔍 ClassroomService设置课堂模式 - 开始', { classMode })

    try {
      const result = androidBridge.setClassroomMode(classMode)
      
      if (result) {
        console.log('🔍 ClassroomService设置课堂模式 - 成功')
        this.state.isInClass = classMode
        this.emit('modeChanged', classMode)
        return true
      } else {
        console.log('🔍 ClassroomService设置课堂模式 - 失败')
        return false
      }
    } catch (error) {
      console.error('🔍 ClassroomService设置课堂模式 - 发生错误', error)
      this.emit('error', `设置课堂模式失败: ${error}`)
      return false
    }
  }

  /**
   * 开始屏幕投屏
   * @returns Promise<boolean> 操作结果
   */
  public async startScreenProjection(): Promise<boolean> {
    console.log('🔍 ClassroomService开始屏幕投屏 - 开始')

    try {
      const result = androidBridge.startScreenProjection()
      
      if (result) {
        console.log('🔍 ClassroomService开始屏幕投屏 - 成功')
        this.state.status = 'streaming'
        this.emit('projectionStarted')
        return true
      } else {
        console.log('🔍 ClassroomService开始屏幕投屏 - 失败')
        return false
      }
    } catch (error) {
      console.error('🔍 ClassroomService开始屏幕投屏 - 发生错误', error)
      this.emit('error', `开始屏幕投屏失败: ${error}`)
      return false
    }
  }

  /**
   * 停止屏幕投屏
   * @returns Promise<boolean> 操作结果
   */
  public async stopScreenProjection(): Promise<boolean> {
    console.log('🔍 ClassroomService停止屏幕投屏 - 开始')

    try {
      const result = androidBridge.stopScreenProjection()
      
      if (result) {
        console.log('🔍 ClassroomService停止屏幕投屏 - 成功')
        this.state.status = 'ready'
        this.emit('projectionStopped')
        return true
      } else {
        console.log('🔍 ClassroomService停止屏幕投屏 - 失败')
        return false
      }
    } catch (error) {
      console.error('🔍 ClassroomService停止屏幕投屏 - 发生错误', error)
      this.emit('error', `停止屏幕投屏失败: ${error}`)
      return false
    }
  }

  /**
   * 截图
   * @param commandId 命令ID
   * @returns Promise<boolean> 操作结果
   */
  public async takeSnapshot(commandId: string): Promise<boolean> {
    console.log('🔍 ClassroomService截图 - 开始', { commandId })

    try {
      const result = androidBridge.takeSnapshot(commandId)
      
      if (result) {
        console.log('🔍 ClassroomService截图 - 成功')
        this.emit('snapshotRequested', commandId)
        return true
      } else {
        console.log('🔍 ClassroomService截图 - 失败')
        return false
      }
    } catch (error) {
      console.error('🔍 ClassroomService截图 - 发生错误', error)
      this.emit('error', `截图失败: ${error}`)
      return false
    }
  }

  /**
   * 获取配置信息
   * @returns ClassroomServiceConfig 配置信息
   */
  public getConfig(): ClassroomServiceConfig {
    return { ...this.config }
  }

  /**
   * 更新配置信息
   * @param config 新的配置信息
   */
  public updateConfig(config: Partial<ClassroomServiceConfig>): void {
    this.config = { ...this.config, ...config }
    console.log('🔍 ClassroomService配置已更新', this.config)
  }

  // ========== 事件管理 ==========

  /**
   * 添加事件监听器
   * @param event 事件名称
   * @param callback 回调函数
   */
  public addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  /**
   * 移除事件监听器
   * @param event 事件名称
   * @param callback 回调函数
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
   * @param event 事件名称
   * @param data 事件数据
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`事件回调执行失败 [${event}]:`, error)
        }
      })
    }
  }

  /**
   * 获取调试信息
   * @returns object 调试信息
   */
  public getDebugInfo(): object {
    return {
      state: this.state,
      config: this.config,
      eventListeners: Object.fromEntries(
        Array.from(this.eventListeners.entries()).map(([key, listeners]) => [key, listeners.length])
      ),
      androidBridgeAvailable: androidBridge.isAndroidBridgeAvailable()
    }
  }
}

// 导出单例实例
export const classroomService = ClassroomService.getInstance()

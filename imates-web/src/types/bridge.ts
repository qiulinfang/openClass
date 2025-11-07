/**
 * Android Bridge相关类型定义
 * 包含所有原生桥接相关类型，按功能分组
 */

import type { UserInfo } from './user'
import type { FindExerciseConfig } from './exercise'
import type { JSONString } from './base'

// ========== 基础数据类型 ==========

/** Android Bridge 用户信息接口 */
export type BridgeUserInfo = UserInfo

/** Android Bridge 题目项接口 */
export interface BridgeExerciseItem {
  id: string
  title?: string
  content?: string
  difficulty?: number
  type?: string
  subject?: string
  createTime?: number
}

/** Android Bridge 聊天消息数据接口 */
export interface BridgeChatMessageData {
  content: string
  type: 'user' | 'ai' | 'teacher'
  exerciseId?: string
  chatRole?: string
  requestId?: string
}

/** Android Bridge 进度数据接口 */
export interface BridgeProgressData {
  currentQuestionIndex: number
  chatResponseTimes: number
  timestamp: number
}

/** Android Bridge 课堂状态接口 */
export interface BridgeClassroomStatus {
  isInClass: boolean
  studentId: string
  studentName: string
  localIp: string
  tsStreamPort: number
  status: 'ready' | 'streaming'
}

/** Android Bridge 加入课堂请求接口 */
export interface BridgeJoinClassroomRequest {
  studentId: string
  studentName: string
  isGuest: boolean
}

/** Android Bridge 课堂命令接口 */
export interface BridgeClassroomCommand {
  type: 'projection_pad' | 'snapshot_pad' | 'projection_pc'
  teacherIp?: string
  studentIds?: string[]
  commandId?: string
}

// ========== Android Bridge 接口声明 ==========

declare global {
  interface Window {
    // Android 配置对象
    AndroidConfig?: FindExerciseConfig
    
    AndroidBridge?: {
      // ========== 基础功能 ==========
      showToast(message: string): void
      showNotification(message: string, type: string): void
      getUserToken(): string
      getUserInfo(): JSONString
      syncUserInfo(userId: string, token: string, password: string): JSONString
      exitActivity(): void

      // ========== 题目相关功能 ==========
      getExerciseList(subject: string): JSONString
      deleteExercise(exerciseId: string, subject: string): void
      addQuestionToList(questionData: JSONString, subject: string): void
      findSimilarQuestions(questionData: JSONString, subject: string): JSONString
      
      // ========== 习题查找功能 ==========
      startExerciseSolve(): void
      finishActivity(): void

      // ========== 聊天功能 ==========
      sendChatMessage(messageData: JSONString): JSONString
      sendMessageToTeacher(messageData: JSONString): JSONString

      // ========== 进度保存功能 ==========
      saveExerciseProgress(progressData: JSONString): void

      // ========== 拍照搜题功能 ==========
      startPhotoSearch(subject: string): void

      // ========== 语音相关功能 ==========
      startVoiceRecording(): string
      stopVoiceRecording(): string
      cancelVoiceRecording(): string
      playVoiceMessage(filePath: string): string
      stopVoicePlayback(): string
      sendVoiceMessage(filePath: string, duration: string, chatId: string): string
      getVoiceRecordingStatus(): string

      // ========== 图片相关功能 ==========
      selectImageFromGallery(): string
      captureImageFromCamera(): string
      showImagePickerDialog(): string
      sendImageMessage(filePath: string, chatId: string): string
      compressImage(filePath: string, quality: number): string
      deleteImageFile(filePath: string): string
      loadImageFileToBase64(filePath: string): string
      checkImageResult(): string

      // ========== 相机流相关功能 ==========
      startCameraStream(width: number, height: number, frameRate: number, bitrate: number): string
      stopCameraStream(): string
      isCameraStreamRunning(): string

      // ========== 老师对话功能 ==========
      createTeacherChatSession(aiSessionId: string, aiSessionName: string, subject: string): string
      sendTextMessageToTeacher(content: string, sessionId: string, subject: string): string
      sendVoiceMessageToTeacher(voicePath: string, duration: string, sessionId: string, subject: string): string
      sendPictureToTeacher(imagePath: string, sessionId: string, subject: string): string
      forwardAiChatToTeacher(selectedMessagesData: string, teacherSessionId: string): string
      getTeacherChatHistory(sessionId: string): string
      checkTeacherSessionExists(sessionId: string): string
      getCurrentSessionMessageCount(sessionId: string): string
      initTeacherMessageListener(): string
      cleanupTeacherMessageListener(): string
      isMessagingManagerInitialized(): boolean
      isMessagingManagerConnecting(): boolean

      // ========== 加入课堂功能 ==========
      joinClassroom(studentId: string, studentName: string, isGuest: boolean): string
      exitClassroom(): string
      getClassroomStatus(): string
      startScreenProjection(): string
      stopScreenProjection(): string
      takeSnapshot(commandId: string): string
      setClassroomMode(classMode: boolean): string
    }

    // ========== Android 事件回调 ==========
    onAndroidReady?(): void
    onExerciseDeleted?(exerciseId: string): void
    onQuestionAdded?(questionData: unknown): void
    onProgressSaved?(progressData: unknown): void
    onDataUpdate?(type: string, data: unknown): void
    onExerciseListUpdated?(questions: unknown): void
    onLoadingStateChanged?(isLoading: boolean): void
    onSubjectChanged?(subjectName: string): void
    onVoiceRecognitionResult?(text: string): void
    onVoicePlaybackCompleted?(filePath: string): void
    onImageSelected?(imageInfo: unknown): void
    onImageCaptured?(imageInfo: unknown): void
    onTeacherMessage?(message: unknown): void
    onTeacherMessageReceived?(messageData: unknown): void
    onStreamResponse?(requestId: string, chunk: string, isComplete: boolean): void
    onChatResponse?(requestId: string, response: unknown): void
    
    // ========== 课堂相关事件回调 ==========
    onClassroomJoined?(status: unknown): void
    onClassroomExited?(): void
    onClassroomStatusChanged?(status: unknown): void
    onScreenProjectionStarted?(): void
    onScreenProjectionStopped?(): void
    onSnapshotTaken?(imageData: unknown): void
    onClassroomError?(error: string): void
    
    // ========== Android日志回调 ==========
    onAndroidLog?(level: string, tag: string, message: string): void
  }
}

export {}
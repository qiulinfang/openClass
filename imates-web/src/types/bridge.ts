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
      checkImageResult(): string

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
  }
}

export {}
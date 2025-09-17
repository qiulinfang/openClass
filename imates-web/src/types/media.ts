/**
 * 媒体相关类型定义
 * 包含语音、图片、压缩、录制等所有媒体相关类型
 */

import type { ChatBubble } from './chat'

// ========== 语音相关类型 ==========

/** 语音数据接口 */
export interface VoiceData {
  filePath: string
  duration: number
  fileSize: number
}

/** 语音录制状态接口 */
export interface VoiceRecordingStatus {
  isRecording: boolean
  isPlaying: boolean
  currentFile: string
}

// ========== 图片相关类型 ==========

/** 图片数据接口 */
export interface ImageData {
  filePath: string
  width: number
  height: number
  fileSize: number
}

/** 图片压缩结果接口 */
export interface ImageCompressionResult {
  originalPath: string
  compressedPath: string
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

// ========== 聊天记录相关类型 ==========

/** 聊天记录数据接口 */
export interface ChatRecordData {
  messages: ChatBubble[]
  additionalMessage?: string
}

// ========== 媒体相关API响应 ==========

/** 语音录制响应接口 */
export interface VoiceRecordingResponse {
  success: boolean
  message: string
  data: string | null
}

/** 图片选择响应接口 */
export interface ImagePickerResponse {
  success: boolean
  message: string
  data: string | null
}
/**
 * UI相关类型定义
 * 包含所有Vue组件Props、UI状态、界面交互等类型
 */

import type { ExerciseItem } from './exercise'

// ========== 通用UI组件类型 ==========

/** 内容块接口 */
export interface ContentBlock {
  id: string
  type: 'text' | 'formula'
  content: string
  renderedContent?: string
  isEditing?: boolean
  isSelected?: boolean
  mathfield?: unknown
}

// ========== 编辑器相关组件 ==========

/** TiptapEditor Props接口 */
export interface TiptapEditorProps {
  modelValue?: string
  placeholder?: string
  editable?: boolean
  showDebugControls?: boolean
}

// ========== 题目列表相关组件 ==========

/** AnswerView Props接口 */
export interface AnswerViewProps {
  answer: string
  analysis: string
}

// ========== 媒体相关组件 ==========

/** ImagePicker Props接口 */
export interface ImagePickerProps {
  modelValue: boolean
}

/** VoiceRecorder Props接口 */
export interface VoiceRecorderProps {
  isRecording: boolean
  showCancelHint?: boolean
}

/** VoiceMessage Props接口 */
export interface VoiceMessageProps {
  filePath: string
  duration: number
  isUser?: boolean
}

/** ImageMessage Props接口 */
export interface ImageMessageProps {
  base64DataUrl: string  // base64数据URL，必需用于UI显示
  width?: number
  height?: number
  fileSize?: number
  isUser?: boolean
  maxWidth?: number
  maxHeight?: number
  showInfo?: boolean
}
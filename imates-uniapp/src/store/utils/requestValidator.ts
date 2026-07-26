/**
 * AI 聊天请求参数校验工具
 * 移植自 imates-web
 */

import type { AiChatMessageRequest } from '@/services/api/aiChatApi'
import { getApiPaths } from '@/config/env-config'

function validateCommonFields(
  message: AiChatMessageRequest,
  context: string
): void {
  const commonFields: (keyof AiChatMessageRequest)[] = [
    'sessionId',
    'newValue',
    'coversation',
    'name',
    'reason',
    'isWebSearch',
    'role',
    'dstUrl',
  ]

  const missingFields: string[] = []

  for (const field of commonFields) {
    const val = message[field]
    if (val === undefined || val === null || val === '') {
      missingFields.push(String(field))
    }
  }

  if (missingFields.length > 0) {
    throw new Error(
      `[${context}] 缺失必填字段: ${missingFields.join(', ')}. 请检查参数对象是否完整。`
    )
  }
}

export function validateExerciseChatRequest(
  message: AiChatMessageRequest,
  questionTitle: string
): void {
  const context = `题目对话 [${questionTitle.substring(0, 20)}...]`
  
  validateCommonFields(message, context)
  
  const screenshotUrl = getApiPaths().xueban.ai.previewPictureQA
  const isScreenshotApi = message.dstUrl === screenshotUrl
  
  const exerciseFields: (keyof AiChatMessageRequest)[] = [
    'bmNo',
    'subject',
    'explanation',
  ]
  
  if (!isScreenshotApi) {
    exerciseFields.push('question', 'answer')
  }
  
  const missingFields: string[] = []
  for (const field of exerciseFields) {
    const val = message[field]
    if (val === undefined || val === null || val === '') {
      missingFields.push(String(field))
    }
  }
  
  if (missingFields.length > 0) {
    throw new Error(`[${context}] 缺失题目场景必填字段: ${missingFields.join(', ')}`)
  }
  
  const isValidBmNo = /^\d+$/.test(message.bmNo) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(message.bmNo)
  if (!isValidBmNo) {
    throw new Error(`[${context}] bmNo 必须是数字字符串或 UUID 格式，当前值: ${message.bmNo}`)
  }
  
  if (message.subject !== 'MATH' && message.subject !== 'BIOLOGY') {
    throw new Error(`[${context}] subject 必须是 MATH 或 BIOLOGY，当前值: ${message.subject}`)
  }
  
  if (!isScreenshotApi && message.question && !message.question.trim()) {
    throw new Error(`[${context}] 题目内容不能为空`)
  }
  
  if (isScreenshotApi && (!message.imageList || message.imageList.length === 0)) {
    throw new Error(`[${context}] 截图场景必须包含图片数据`)
  }
}

export function validateGeneralChatRequest(
  message: AiChatMessageRequest,
  sessionName: string
): void {
  const context = `通用对话 [${sessionName}]`
  
  validateCommonFields(message, context)
  
  const screenshotUrl = getApiPaths().xueban.ai.previewPictureQA
  const isScreenshotApi = message.dstUrl === screenshotUrl
  
  if (!message.bmNo) {
    throw new Error(`[${context}] bmNo 不能为空`)
  }
  
  if (message.subject === undefined || message.subject === null) {
    throw new Error(`[${context}] subject 字段缺失`)
  }
  
  if (message.explanation === undefined || message.explanation === null) {
    throw new Error(`[${context}] explanation 字段缺失`)
  }
  
  if (isScreenshotApi && (!message.imageList || message.imageList.length === 0)) {
    throw new Error(`[${context}] 截图场景必须包含图片数据`)
  }
}

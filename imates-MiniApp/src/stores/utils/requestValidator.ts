/**
 * AI 聊天请求参数校验工具
 */

import type { AiChatMessageRequest } from '../../types'

/**
 * 通用字段校验
 */
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
      missingFields.push(field)
    }
  }

  if (missingFields.length > 0) {
    throw new Error(
      `[${context}] 缺失必填字段: ${missingFields.join(', ')}. 请检查参数对象是否完整。`
    )
  }
}

/**
 * 校验 AI 题目对话请求
 */
export function validateExerciseChatRequest(
  message: AiChatMessageRequest,
  questionTitle: string
): void {
  const context = `题目对话 [${questionTitle.substring(0, 20)}...]`
  
  validateCommonFields(message, context)
  
  // 简化的校验逻辑
  const exerciseFields: (keyof AiChatMessageRequest)[] = [
    'bmNo',
    'subject',
    'explanation',
  ]
  
  const missingFields: string[] = []
  for (const field of exerciseFields) {
    const val = message[field]
    if (val === undefined || val === null || val === '') {
      missingFields.push(field)
    }
  }
  
  if (missingFields.length > 0) {
    throw new Error(`[${context}] 缺失题目场景必填字段: ${missingFields.join(', ')}`)
  }
}

/**
 * 校验 AI 教材对话请求
 */
export function validateTextbookChatRequest(
  message: AiChatMessageRequest,
  resourceId: string
): void {
  const context = `教材对话 [资源ID: ${resourceId}]`
  validateCommonFields(message, context)
  
  if (!message.bmNo) {
    throw new Error(`[${context}] bmNo 不能为空`)
  }
}

/**
 * 校验 AI 通用对话请求
 */
export function validateGeneralChatRequest(
  message: AiChatMessageRequest,
  sessionName: string
): void {
  const context = `通用对话 [${sessionName}]`
  validateCommonFields(message, context)
  
  if (!message.bmNo) {
    throw new Error(`[${context}] bmNo 不能为空`)
  }
}

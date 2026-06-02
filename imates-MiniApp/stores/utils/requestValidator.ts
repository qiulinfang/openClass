/**
 * AI 聊天请求参数校验工具
 * 用于在 Store 层构建请求后进行参数完整性校验
 */

import type { AiChatMessageRequest } from '@/types'
import { getApiPaths } from '@/config/env-config'

/**
 * 通用字段校验（所有场景都需要的基础字段）
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
 * 校验 AI 题目对话请求（最严格的校验）
 */
export function validateExerciseChatRequest(
  message: AiChatMessageRequest,
  questionTitle: string
): void {
  const context = `题目对话 [${questionTitle.substring(0, 20)}...]`
  
  // 1. 校验通用字段
  validateCommonFields(message, context)
  
  // 2. 判断是否是截图场景
  const screenshotUrl = getApiPaths().xueban.ai.previewPictureQA
  const isScreenshotApi = message.dstUrl === screenshotUrl
  
  // 3. 校验题目场景特有的必填字段
  const exerciseFields: (keyof AiChatMessageRequest)[] = [
    'bmNo',
    'subject',
    'explanation',
  ]
  
  // 如果不是截图场景，question 和 answer 也是必填的
  if (!isScreenshotApi) {
    exerciseFields.push('question', 'answer')
  }
  
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
  
  // 4. 题目场景特定格式校验
  // bmNo 支持纯数字字符串或 UUID 格式（如 01b9a674-bc25-4804-b3cc-5faddb2ca3d1）
  const isValidBmNo = /^\d+$/.test(message.bmNo) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(message.bmNo)
  if (!isValidBmNo) {
    throw new Error(`[${context}] bmNo 必须是数字字符串或 UUID 格式，当前值: ${message.bmNo}`)
  }
  
  // subject 必须是 MATH 或 BIOLOGY
  if (message.subject !== 'MATH' && message.subject !== 'BIOLOGY') {
    throw new Error(`[${context}] subject 必须是 MATH 或 BIOLOGY，当前值: ${message.subject}`)
  }
  
  // 如果不是截图场景，question 不能为空
  if (!isScreenshotApi && message.question && !message.question.trim()) {
    throw new Error(`[${context}] 题目内容不能为空`)
  }
  
  // 如果是截图场景，必须有 imageList
  if (isScreenshotApi && (!message.imageList || message.imageList.length === 0)) {
    throw new Error(`[${context}] 截图场景必须包含图片数据`)
  }
}

export function validateKnowledgeTopicAndAck2Request(body: unknown): void {
  const req = body as any
  const bmNoList = req?.bmNoList

  if (bmNoList === undefined || bmNoList === null || typeof bmNoList !== 'string' || !bmNoList.trim()) {
    throw new Error('[knowledgeTopicAndAck2] bmNoList 不能为空')
  }

  const items = bmNoList
    .split(',')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0)

  if (items.length === 0) {
    throw new Error('[knowledgeTopicAndAck2] bmNoList 不能为空')
  }

  const invalid = items.find((s: string) => !/^\d+$/.test(s))
  if (invalid) {
    throw new Error(`[knowledgeTopicAndAck2] bmNoList 包含非法题号: ${invalid}`)
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
  
  // 1. 校验通用字段
  validateCommonFields(message, context)
  
  // 2. 判断是否是截图场景
  const screenshotUrl = getApiPaths().xueban.ai.previewPictureQA
  const isScreenshotApi = message.dstUrl === screenshotUrl
  
  // 3. 教材场景特有字段（相对宽松）
  // bmNo 在教材场景下通常是 sessionId，不需要是纯数字
  if (!message.bmNo) {
    throw new Error(`[${context}] bmNo 不能为空`)
  }
  
  // subject 字段必须存在
  if (!message.subject) {
    throw new Error(`[${context}] subject 不能为空`)
  }
  
  // explanation 必须存在（可以是空字符串）
  if (message.explanation === undefined || message.explanation === null) {
    throw new Error(`[${context}] explanation 字段缺失`)
  }
  
  // 4. 如果是截图场景，必须有 imageList
  if (isScreenshotApi && (!message.imageList || message.imageList.length === 0)) {
    throw new Error(`[${context}] 截图场景必须包含图片数据`)
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
  
  // 1. 校验通用字段
  validateCommonFields(message, context)
  
  // 2. 判断是否是截图场景
  const screenshotUrl = getApiPaths().xueban.ai.previewPictureQA
  const isScreenshotApi = message.dstUrl === screenshotUrl
  
  // 3. 通用对话场景特有字段
  // bmNo 通常是 sessionId
  if (!message.bmNo) {
    throw new Error(`[${context}] bmNo 不能为空`)
  }
  
  // subject 字段必须存在（可以是空字符串）
  if (message.subject === undefined || message.subject === null) {
    throw new Error(`[${context}] subject 字段缺失`)
  }
  
  // explanation 必须存在（可以是空字符串）
  if (message.explanation === undefined || message.explanation === null) {
    throw new Error(`[${context}] explanation 字段缺失`)
  }
  
  // 4. 如果是截图场景，必须有 imageList
  if (isScreenshotApi && (!message.imageList || message.imageList.length === 0)) {
    throw new Error(`[${context}] 截图场景必须包含图片数据`)
  }
}


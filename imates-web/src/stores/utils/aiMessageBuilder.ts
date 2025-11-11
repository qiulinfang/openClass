/**
 * AI消息构建工具
 * 
 * 职责：将聊天参数转换为API接口需要的格式
 * 适配 exerciseStore 中的 buildAiMessage 逻辑
 */

import type { AiChatMessageRequest, ExerciseItem, UserInfo } from '../../types'

/**
 * 简化的图片数据接口
 */
export interface ChatImageData {
  base64DataUrl: string
}

/**
 * 构建AI消息请求（AI题目场景）
 * 基于 exerciseStore 的 buildAiMessage 逻辑
 */
export function buildAiExerciseMessage(
  content: string,
  currentQuestion: ExerciseItem,
  userInfo: UserInfo | null,
  subject: 'MATH' | 'BIOLOGY',
  enableWebSearch: boolean,
  chatRole: string = 'mate',
  imageData?: ChatImageData
): AiChatMessageRequest {
  // 第1步：判断是否为图片消息
  const isImageMessage = imageData && imageData.base64DataUrl
  
  // 第2步：根据科目确定 dstUrl
  const dstUrl = subject === 'BIOLOGY' ? '/permission/chat' : '/permission/chatMath'
  
  if (isImageMessage) {
    // 图片消息请求
    const contextPrompt = currentQuestion.title || '题目截图'
    const sessionId = `exercise-session-${Date.now()}`
    
    return {
      sessionId,
      newValue: '1',
      coversation: content,  // 用户输入的问题文本
      question: imageData!.base64DataUrl || '',  // 图片Base64
      answer: contextPrompt,  // 上下文提示
      name: userInfo?.userName || 'User',
      reason: 'start',
      bmNo: currentQuestion.bmNo || currentQuestion.id,
      isWebSearch: enableWebSearch ? '1' : '0',
      chatRole: chatRole,
      dstUrl: dstUrl  // ⭐ 明确指定接口路径
    }
  }
  
  // 第3步：文本消息请求（包含完整题目信息）
  const sessionId = currentQuestion.id || `exercise-session-${Date.now()}`
  const question = currentQuestion.question || currentQuestion.title || '题目内容'
  const bmNo = currentQuestion.bmNo || currentQuestion.id || sessionId
  
  return {
    sessionId,
    newValue: '1',
    coversation: content,
    question: question,
    answer: currentQuestion.answer || '',
    name: userInfo?.userName || 'User',
    reason: 'start',
    bmNo: bmNo,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole: chatRole,
    dstUrl: dstUrl  // ⭐ 明确指定接口路径
  }
}

/**
 * 构建AI消息请求（AI通用场景）
 * 通用场景不需要题目信息
 */
export function buildAiGeneralMessage(
  content: string,
  userInfo: UserInfo | null,
  enableWebSearch: boolean,
  chatRole: string = 'mate'
): AiChatMessageRequest {
  const sessionId = `general-session-${Date.now()}`
  
  return {
    sessionId,
    newValue: '1',
    coversation: content,
    question: '',  // 通用场景无题目
    answer: '',
    name: userInfo?.userName || 'User',
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole: chatRole,
    dstUrl: '/permission/chats'  // 通用AI对话接口
  }
}

/**
 * 构建AI消息请求（AI教材场景）
 */
export function buildAiTextbookMessage(
  content: string,
  userInfo: UserInfo | null,
  enableWebSearch: boolean,
  chatRole: string = 'mate',
  imageData?: ChatImageData,
  subject: 'MATH' | 'BIOLOGY' = 'MATH'  // 新增科目参数，默认数学
): AiChatMessageRequest {
  // 第1步：判断是否为图片消息
  const isImageMessage = imageData && imageData.base64DataUrl
  
  if (isImageMessage) {
    // 教材截图问答
    const sessionId = `textbook-session-${Date.now()}`
    // 兼容后端仅接受 data:image/jpg;base64 的情况（仅此接口做前缀替换）
    const questionDataUrl =
      (imageData!.base64DataUrl || '').startsWith('data:image/jpeg;')
        ? (imageData!.base64DataUrl || '').replace('data:image/jpeg;', 'data:image/jpg;')
        : (imageData!.base64DataUrl || '')
    
    return {
      sessionId,
      newValue: '1',
      coversation: content,
      question: questionDataUrl,
      answer: '教材内容截图',
      name: userInfo?.userName || 'User',
      reason: 'start',
      bmNo: sessionId,
      isWebSearch: enableWebSearch ? '1' : '0',
      chatRole: chatRole,
      dstUrl: '/permission/previewPictureQA'  // 截图问答专用接口
    }
  }
  
  // 第2步：文本消息请求 - 根据科目确定 dstUrl
  const sessionId = `textbook-session-${Date.now()}`
  const dstUrl = subject === 'BIOLOGY' ? '/permission/chat' : '/permission/chatMath'
  
  return {
    sessionId,
    newValue: '1',
    coversation: content,
    question: '教材内容',
    answer: '',
    name: userInfo?.userName || 'User',
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole: chatRole,
    dstUrl: dstUrl  // ⭐ 明确指定接口路径（文本消息场景）
  }
}

/**
 * 构建教师消息请求（教师题目场景）
 * 基于 buildAiExerciseMessage 逻辑，但使用 chatRole='teacher'
 */
export function buildTeacherExerciseMessage(
  content: string,
  currentQuestion: ExerciseItem,
  userInfo: UserInfo | null,
  subject: 'MATH' | 'BIOLOGY',
  enableWebSearch: boolean,
  chatRole: string = 'teacher',
  imageData?: ChatImageData
): AiChatMessageRequest {
  // 第1步：判断是否为图片消息
  const isImageMessage = imageData && imageData.base64DataUrl
  
  // 第2步：根据科目确定 dstUrl
  const dstUrl = subject === 'BIOLOGY' ? '/permission/chat' : '/permission/chatMath'
  
  if (isImageMessage) {
    // 图片消息请求
    const contextPrompt = currentQuestion.title || '题目截图'
    const sessionId = `teacher-exercise-session-${Date.now()}`
    
    return {
      sessionId,
      newValue: '1',
      coversation: content,  // 用户输入的问题文本
      question: imageData!.base64DataUrl || '',  // 图片Base64
      answer: contextPrompt,  // 上下文提示
      name: userInfo?.userName || 'User',
      reason: 'start',
      bmNo: currentQuestion.bmNo || currentQuestion.id,
      isWebSearch: enableWebSearch ? '1' : '0',
      chatRole: chatRole,
      dstUrl: dstUrl  // ⭐ 明确指定接口路径
    }
  }
  
  // 第3步：文本消息请求（包含完整题目信息）
  const sessionId = currentQuestion.id || `teacher-exercise-session-${Date.now()}`
  const question = currentQuestion.question || currentQuestion.title || '题目内容'
  const bmNo = currentQuestion.bmNo || currentQuestion.id || sessionId
  
  return {
    sessionId,
    newValue: '1',
    coversation: content,
    question: question,
    answer: currentQuestion.answer || '',
    name: userInfo?.userName || 'User',
    reason: 'start',
    bmNo: bmNo,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole: chatRole,
    dstUrl: dstUrl  // ⭐ 明确指定接口路径
  }
}


/**
 * 通用验证工具函数
 *
 * 职责：提供所有 Store 的通用验证逻辑
 * - ID 格式验证
 * - 时间戳验证和修正
 */

/**
 * 验证UUID格式（支持标准UUID格式）
 */
export const isValidUUID = (id: string | null | undefined): boolean => {
  if (!id || typeof id !== 'string') {
    return false
  }
  // UUID格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/**
 * 验证消息ID格式
 */
export const validateMessageId = (messageId: string | null | undefined): boolean => {
  if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
    console.error('[Validation] ❌ 消息ID为空或格式错误:', messageId)
    return false
  }
  if (!isValidUUID(messageId)) {
    console.error('[Validation] ❌ 消息ID格式不正确（应为UUID格式）:', messageId)
    return false
  }
  return true
}

/**
 * 验证会话ID格式
 * 支持以下格式：
 * 1. 标准UUID格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * 2. teacher-{hex}-{timestamp} 格式（Android/Web生成）：teacher-638e6e1c-1762486710774
 * 3. teacher-{timestamp} 格式（临时ID）：teacher-1762486710774
 * 4. teacher-chat-{timestamp} 格式（临时ID）：teacher-chat-1762486710774
 */
export const validateSessionId = (sessionId: string | null | undefined): boolean => {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    console.error('[Validation] ❌ 会话ID为空或格式错误:', sessionId)
    return false
  }

  const trimmedId = sessionId.trim()

  // 1. 检查标准UUID格式
  if (isValidUUID(trimmedId)) {
    return true
  }

  // 2. 检查 teacher-{hex}-{timestamp} 格式（例如：teacher-638e6e1c-1762486710774）
  // hex: 8位十六进制数字，timestamp: 数字
  const teacherHexTimestampRegex = /^teacher-[0-9a-f]{8}-[0-9]+$/i
  if (teacherHexTimestampRegex.test(trimmedId)) {
    return true
  }

  // 3. 检查 teacher-{timestamp} 格式（临时ID）
  const teacherTimestampRegex = /^teacher-[0-9]+$/
  if (teacherTimestampRegex.test(trimmedId)) {
    return true
  }

  // 4. 检查 teacher-chat-{timestamp} 格式（临时ID）
  const teacherChatTimestampRegex = /^teacher-chat-[0-9]+$/
  if (teacherChatTimestampRegex.test(trimmedId)) {
    return true
  }

  // 5. 检查纯数字 timestamp 格式（新格式，13位数字）
  const timestampRegex = /^[0-9]{13}$/
  if (timestampRegex.test(trimmedId)) {
    return true
  }

  // 如果都不匹配，记录错误
  console.error(
    '[Validation] ❌ 会话ID格式不正确，支持的格式：UUID、teacher-{hex}-{timestamp}、teacher-{timestamp}、teacher-chat-{timestamp}、纯数字timestamp。实际值:',
    trimmedId,
  )
  return false
}

/**
 * 验证并修正时间戳
 * 如果时间戳是未来时间或异常，使用当前时间
 */
export const validateAndFixTimestamp = (timestamp: number): number => {
  const now = Date.now()
  const MAX_FUTURE_OFFSET = 60000 // 允许1分钟的未来时间误差（考虑时钟不同步）
  const MAX_PAST_OFFSET = 365 * 24 * 60 * 60 * 1000 // 允许1年前的过去时间

  // 检查是否为有效数字
  if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp)) {
    console.warn('[Validation] ⚠️ 时间戳无效，使用当前时间:', timestamp)
    return now
  }

  // 检查是否为未来时间（允许1分钟误差）
  if (timestamp > now + MAX_FUTURE_OFFSET) {
    console.warn('[Validation] ⚠️ 时间戳是未来时间，使用当前时间:', {
      timestamp,
      now,
      offset: timestamp - now,
    })
    return now
  }

  // 检查是否为过于久远的过去时间（超过1年）
  if (timestamp < now - MAX_PAST_OFFSET) {
    console.warn('[Validation] ⚠️ 时间戳过于久远，使用当前时间:', {
      timestamp,
      now,
      offset: now - timestamp,
    })
    return now
  }

  return timestamp
}

/**
 * 验证消息数据格式
 */
export const validateMessageData = <T>(messageData: unknown): T | null => {
  if (!messageData) {
    console.error('[Validation] ❌ 消息数据为空，拒绝处理')
    return null
  }

  if (typeof messageData !== 'object') {
    console.error('[Validation] ❌ 消息数据格式错误，期望对象，实际:', typeof messageData)
    return null
  }

  return messageData as T
}

/**
 * 验证发送消息的前置条件
 */
export const validateSendMessagePreconditions = async (
  currentSession: { sessionId: string } | null,
  getUserInfo: () => { id?: string; roles?: string[] } | null,
  checkAccountStatus: (userInfo: { id?: string; roles?: string[] } | null) => Promise<{ canSendMessage: boolean }>,
  showMessage: (message: string, type?: 'positive' | 'negative' | 'warning' | 'info' | 'success' | 'error') => void,
  setChatLoading: (loading: boolean) => void,
  setChatRendering: (rendering: boolean) => void
): Promise<boolean> => {
  // 验证会话
  if (!currentSession) {
    console.error('[Validation] ❌ 发送失败：未选择会话')
    showMessage('请先选择会话', 'warning')
    return false
  }

  // 检查账号状态（是否被禁言）
  const userInfo = getUserInfo()
  const accountStatus = await checkAccountStatus(userInfo)
  if (!accountStatus.canSendMessage) {
    console.error('[Validation] ❌ 发送失败：账号已被禁言')
    setChatLoading(false)
    setChatRendering(false)
    return false
  }

  return true
}

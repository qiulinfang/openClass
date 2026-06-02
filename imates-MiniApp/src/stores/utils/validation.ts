/**
 * 通用验证工具函数
 */

/**
 * 验证UUID格式
 */
export const isValidUUID = (id: string | null | undefined): boolean => {
  if (!id || typeof id !== 'string') {
    return false
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/**
 * 验证消息ID格式
 */
export const validateMessageId = (messageId: string | null | undefined): boolean => {
  if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
    return false
  }
  return true
}

/**
 * 验证会话ID格式
 */
export const validateSessionId = (sessionId: string | null | undefined): boolean => {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    return false
  }
  return true
}

/**
 * 验证并修正时间戳
 */
export const validateAndFixTimestamp = (timestamp: number): number => {
  const now = Date.now()
  if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp)) {
    return now
  }
  return timestamp
}

/**
 * 验证发送消息的前置条件
 */
export const validateSendMessagePreconditions = async (
  currentSession: { sessionId: string } | null,
  getUserInfo: () => any,
  checkAccountStatus: (userInfo: any) => Promise<{ canSendMessage: boolean }>,
  showMessage: (message: string, type?: any) => void,
  setChatLoading: (loading: boolean) => void,
  setChatRendering: (rendering: boolean) => void
): Promise<boolean> => {
  if (!currentSession) {
    showMessage('请先选择会话', 'warning')
    return false
  }

  const userInfo = getUserInfo()
  const accountStatus = await checkAccountStatus(userInfo)
  if (!accountStatus.canSendMessage) {
    setChatLoading(false)
    setChatRendering(false)
    return false
  }

  return true
}

// 作业状态相关常量

// 作业状态映射表
export const HOMEWORK_STATUS_MAP: Record<string, string> = {
  '0': '草稿',
  '1': '进行中',
  '2': '已撤销',
  '3': '已结束'
}

// 作业状态类型映射表
export const HOMEWORK_STATUS_TYPE_MAP: Record<string, string> = {
  '0': 'draft',
  '1': 'ongoing',
  '2': 'canceled',
  '3': 'ended'
}

// 作业状态标签颜色映射表
export const HOMEWORK_STATUS_TAG_TYPE_MAP: Record<string, 'green' | 'purple' | 'gray'> = {
  'ongoing': 'green',
  'draft': 'purple',
  'canceled': 'gray',
  'ended': 'gray'
}

// 作业标签映射表
export const HOMEWORK_TAG_MAP: Record<string, string> = {
  'fullSubmit': '一次性提交',
  'lateSubmit': '允许补交',
  'resubmit': '允许重交'
}

// 按钮文本映射表
export const HOMEWORK_BUTTON_TEXT_MAP = {
  ended: '去作答',
  expiredCanLateSubmit: '去补交',
  expiredNoLateSubmit: '去作答',
  normal: '去作答'
}

// 按钮变体映射表
export const HOMEWORK_BUTTON_VARIANT_MAP = {
  disabled: 'expired' as const,
  enabled: 'primary' as const
}

// 获取作业状态文本
export const getHomeworkStatusText = (status: string, deadline?: string): string => {
  // 如果提供了截止日期且当前日期已超过截止日期，强制设置为已结束
  if (deadline) {
    const deadlineDate = new Date(deadline)
    const currentDate = new Date()
    if (currentDate > deadlineDate) {
      return HOMEWORK_STATUS_MAP['3'] // 已结束
    }
  }
  return HOMEWORK_STATUS_MAP[status] || '进行中'
}

// 获取作业状态类型
export const getHomeworkStatusType = (status: string): string => {
  return HOMEWORK_STATUS_TYPE_MAP[status] || 'ongoing'
}

// 获取作业状态标签颜色类型
export const getHomeworkStatusTagType = (statusType: string, deadline?: string): 'green' | 'purple' | 'gray' => {
  // 如果提供了截止日期且当前日期已超过截止日期，强制设置为灰色
  if (deadline) {
    const deadlineDate = new Date(deadline)
    const currentDate = new Date()
    if (currentDate > deadlineDate) {
      return 'gray'
    }
  }
  return HOMEWORK_STATUS_TAG_TYPE_MAP[statusType] || 'green'
}

// 获取作业标签文本
export const getHomeworkTagText = (tagType: keyof typeof HOMEWORK_TAG_MAP): string => {
  return HOMEWORK_TAG_MAP[tagType] || ''
}

// 获取按钮文本
export const getHomeworkButtonText = (status: string, isExpired: boolean, canLateSubmit: boolean): string => {
  if (status === '3') {
    return HOMEWORK_BUTTON_TEXT_MAP.ended
  }
  if (isExpired && canLateSubmit) {
    return HOMEWORK_BUTTON_TEXT_MAP.expiredCanLateSubmit
  }
  if (isExpired && !canLateSubmit) {
    return HOMEWORK_BUTTON_TEXT_MAP.expiredNoLateSubmit
  }
  return HOMEWORK_BUTTON_TEXT_MAP.normal
}

// 获取按钮变体
export const getHomeworkButtonVariant = (disabled: boolean): 'primary' | 'expired' => {
  return disabled ? HOMEWORK_BUTTON_VARIANT_MAP.disabled : HOMEWORK_BUTTON_VARIANT_MAP.enabled
}

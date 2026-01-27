export type SelectOption<T extends string | number = string> = {
  label: string
  value: T
}

export const RESOURCE_GRADE_OPTIONS: SelectOption[] = [
  { label: '全部', value: '' },
  { label: '高一', value: '高一' },
  { label: '高二', value: '高二' },
  { label: '高三', value: '高三' },
  { label: '初一', value: '初一' },
  { label: '初二', value: '初二' },
  { label: '初三', value: '初三' },
]

export const RESOURCE_VERSION_OPTIONS: SelectOption[] = [
  { label: '全部', value: '' },
  { label: '人教版', value: '人教版' },
  { label: '沪科技版', value: '沪科技版' },
  { label: '苏教版', value: '苏教版' },
  { label: '鲁教版', value: '鲁教版' },
]

export type ResourceDownloadStatus = '' | 'notDownloaded' | 'downloaded' | 'pendingUpdate'

export const RESOURCE_DOWNLOAD_STATUS_OPTIONS: SelectOption<ResourceDownloadStatus>[] = [
  { label: '全部', value: '' },
  { label: '未下载', value: 'notDownloaded' },
  { label: '已下载', value: 'downloaded' },
  { label: '待更新', value: 'pendingUpdate' },
]

// 笔刷预设选项（用于 PerfectFreehandConfigDialog）
export const PRESET_OPTIONS: SelectOption[] = [
  { label: '自定义', value: 'custom' },
  { label: '圆珠笔', value: 'ballpoint' },
  { label: '中性笔', value: 'gel' },
  { label: '钢笔', value: 'pen' },
  { label: '铅笔', value: 'pencil' },
  { label: '毛笔', value: 'brush' },
]

// 缓动函数选项（用于 PerfectFreehandConfigDialog）
export const EASING_OPTIONS: SelectOption[] = [
  { label: 'linear', value: 'linear' },
  { label: 'easeIn', value: 'easeIn' },
  { label: 'easeOut', value: 'easeOut' },
  { label: 'easeInOut', value: 'easeInOut' },
  { label: 'easeInQuad', value: 'easeInQuad' },
  { label: 'easeOutQuad', value: 'easeOutQuad' },
  { label: 'easeInOutQuad', value: 'easeInOutQuad' },
  { label: 'easeInCubic', value: 'easeInCubic' },
  { label: 'easeOutCubic', value: 'easeOutCubic' },
  { label: 'easeInOutCubic', value: 'easeInOutCubic' },
]

// Tab 选项（用于聊天面板）
export const CHAT_TAB_OPTIONS: Array<{ label: string; value: string; icon?: string }> = [
  { label: '会话记录', value: 'question-record', icon: 'quiz' },
  { label: 'AI问答', value: 'ai-chat', icon: 'chat' },
]

// AI 角色选项（用于聊天输入）
export const AI_ROLE_OPTIONS: SelectOption[] = [
  { label: '同桌', value: 'mate' },
  { label: '课代表', value: 'mentor' },
  { label: '大神', value: 'researcher' },
]

// 缩放预设选项（用于画板）
export const ZOOM_PRESET_OPTIONS: SelectOption[] = [
  { label: '50%', value: 0.5 },
  { label: '100%', value: 1 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
  { label: '300%', value: 3 },
  { label: '400%', value: 4 },
  { label: '500%', value: 5 },
]

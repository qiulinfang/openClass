/**
 * 科目相关常量定义
 */

// 支持的学科列表
export const SUPPORTED_SUBJECTS = ['math', 'biology', 'chemistry', 'physics', 'chinese', 'english'] as const

// 全量学科列表（知识图谱等模块使用，包含地理/历史/政治）
export const ALL_SUBJECTS = [...SUPPORTED_SUBJECTS, 'geography', 'history', 'politics'] as const

// 学科类型
export type SubjectType = typeof SUPPORTED_SUBJECTS[number]
export type AllSubjectType = typeof ALL_SUBJECTS[number]

// 后端/API 使用的小写学科码
export type ApiSubjectType =
  | 'math'
  | 'biology'
  | 'chemistry'
  | 'physics'
  | 'chinese'
  | 'english'
  | 'geography'
  | 'history'
  | 'politics'

// 学科选项（用于下拉框）
export const SUBJECT_OPTIONS = [
  { label: '全部', value: '' },
  { label: '数学', value: 'math' },
  { label: '生物', value: 'biology' },
  { label: '化学', value: 'chemistry' },
  { label: '物理', value: 'physics' },
  { label: '语文', value: 'chinese' },
  { label: '英语', value: 'english' },
]

// 知识图谱学科选项（保持历史实现：value 为后端小写学科码）
export const KNOWLEDGE_GRAPH_SUBJECT_OPTIONS: Array<{ value: ApiSubjectType; label: string }> = [
  { value: 'math', label: '数学' },
  { value: 'chinese', label: '语文' },
  { value: 'english', label: '英语' },
  { value: 'physics', label: '物理' },
  { value: 'chemistry', label: '化学' },
  { value: 'biology', label: '生物' },
  { value: 'geography', label: '地理' },
  { value: 'history', label: '历史' },
  { value: 'politics', label: '政治' },
]

// 学科过滤的匹配值映射（用于QuestionList中的题目筛选）
export const SUBJECT_FILTER_MAP: Record<SubjectType, string[]> = {
  math: ['math', 'MATH', '数学'],
  biology: ['biology', 'BIOLOGY', '生物'],
  chemistry: ['chemistry', 'CHEMISTRY', '化学'],
  physics: ['physics', 'PHYSICS', '物理'],
  chinese: ['chinese', 'CHINESE', '语文'],
  english: ['english', 'ENGLISH', '英语'],
}

export const normalizeSubject = (raw?: string): AllSubjectType => {
  const str = (raw || '').toString().trim()
  if (!str) return 'math'

  const idMapped = SUBJECT_ID_TO_API_SUBJECT[str]
  if (idMapped) return idMapped as AllSubjectType

  const upper = str.toUpperCase()

  // 兼容老格式：SUBJECT_*
  const noPrefix = upper.startsWith('SUBJECT_') ? upper.slice('SUBJECT_'.length) : upper

  // 兼容中文
  if (noPrefix === '数学') return 'math'
  if (noPrefix === '生物') return 'biology'
  if (noPrefix === '化学') return 'chemistry'
  if (noPrefix === '物理') return 'physics'
  if (noPrefix === '语文') return 'chinese'
  if (noPrefix === '英语') return 'english'
  if (noPrefix === '地理') return 'geography'
  if (noPrefix === '历史') return 'history'
  if (noPrefix === '政治') return 'politics'

  // 兼容大写/混合格式
  const lower = str.toLowerCase()
  if ((ALL_SUBJECTS as readonly string[]).includes(lower)) return lower as AllSubjectType
  if (noPrefix.includes('MATH')) return 'math'
  if (noPrefix.includes('BIOLOGY')) return 'biology'
  if (noPrefix.includes('CHEMISTRY')) return 'chemistry'
  if (noPrefix.includes('PHYSICS')) return 'physics'
  if (noPrefix.includes('CHINESE')) return 'chinese'
  if (noPrefix.includes('ENGLISH')) return 'english'
  if (noPrefix.includes('GEOGRAPHY')) return 'geography'
  if (noPrefix.includes('HISTORY')) return 'history'
  if (noPrefix.includes('POLITICS')) return 'politics'

  return 'math'
}

export const toApiSubject = (subject: AllSubjectType): ApiSubjectType => {
  return subject as ApiSubjectType
}

export const toSubjectTypeFromApi = (subject: ApiSubjectType): AllSubjectType => {
  return subject as AllSubjectType
}

// 作业模块学科选项（value 为后端学科ID字符串）
export const HOMEWORK_SUBJECT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '全部', value: '' },
  { label: '语文', value: '1' },
  { label: '数学', value: '2' },
  { label: '英语', value: '3' },
  { label: '物理', value: '4' },
  { label: '化学', value: '5' },
  { label: '生物', value: '6' },
  { label: '政治', value: '7' },
  { label: '历史', value: '8' },
  { label: '地理', value: '9' },
]

// 资源下载页学科选项（value 为中文学科名，保持页面现有筛选逻辑不变）
export const RESOURCE_SUBJECT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '全部', value: '' },
  { label: '数学', value: '数学' },
  { label: '语文', value: '语文' },
  { label: '英语', value: '英语' },
  { label: '物理', value: '物理' },
  { label: '化学', value: '化学' },
  { label: '生物', value: '生物' },
  { label: '历史', value: '历史' },
  { label: '地理', value: '地理' },
  { label: '政治', value: '政治' },
]

// 科目ID到中文名称的映射表（对应后端返回的科目ID）
export const SUBJECT_ID_TO_NAME: Record<string, string> = {
  '1': '语文',
  '2': '数学',
  '3': '英语',
  '4': '物理',
  '5': '化学',
  '6': '生物',
  '7': '历史',
  '8': '地理',
  '9': '政治'
}

export const SUBJECT_ID_TO_API_SUBJECT: Record<string, ApiSubjectType> = {
  '1': 'chinese',
  '2': 'math',
  '3': 'english',
  '4': 'physics',
  '5': 'chemistry',
  '6': 'biology',
  '7': 'history',
  '8': 'geography',
  '9': 'politics',
}

export const SUBJECT_TO_EXERCISE_LIST_ENDPOINT: Record<ApiSubjectType, string> = {
  math: '/permission/selectExercises/math',
  biology: '/permission/selectExercises/biology',
  chemistry: '/permission/selectExercises/chemistry',
  physics: '/permission/selectExercises/physics',
  chinese: '/permission/selectExercises/chinese',
  english: '/permission/selectExercises/english',
  geography: '/permission/selectExercises/geography',
  history: '/permission/selectExercises/history',
  politics: '/permission/selectExercises/politics',
}

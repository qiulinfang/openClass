/**
 * 科目相关常量定义
 */

// 支持的学科列表
export const SUPPORTED_SUBJECTS = ['MATH', 'BIOLOGY', 'CHEMISTRY', 'PHYSICS', 'CHINESE', 'ENGLISH'] as const

// 学科类型
export type SubjectType = typeof SUPPORTED_SUBJECTS[number]

// 学科选项（用于下拉框）
export const SUBJECT_OPTIONS = [
  { label: '全部学科', value: '' },
  { label: '数学', value: 'MATH' },
  { label: '生物', value: 'BIOLOGY' },
  { label: '化学', value: 'CHEMISTRY' },
  { label: '物理', value: 'PHYSICS' },
  { label: '语文', value: 'CHINESE' },
  { label: '英语', value: 'ENGLISH' },
]

// 学科过滤的匹配值映射（用于QuestionList中的题目筛选）
export const SUBJECT_FILTER_MAP: Record<SubjectType, string[]> = {
  MATH: ['math', 'MATH', '数学'],
  BIOLOGY: ['biology', 'BIOLOGY', '生物'],
  CHEMISTRY: ['chemistry', 'CHEMISTRY', '化学'],
  PHYSICS: ['physics', 'PHYSICS', '物理'],
  CHINESE: ['chinese', 'CHINESE', '语文'],
  ENGLISH: ['english', 'ENGLISH', '英语'],
}

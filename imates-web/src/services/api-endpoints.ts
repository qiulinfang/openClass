/**
 * API 端点配置
 * 基于Android原生ApiUrl.java的配置，保持与原生接口一致
 */

export const API_ENDPOINTS = {
  // 基础配置 - 与Android ApiUrl.java保持一致
  BASE_URL: {
    RELEASE: 'http://www.imates.com.cn:8222/blw-edu-service-alc',
    INTERNAL_TEST: 'https://api.showcode.xyz/blw-edu-service-alc',
    DEVELOPMENT: 'http://localhost:3000' // 本地开发环境
  },

  // 资源基础URL
  RESOURCE_BASE: {
    RELEASE: 'https://www.imates.com.cn',
    INTERNAL_TEST: 'https://www.showcode.xyz',
    DEVELOPMENT: 'http://localhost:3000'
  },

  // 用户相关 - 与Android原生一致
  USER: {
    LOGIN: '/admin/login',
    INFO: '/admin/info',
  },

  // 图像识别相关 - 与Android原生一致
  IMAGE_RECOGNITION: {
    BIOLOGY: '/permission/img',
    MATH: '/permission/imgMath',
  },

  // 文本搜题相关 - 与Android原生一致
  TEXT_SEARCH: {
    BIOLOGY: '/permission/textSearch',
    MATH: '/permission/textSearchMath',
  },

  // AI 聊天相关 - 与Android原生一致
  CHAT: {
    GENERAL: '/permission/chats',
    PREVIEW_PICTURE: '/permission/previewPictureQA',
    BIOLOGY: '/permission/chat',
    MATH: '/permission/chatMath',
  },

  // 习题相关 - 与Android原生一致
  EXERCISES: {
    ADD: '/permission/exercises',
    LIST_BIOLOGY: '/permission/selectExercises/biology',
    LIST_MATH: '/permission/selectExercises/math',
    DELETE_BASE: '/permission/deleteExercises',
    SIMILAR: '/permission/topicAndAck',
    SIMILAR_BY_KNOWLEDGE: '/biologyTopicKnowledge/knowledgeTopicAndAck',
  },

  // MQ相关配置
  MQ: {
    HOST: {
      RELEASE: 'www.imates.com.cn',
      INTERNAL_TEST: 'www.imates.com.cn',
      DEVELOPMENT: 'localhost'
    },
    PORT: {
      RELEASE: 5673,
      INTERNAL_TEST: 5673,
      DEVELOPMENT: 5672
    }
  },

  // Zammad相关
  ZAMMAD: {
    BASE_URL: 'http://app.imates.com.cn:8080/api/v1'
  },

  // 应用更新相关
  APP_UPDATE: {
    RELEASE: 'https://www.imates.com.cn/bj101/appupdate.json',
    INTERNAL_TEST: 'https://www.imates.com.cn/appupdate_test.json'
  }
} as const

// 使用统一类型定义
// import type { EnvType } from '../types' // 暂时未使用

// 当前基础URL
let currentBaseUrl = ''

/**
 * 设置基础URL
 */
export function setBaseUrl(baseUrl: string) {
  currentBaseUrl = baseUrl
}

/**
 * 获取完整的 API URL
 */
export function getApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http')) {
    return endpoint
  }
  
  // 如果基础URL为空，使用默认值
  if (!currentBaseUrl) {
    console.warn('API基础URL未设置，使用默认值')
    currentBaseUrl = 'http://www.imates.com.cn:8222/blw-edu-service-alc'
  }
  
  return `${currentBaseUrl}${endpoint}`
}

/**
 * 根据科目获取习题列表URL
 */
export function getExerciseListUrl(subject: string): string {
  const subjectLower = subject.toLowerCase()
  if (subjectLower === 'biology' || subjectLower === '生物') {
    return getApiUrl(API_ENDPOINTS.EXERCISES.LIST_BIOLOGY)
  } else if (subjectLower === 'math' || subjectLower === '数学') {
    return getApiUrl(API_ENDPOINTS.EXERCISES.LIST_MATH)
  }
  throw new Error(`不支持的科目类型: ${subject}`)
}

/**
 * 根据科目获取AI聊天URL
 */
export function getChatUrl(subject: string): string {
  const subjectLower = subject.toLowerCase()
  if (subjectLower === 'biology' || subjectLower === '生物') {
    return getApiUrl(API_ENDPOINTS.CHAT.BIOLOGY)
  } else if (subjectLower === 'math' || subjectLower === '数学') {
    return getApiUrl(API_ENDPOINTS.CHAT.MATH)
  }
  throw new Error(`不支持的科目类型: ${subject}`)
}

/**
 * 获取删除习题URL
 */
export function getDeleteExerciseUrl(exerciseId: string, subject: string): string {
  const subjectLower = subject.toLowerCase()
  return getApiUrl(`${API_ENDPOINTS.EXERCISES.DELETE_BASE}/${exerciseId}/${subjectLower}`)
}

/**
 * 构建查询参数
 */
export function buildQueryParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.append(key, String(value))
    }
  })
  
  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

/**
 * API 响应状态码
 */
export const API_STATUS = {
  SUCCESS: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const

/**
 * 老师QA类型 - 与Android TeacherQaType.java保持一致
 */
export const TEACHER_QA_TYPE = {
  SCHOOL_SUBJECT_BIOLOGY: '6',
  SCHOOL_SUBJECT_MATH: '2',
  QA_MSG_TYPE_TEXT: 0,
  QA_MSG_TYPE_PICTURE: 1,
  QA_MSG_TYPE_VOICE: 2,
} as const

/**
 * 聊天消息目录类型
 */
export const CHAT_CATALOGUE_TYPE = {
  CATEGORY_TEACHER_QA: 'CATEGORY_TEACHER_QA'
} as const
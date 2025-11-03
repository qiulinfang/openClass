/**
 * API 端点配置
 * 基于Web端api-endpoints.ts的配置，保持与原生接口一致
 */

export const API_ENDPOINTS = {
  // 用户相关 - 与Android原生一致
  USER: {
    XUEBAN_LOGIN: '/admin/login',
    ADMIN_INFO: '/admin/info',
  },
  
  // 习题相关 - 与Android原生一致
  EXERCISES: {
    LIST_BIOLOGY: '/permission/selectExercises/biology',
    LIST_MATH: '/permission/selectExercises/math',
    DELETE_BASE: '/permission/deleteExercises',
    ADD: '/permission/exercises',
  },
  
  // 其他端点后续添加...
} as const

/**
 * 获取完整的 API URL
 * 第1步：判断是否是完整URL
 * 第2步：如果是相对路径，拼接基础URL
 */
export function getApiUrl(endpoint: string, baseUrl?: string): string {
  // 第1步：判断是否是完整URL
  if (endpoint.startsWith('http')) {
    return endpoint
  }
  
  // 第2步：如果是相对路径，拼接基础URL
  if (baseUrl) {
    return `${baseUrl}${endpoint}`
  }
  
  // 默认返回相对路径（需要配置代理）
  return endpoint
}


/**
 * 基础类型定义
 * 通用基础类型和工具类型
 */

/** JSON 字符串类型，用于与原生交互 */
export type JSONString = string

/** 通用 API 响应格式 */
export interface ApiResponse<T = unknown> {
  success: boolean
  code?: number
  message?: string
  data?: T
}

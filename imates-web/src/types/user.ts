/**
 * 用户相关类型定义
 * 用户信息和认证相关类型
 */

/** 用户信息接口 */
export interface UserInfo {
  userId: string
  userName: string
  avatar?: string
  grade?: string
  token?: string
}

/**
 * 用户相关类型定义
 * 用户信息和认证相关类型
 */

/** 用户信息接口 */
export interface UserInfo {
  id?: string
  userId?: string
  name?: string
  userName?: string
  nickName?: string
  avatar?: string
  grade?: string
  roles?: string[]
  token?: string
  permissionValueList?: string[]
}

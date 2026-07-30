/**
 * 用户相关类型定义
 * 用户信息和认证相关类型
 */

/** 老师项接口 */
export interface TeacherItem {
  id: string
  account: string
  password?: string
  name: string
  mobile?: string | null
  gender?: string
  status?: string
  sort?: number
  orgId?: string | null
  avatar?: string | null
  createTime?: string
  updateTime?: string
  subject?: string
  subjectList?: string[]
}

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
  teacherList?: TeacherItem[]
}

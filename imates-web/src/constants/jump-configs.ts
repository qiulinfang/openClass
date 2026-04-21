/**
 * 登录后的跳转参数配置
 * 统一管理不同学校、不同场景的跳转 query 参数
 */
import { getUserId } from '@/services'

// 基础虚拟教材 ID 生成逻辑
const getVirtualId = (suffix: string) => `${getUserId()}_${suffix}`

/**
 * 中关村一小 (ZGC) 跳转参数
 */
export const ZGC_JUMP_QUERY = {
  id: getVirtualId('35943sdfsf0640'),
  textbookName: '平行四边形的面积',
  sectionName: '平行四边形的面积',
  resourceId: `${getVirtualId('35943sdfsf0640')}_file`,
  fileName: '教材.pdf',
  packageId: `${getVirtualId('35943sdfsf0640')}_package`,
  packageName: '教材',
  chapterGrade: '初一',
  chapterSubject: '数学',
  chapterTextbook: '探究型公开课',
  chapterTitle: '平行四边形的面积',
  fromLearning: 'true',
  learningNodeId: '391051348794249216',
  learningLevel: '1',
}

/**
 * 首都师范 (SDSF) 跳转参数
 */
export const SDSF_JUMP_QUERY = {
  ...ZGC_JUMP_QUERY,
  id: getVirtualId('35943sdsf0640'),
  resourceId: `${getVirtualId('35943sdsf0640')}_file`,
  packageId: `${getVirtualId('35943sdsf0640')}_package`,
}

/**
 * 经开二中 (JK) 跳转参数
 */
export const JK_JUMP_QUERY = {
  id: 'JK_MATH_7A_U1',
  chapterGrade: '六年级',
  chapterSubject: '数学',
  chapterTextbook: '人教版',
  chapterTitle: '负数的认识',
  resourceId: 'JK_MATH_7A_U1_file',
  packageId: 'JK_MATH_7A_U1_package',
  fromLearning: 'true'
}

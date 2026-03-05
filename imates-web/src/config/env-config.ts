/**
 * 应用环境配置
 * 对齐 Android AppEnvConfig 的环境切换逻辑
 */


// 环境类型枚举
export enum AppEnvType {
  RELEASE = 'RELEASE',
  INTERNAL_TEST = 'INTERNAL_TEST',
}

export interface ApiPaths {
  teacher: TeacherApiPaths
  textbook: TextbookApiPaths
  homework: {
    undoList: string
    detailList: string
    submitSave: string
  }
}

export interface TextbookApiPaths {
  teacherTextbook: string
  teacherTextbookSectionTree: string
  teacherTextbookLearningPackage: string
  topicPackageAnswer: string
  topicPackagePage: string
}

export interface TeacherApiPaths {
  historyList: string
  uploadImg: string
  wsPath: string
}

export const ADDRESS_CATALOG = {
  IMATES_HTTP: 'https://www.imates.com.cn',
  CLIENT_HTTP: 'https://www.imates.com.cn:8200',
  CLIENT_WS: 'wss://www.imates.com.cn:8200/ws/im',
  XUEBAN_RELEASE: 'http://www.imates.com.cn:8222/blw-edu-service-alc',
  XUEBAN_TEST: 'http://www.imates.com.cn:58443/blw-edu-service-alc',
  YANBAN_RELEASE: 'https://www.imates.com.cn:9099',
  TEACHER_WS_RELEASE: 'ws://www.imates.com.cn:8201',
  TEACHER_WS_TEST: 'wss://www.imates.com.cn',
  TEACHER_API_RELEASE: 'http://www.imates.com.cn:8201',
  HISTORY_MANAGE: 'https://u389082-a353-35fba22b.westb.seetacloud.com:8443',
  ZAMMAD_API: 'http://app.imates.com.cn:8080',
  KNOWLEDGE_API: 'http://www.imates.com.cn:8090',
} as const

// localStorage 键名
const STORAGE_KEY = 'app_env_type'

// 测试环境切换密码（与 Android 保持一致）
const TEST_ENV_PASSWORD = '985211'

/**
 * 获取当前环境类型（默认正式环境）
 */
export function getCurrentEnvType(): AppEnvType { 
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && Object.values(AppEnvType).includes(stored as AppEnvType)) {
      return stored as AppEnvType
    }
  } catch (error) {
    console.warn('[EnvConfig] 读取环境配置失败:', error)
  }
  return AppEnvType.RELEASE
}

/**
 * 获取当前环境配置
 */
export const getIsInternalTest = (): boolean => getCurrentEnvType() === AppEnvType.INTERNAL_TEST

/**
 * 强制设置环境类型（绕过密码验证）
 */
export function forceSetEnvType(envType: AppEnvType): void {
  try {
    localStorage.setItem(STORAGE_KEY, envType)
    console.log('[EnvConfig] 环境已切换为:', envType)
  } catch (error) {
    console.error('[EnvConfig] 设置环境配置失败:', error)
  }
}

/**
 * 尝试切换环境（需要密码验证）
 * @returns 是否切换成功
 */
export function trySwitchEnv(targetEnv: AppEnvType, password?: string): boolean {
  // 从正式环境切换到测试环境需要密码验证
  if (targetEnv === AppEnvType.INTERNAL_TEST && password !== TEST_ENV_PASSWORD) {
    return false
  }

  // 切换环境不需要密码的情况：
  // 1. 从测试环境切换回正式环境
  // 2. 已经是目标环境
  forceSetEnvType(targetEnv)
  return true
}

/**
 * 获取环境显示名称
 */
export function getEnvDisplayName(): string {
  return getIsInternalTest() ? 'Joined Testflight' : ''
}

/**
 * 获取 API Base URL
 */
export function getApiBaseUrl(): string {
  return getIsInternalTest() ? ADDRESS_CATALOG.XUEBAN_TEST : ADDRESS_CATALOG.XUEBAN_RELEASE
}

/**
 * 获取资源 Base URL
 */
export function getResourceBaseUrl(): string {
  return getIsInternalTest() ? ADDRESS_CATALOG.IMATES_HTTP : ADDRESS_CATALOG.YANBAN_RELEASE
}

/**
 * 获取研伴/题包服务 Base URL
 */
export function getYanbanBaseUrl(): string {
  return getIsInternalTest() ? ADDRESS_CATALOG.IMATES_HTTP : ADDRESS_CATALOG.YANBAN_RELEASE
}

/**
 * 获取教师服务 WebSocket URL
 * 注意：直接返回完整的WebSocket URL (wss://)
 */
export function getTeacherWsUrl(): string {
  if (getIsInternalTest()) {
    return ADDRESS_CATALOG.TEACHER_WS_TEST
  }
  return ADDRESS_CATALOG.TEACHER_WS_RELEASE
}

/**
 * 获取教师服务 API Base URL
 * 注意：返回HTTP协议的URL，用于API请求
 */
export function getTeacherApiBaseUrl(): string {
  if (getIsInternalTest()) {
    return ADDRESS_CATALOG.IMATES_HTTP
  }
  return ADDRESS_CATALOG.TEACHER_API_RELEASE
}

export function getTeacherImageBaseUrl(): string {
  return ADDRESS_CATALOG.IMATES_HTTP
}

export function resolveTeacherImageUrl(pathOrUrl: string): string {
  // 测试环境：/img/... => /imgtest/...
  if (getIsInternalTest() && pathOrUrl.startsWith('/img')) {
    const rewritten = pathOrUrl.replace(/^\/img(\/|$)/, '/imgtest$1')
    return `${getTeacherImageBaseUrl()}${rewritten}`
  }

  // 正式环境：保持原路径（例如 /img/...）
  return `${getTeacherImageBaseUrl()}${pathOrUrl}`
}

/**
 * 获取对话记忆管理服务 Base URL
 */
export function getHistoryManageBaseUrl(): string {
  return ADDRESS_CATALOG.HISTORY_MANAGE
}

/**
 * 获取 IM 服务完整基础URL（包含协议和域名，用于认证接口）
 */
export function getImBaseUrl(): string {
  return ADDRESS_CATALOG.CLIENT_HTTP
}

/**
 * 获取 IM WebSocket URL（直接返回配置的 WebSocket URL）
 */
export function getImWebSocketUrl(): string {
  return ADDRESS_CATALOG.CLIENT_WS
}

/**
 * 获取 API 路径配置
 * 只包含需要环境分流的路径，相同路径直接写死在调用处
 */
export function getApiPaths(): ApiPaths {
  if (getIsInternalTest()) {
    return {
      homework: {
        undoList: '/yb-test/blw-edu-yb/api/app/homework-undo-list',
        detailList: '/yb-test/blw-edu-yb/api/app/homework-detail-list',
        submitSave: '/yb-test/blw-edu-yb/api/app/homework-submit-save',
      },
      teacher: {
        historyList: '/yb-test/yb-teacher/api/question/historyList',
        uploadImg: '/yb-test/yb-teacher/api/system/uploadImg',
        wsPath: '/yb-teacher-ws',
      },
      textbook: {
        teacherTextbook: '/yb-test/blw-edu-yb/api/app/teacher-textbook',
        teacherTextbookSectionTree: '/yb-test/blw-edu-yb/api/app/teacher-textbook-section-tree',
        teacherTextbookLearningPackage: '/yb-test/blw-edu-yb/api/app/teacher-textbook-learning-package',
        topicPackageAnswer: '/yb-test/blw-edu-yb/api/app/topic-package-answer',
        topicPackagePage: '/yb-test/blw-edu-yb/api/app/topic-package-page',
      },
    }
  }
  return {
    homework: {
      undoList: '/homework/homeworkPage',
      detailList: '/homework/homeworkInfo',
      submitSave: '/homework-submit-save',
    },
    teacher: {
      historyList: '/blw-edu-yb/api/question/historyList',
      uploadImg: '/blw-edu-yb/api/system/uploadImg',
      wsPath: '/blw-edu-yb/ws',
    },
    textbook: {
      teacherTextbook: '/blw-edu-yb/api/app/teacher-textbook',
      teacherTextbookSectionTree: '/blw-edu-yb/api/app/teacher-textbook-section-tree',
      teacherTextbookLearningPackage: '/blw-edu-yb/api/app/teacher-textbook-learning-package',
      topicPackageAnswer: '/blw-edu-yb/api/app/topic-package-answer',
      topicPackagePage: '/blw-edu-yb/api/app/topic-package-page',
    },
  }
}

/**
 * 获取应用更新接口 URL
 */
export function getAppUpdateUrl(): string {
  const envType = getCurrentEnvType()

  // 测试环境：仍然使用固定的 /appupdate_test.json，由 http-client 路由到 https://www.imates.com.cn
  if (envType === AppEnvType.INTERNAL_TEST) return '/appupdate_test.json'

  // 其它环境：当前仅保留 jinshanyuanyang 配置
  return '/bj101/appupdate.json'
}

/**
 * 获取路由映射表（用于 file:// 环境下的路径映射）
 * 动态获取，根据当前环境返回不同的 Base URL
 */
export function getRouteBaseMap(): Record<string, string> {
  const apiBaseUrl = getApiBaseUrl()
  const resourceBaseUrl = getResourceBaseUrl()
  const yanbanBaseUrl = getYanbanBaseUrl()
  const teacherWsUrl = getTeacherWsUrl()
  const teacherApiBaseUrl = getTeacherApiBaseUrl()
  const historyManageBaseUrl = getHistoryManageBaseUrl()

  return {
    // 应用更新配置（/bj101/appupdate.json）永远走学班服务
    '/bj101': ADDRESS_CATALOG.IMATES_HTTP,
    // 学班服务（根据环境动态切换）
    '/admin': apiBaseUrl,
    '/permission': apiBaseUrl,
    '/ai': apiBaseUrl,
    '/history_manage': historyManageBaseUrl,
    '/biologyTopicKnowledge': apiBaseUrl,
    // 图片上传接口（直接走 Nginx 8200 端口，不走 /blw-edu-yb 前缀）
    '/api/images/upload': ADDRESS_CATALOG.CLIENT_HTTP,
    // 研伴API服务（根据环境动态切换）
    '/api': yanbanBaseUrl,
    '/homework': yanbanBaseUrl,
    '/blw-edu-yb/api/question': teacherApiBaseUrl,
    '/blw-edu-yb/api/system': teacherApiBaseUrl,
    // 测试环境教师 API 路径映射
    '/yb-test/yb-teacher/api/question': teacherApiBaseUrl,
    '/yb-test/yb-teacher/api/system': teacherApiBaseUrl,
    // 测试环境研伴/教材路径映射（统一 /yb-test 前缀）
    '/yb-test/blw-edu-yb': yanbanBaseUrl,
    // 研伴/教材等走资源服务器
    '/blw-edu-yb': yanbanBaseUrl,
    // Zammad 示例
    '/api/v1': ADDRESS_CATALOG.ZAMMAD_API,
    // 资源服务器（根据环境动态切换）
    '/resource': resourceBaseUrl,
    '/img': yanbanBaseUrl,
    // 知识点查询服务
    '/knowledge': ADDRESS_CATALOG.KNOWLEDGE_API,
    '/appupdate_test.json': ADDRESS_CATALOG.IMATES_HTTP,
  }
}

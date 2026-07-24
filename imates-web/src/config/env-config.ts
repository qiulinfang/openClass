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
  xueban: XuebanApiPaths
  yanban: YanbanApiPaths
}

export interface YanbanApiPaths {
  auth: AuthApiPaths
  resource: ResourceApiPaths
  homework: {
    undoList: string
    detailList: string
    submitSave: string
  }
  teacher: TeacherApiPaths
  textbook: TextbookApiPaths
}

export interface XuebanApiPaths {
  admin: {
    base: string
    login: string
    info: string
  }
  permission: {
    base: string
    deleteExercisesBase: string
    exercises: string
    img: string
    imgMath: string
    textSearchBase: string
    textSearchMathBase: string
    topicAndAck: string
    selectExercisesBase: string
  }
  ai: {
    base: string
    chats: string
    previewPictureQA: string
    chatMath: string
    chat: string
  }
  biologyTopicKnowledge: {
    base: string
    knowledgeTopicAndAck: string
    knowledgeTopicAndAck2: string
  }
}

export interface AuthApiPaths {
  loginStudent: string
}

export interface ResourceApiPaths {
  base: string
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
  TEACHER_WS_RELEASE: 'wss://www.imates.com.cn',
  TEACHER_WS_TEST: 'wss://www.imates.com.cn',
  TEACHER_API_RELEASE: 'http://www.imates.com.cn:8201',
  HISTORY_MANAGE: 'https://kelvin-cosin.cloud/api',
  ZAMMAD_API: 'http://app.imates.com.cn:8080',
  KNOWLEDGE_API: 'http://www.imates.com.cn:8090',
  GAOKAO_AGENT_LLM: 'http://49.232.39.212:9011',
  HW_FORMULA_RECOGNIZE: 'http://49.232.39.212:9012',
  QUESTION_STRUCTURER: 'http://49.232.39.212:8055',
  MQTT_WS_RELEASE: 'wss://www.imates.com.cn:8083/mqtt',
  MQTT_WS_TEST: 'ws://www.imates.com.cn:8083/mqtt',
  MATHRAG_V2_SEARCH: 'http://49.232.39.212:18211',
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
 * 获取 MQTT WebSocket URL
 */
export function getMqttWsUrl(): string {
  if (getIsInternalTest()) {
    return ADDRESS_CATALOG.MQTT_WS_TEST
  }
  return ADDRESS_CATALOG.MQTT_WS_RELEASE
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



export function getGaokaoAgentBaseUrl(): string {
  return ADDRESS_CATALOG.GAOKAO_AGENT_LLM
}

export function getHwFormulaRecognizeBaseUrl(): string {
  return ADDRESS_CATALOG.HW_FORMULA_RECOGNIZE
}

export function getQuestionStructurerBaseUrl(): string {
  return ADDRESS_CATALOG.QUESTION_STRUCTURER
}

/**
 * 只包含需要环境分流的路径，相同路径直接写死在调用处
 */
export function getApiPaths(): ApiPaths {
  if (getIsInternalTest()) {
    return {
      xueban: {
        admin: {
          base: '/xb-test/admin',
          login: '/xb-test/admin/login',
          info: '/xb-test/admin/info',
        },
        permission: {
          base: '/xb-test/permission',
          deleteExercisesBase: '/xb-test/permission/deleteExercises',
          exercises: '/xb-test/permission/exercises',
          img: '/xb-test/permission/img',
          imgMath: '/xb-test/permission/imgMath',
          textSearchBase: '/xb-test/permission/textSearch',
          textSearchMathBase: '/xb-test/permission/textSearchMath',
          topicAndAck: '/xb-test/permission/topicAndAck',
          selectExercisesBase: '/xb-test/permission/selectExercises',
        },
        ai: {
          base: '/xb-test/ai',
          chats: '/xb-test/ai/2.0/chats',
          previewPictureQA: '/xb-test/ai/2.0/previewPictureQA',
          chatMath: '/xb-test/ai/2.0/chatMath',
          chat: '/xb-test/ai/2.0/chat',
        },
        biologyTopicKnowledge: {
          base: '/xb-test/biologyTopicKnowledge',
          knowledgeTopicAndAck: '/xb-test/biologyTopicKnowledge/knowledgeTopicAndAck',
          knowledgeTopicAndAck2: '/xb-test/biologyTopicKnowledge/knowledgeTopicAndAck2',
        },
      },
      yanban: {
        auth: {
          loginStudent: '/yb-test/blw-edu-yb/auth/login-student',
        },
        resource: {
          base: '/yb-test/resource',
        },
        homework: {
          undoList: '/yb-test/blw-edu-yb/api/app/homework-undo-list',
          detailList: '/yb-test/blw-edu-yb/api/app/homework-detail-list',
          submitSave: '/yb-test/blw-edu-yb/api/app/homework-submit-save',
        },
        teacher: {
          historyList: '/yb-teacher-test/yb-teacher/api/question/historyList',
          uploadImg: '/yb-test/blw-edu-yb/api/system/uploadImg',
          wsPath: '/teacher-ws-test/yb-teacher-ws',
        },
        textbook: {
          teacherTextbook: '/yb-test/blw-edu-yb/api/app/teacher-textbook',
          teacherTextbookSectionTree: '/yb-test/blw-edu-yb/api/app/teacher-textbook-section-tree',
          teacherTextbookLearningPackage: '/yb-test/blw-edu-yb/api/app/teacher-textbook-learning-package',
          topicPackageAnswer: '/yb-test/blw-edu-yb/api/app/topic-package-answer',
          topicPackagePage: '/yb-test/blw-edu-yb/api/app/topic-package-page',
        },
      },
    }
  }
  return {
    xueban: {
      admin: {
        base: '/xb-release/admin',
        login: '/xb-release/admin/login',
        info: '/xb-release/admin/info',
      },
      permission: {
        base: '/xb-release/permission',
        deleteExercisesBase: '/xb-release/permission/deleteExercises',
        exercises: '/xb-release/permission/exercises',
        img: '/xb-release/permission/img',
        imgMath: '/xb-release/permission/imgMath',
        textSearchBase: '/xb-release/permission/textSearch',
        textSearchMathBase: '/xb-release/permission/textSearchMath',
        topicAndAck: '/xb-release/permission/topicAndAck',
        selectExercisesBase: '/xb-release/permission/selectExercises',
      },
      ai: {
        base: '/xb-release/ai',
        chats: '/xb-release/ai/2.0/chats',
        previewPictureQA: '/xb-release/ai/2.0/previewPictureQA',
        chatMath: '/xb-release/ai/2.0/chatMath',
        chat: '/xb-release/ai/2.0/chat',
      },
      biologyTopicKnowledge: {
        base: '/xb-release/biologyTopicKnowledge',
        knowledgeTopicAndAck: '/xb-release/biologyTopicKnowledge/knowledgeTopicAndAck',
        knowledgeTopicAndAck2: '/xb-release/biologyTopicKnowledge/knowledgeTopicAndAck2',
      },
    },
    yanban: {
      auth: {
        loginStudent: '/yb-release/blw-edu-yb/auth/login-student',
      },
      resource: {
        base: '/yb-release/resource',
      },
      homework: {
        undoList: '/yb-release/blw-edu-yb/api/app/homework-undo-list',
        detailList: '/yb-release/blw-edu-yb/api/app/homework-detail-list',
        submitSave: '/yb-release/blw-edu-yb/api/app/homework-submit-save',
      },
      teacher: {
        historyList: '/yb-teacher-release/blw-edu-yb/api/question/historyList',
        uploadImg: '/yb-release/blw-edu-yb/api/system/uploadImg',
        wsPath: '/teacher-ws-release/blw-edu-yb/ws',
      },
      textbook: {
        teacherTextbook: '/yb-release/blw-edu-yb/api/app/teacher-textbook',
        teacherTextbookSectionTree: '/yb-release/blw-edu-yb/api/app/teacher-textbook-section-tree',
        teacherTextbookLearningPackage: '/yb-release/blw-edu-yb/api/app/teacher-textbook-learning-package',
        topicPackageAnswer: '/yb-release/blw-edu-yb/api/app/topic-package-answer',
        topicPackagePage: '/yb-release/blw-edu-yb/api/app/topic-package-page',
      },
    },
  }
}

/**
 * 获取应用更新接口 URL
 */
export function getAppUpdateUrl(): string {
  return '/bj101/appupdate.json'
}

/**
 * 获取路由映射表（用于 file:// 环境下的路径映射）
 * 动态获取，根据当前环境返回不同的 Base URL
 */
export function getRouteBaseMap(): Record<string, string> {
  const yanbanBaseUrl = getYanbanBaseUrl()

  return {
    // 学伴测试环境 Nginx 前缀（/xb-test/...）
    '/xb-test': ADDRESS_CATALOG.IMATES_HTTP,
    // 学伴生产环境 Nginx 前缀（/xb-release/...）
    '/xb-release': ADDRESS_CATALOG.IMATES_HTTP,
    // 研伴测试环境 Nginx 前缀（/yb-test/...）
    '/yb-test': ADDRESS_CATALOG.IMATES_HTTP,
    // 研伴生产环境 Nginx 前缀（/yb-release/...）
    '/yb-release': ADDRESS_CATALOG.IMATES_HTTP,
        // 研伴测试环境 Nginx 前缀（/yb-test/...）
    '/yb-teacher-test': ADDRESS_CATALOG.IMATES_HTTP,
    // 研伴生产环境 Nginx 前缀（/yb-release/...）
    '/yb-teacher-release': ADDRESS_CATALOG.IMATES_HTTP,
    // 知识点查询服务
    '/knowledge': ADDRESS_CATALOG.KNOWLEDGE_API,
    // requests 代理服务（Nginx 转发到自建代理服务）
    '/requests': ADDRESS_CATALOG.IMATES_HTTP,
    '/requests2': ADDRESS_CATALOG.IMATES_HTTP,
    // 应用更新配置（/bj101/appupdate.json）永远走学伴服务
    '/bj101': ADDRESS_CATALOG.IMATES_HTTP,
    // 学伴服务（根据环境动态切换）
    '/history_manage': ADDRESS_CATALOG.HISTORY_MANAGE,
    '/get_shor_term_memory': ADDRESS_CATALOG.HISTORY_MANAGE,
    // gaokao-agent-llm 服务
    '/v1': ADDRESS_CATALOG.GAOKAO_AGENT_LLM,
    // recognize-handwritten-formula-image 服务
    '/api/recognize-handwritten-formula-image': ADDRESS_CATALOG.HW_FORMULA_RECOGNIZE,
    // 图片上传服务
    '/api/images/upload': ADDRESS_CATALOG.CLIENT_HTTP,
  }
}

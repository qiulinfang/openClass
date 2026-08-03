/**
 * 应用环境配置
 * 对齐 imates-web Vite Proxy 代理转发规则
 */

// 环境类型枚举
export enum AppEnvType {
  RELEASE = 'RELEASE',
  INTERNAL_TEST = 'INTERNAL_TEST',
}

export const ADDRESS_CATALOG = {
  IMATES_HTTP: 'https://www.imates.com.cn',
  CLIENT_HTTP: 'https://www.imates.com.cn:8200',
  YANBAN_RELEASE: 'https://www.imates.com.cn:9099',
} as const

const STORAGE_KEY = 'app_env_type'
const TEST_ENV_PASSWORD = '985211'

/**
 * 获取当前环境类型
 */
export function getCurrentEnvType(): AppEnvType {
  try {
    const stored = uni.getStorageSync(STORAGE_KEY)
    if (stored && Object.values(AppEnvType).includes(stored as AppEnvType)) {
      return stored as AppEnvType
    }
  } catch (error) {
    console.warn('[EnvConfig] 读取环境配置失败:', error)
  }
  return AppEnvType.RELEASE
}

export const getIsInternalTest = (): boolean => getCurrentEnvType() === AppEnvType.INTERNAL_TEST

export function forceSetEnvType(envType: AppEnvType): void {
  try {
    uni.setStorageSync(STORAGE_KEY, envType)
    console.log('[EnvConfig] 环境已切换为:', envType)
  } catch (error) {
    console.error('[EnvConfig] 设置环境配置失败:', error)
  }
}

export function trySwitchEnv(targetEnv: AppEnvType, password?: string): boolean {
  if (targetEnv === AppEnvType.INTERNAL_TEST && password !== TEST_ENV_PASSWORD) {
    return false
  }
  forceSetEnvType(targetEnv)
  return true
}

export function getEnvDisplayName(): string {
  return getIsInternalTest() ? 'Joined Testflight' : ''
}

/**
 * 获取 API Base URL
 * - H5 网页开发环境 (localhost / 127.0.0.1) 下置空，走 Vite 代理解决跨域 (CORS) 问题
 * - App / 小程序 / 生产环境 下直接使用 https://www.imates.com.cn 域名
 */
export function getApiBaseUrl(): string {
  // #ifdef H5
  return ''
  // #endif
  return ADDRESS_CATALOG.IMATES_HTTP
}

export function getYanbanBaseUrl(): string {
  // #ifdef H5
  return ''
  // #endif
  return getIsInternalTest() ? ADDRESS_CATALOG.IMATES_HTTP : ADDRESS_CATALOG.YANBAN_RELEASE
}

export function getApiPaths() {
  if (getIsInternalTest()) {
    return {
      xueban: {
        admin: {
          login: '/xb-test/admin/login',
          info: '/xb-test/admin/info',
        },
        ai: {
          base: '/xb-test/ai',
          chats: '/xb-test/ai/2.0/chats',
          chat: '/xb-test/ai/2.0/chat',
          chatMath: '/xb-test/ai/2.0/chatMath',
          previewPictureQA: '/xb-test/ai/2.0/previewPictureQA'
        },
        biologyTopicKnowledge: {
          knowledgeTopicAndAck: '/xb-test/biologyTopicKnowledge/knowledgeTopicAndAck',
        }
      },
      yanban: {
        auth: {
          loginStudent: '/yb-test/blw-edu-yb/auth/login-student',
        },
        homework: {
          submitJudgeDetail: '/yb-test/blw-edu-yb/api/app/homework-submit-judge-detail',
          undoList: '/yb-test/blw-edu-yb/api/app/homework-undo-list',
          detailList: '/yb-test/blw-edu-yb/api/app/homework-detail-list',
          submitSave: '/yb-test/blw-edu-yb/api/app/homework-submit-save',
        },
        textbook: {
          teacherTextbook: '/yb-test/blw-edu-yb/api/app/teacher-textbook',
          teacherTextbookSectionTree: '/yb-test/blw-edu-yb/api/app/teacher-textbook-section-tree',
          teacherTextbookLearningPackage: '/yb-test/blw-edu-yb/api/app/teacher-textbook-learning-package',
        }
      }
    }
  }
  return {
    xueban: {
      admin: {
        login: '/xb-release/admin/login',
        info: '/xb-release/admin/info',
      },
      ai: {
        base: '/xb-release/ai',
        chats: '/xb-release/ai/2.0/chats',
        chat: '/xb-release/ai/2.0/chat',
        chatMath: '/xb-release/ai/2.0/chatMath',
        previewPictureQA: '/xb-release/ai/2.0/previewPictureQA'
      },
      biologyTopicKnowledge: {
        knowledgeTopicAndAck: '/xb-release/biologyTopicKnowledge/knowledgeTopicAndAck',
      }
    },
    yanban: {
      auth: {
        loginStudent: '/yb-release/blw-edu-yb/auth/login-student',
      },
      homework: {
        submitJudgeDetail: '/yb-release/blw-edu-yb/api/app/homework-submit-judge-detail',
        undoList: '/yb-release/blw-edu-yb/api/app/homework-undo-list',
        detailList: '/yb-release/blw-edu-yb/api/app/homework-detail-list',
        submitSave: '/yb-release/blw-edu-yb/api/app/homework-submit-save',
      },
      textbook: {
        teacherTextbook: '/yb-release/blw-edu-yb/api/app/teacher-textbook',
        teacherTextbookSectionTree: '/yb-release/blw-edu-yb/api/app/teacher-textbook-section-tree',
        teacherTextbookLearningPackage: '/yb-release/blw-edu-yb/api/app/teacher-textbook-learning-package',
      }
    }
  }
}

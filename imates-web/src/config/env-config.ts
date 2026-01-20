/**
 * 应用环境配置
 * 对齐 Android AppEnvConfig 的环境切换逻辑
 */

import { getCurrentSchoolAppUpdatePath } from './school-app-config'

// 环境类型枚举
export enum AppEnvType {
  RELEASE = 'RELEASE',
  INTERNAL_TEST = 'INTERNAL_TEST',
}

export interface ApiPaths {
  previewPictureQA: string
  chat: string
  chatMath: string
  chats: string
  reviewExplainChatSX: string
}

// 环境配置接口
interface EnvConfig {
  baseUrl: string
  resourceBaseUrl: string
  yanbanBaseUrl: string
  historyManageBaseUrl: string
  imServiceBaseUrl: string
  apiPaths: ApiPaths
  mqHost: string
  mqPort: number
  appUpdateUrl: string
  displayName: string
}

// 环境配置映射
const ENV_CONFIGS: Record<AppEnvType, EnvConfig> = {
  [AppEnvType.RELEASE]: {
    baseUrl: 'http://www.imates.com.cn:8222/blw-edu-service-alc',
    // 资源服务器：与 VITE_RESOURCE_FILE_BASE 保持一致，使用 9099 端口
    resourceBaseUrl: 'https://www.imates.com.cn:9099',
    // 研伴正式环境：使用 HTTPS 访问 9099 端口
    // yanbanBaseUrl: 'https://www.imates.com.cn:9099',
    yanbanBaseUrl: 'http://localhost:8080/blw-edu-yb',
    // IM即时通讯服务
    imServiceBaseUrl: 'https://www.imates.com.cn',
    historyManageBaseUrl: 'https://u389082-a353-35fba22b.westb.seetacloud.com:8443',
    apiPaths: {
      previewPictureQA: '/ai/2.0/previewPictureQA',
      chat: '/ai/2.0/chat',
      chatMath: '/ai/2.0/chatMath',
      chats: '/ai/2.0/chats',
      reviewExplainChatSX: '/ai/2.0/reviewExplainChatSX',
    },
    mqHost: 'www.imates.com.cn',
    mqPort: 5673,
    // 这里只存一个默认路径，实际返回由 getAppUpdateUrl 结合 SCHOOL_UPDATE_CONFIGS 计算
    appUpdateUrl: '/bj101/appupdate.json',
    displayName: '',
  },
  [AppEnvType.INTERNAL_TEST]: {
    baseUrl: 'http://www.imates.com.cn:58443/blw-edu-service-alc',
    // 测试环境资源服务器同样通过 9099 提供 /resource 路径
    resourceBaseUrl: 'https://www.imates.com.cn:9099',
    // 研伴测试环境：使用 HTTPS 访问 50013 端口
    // yanbanBaseUrl: 'https://www.imates.com.cn:9099',
    yanbanBaseUrl: 'https://43.138.16.5:50013',
    // IM即时通讯服务（测试环境使用相同地址）
    imServiceBaseUrl: 'https://www.imates.com.cn',
    historyManageBaseUrl: 'https://u389082-a353-35fba22b.westb.seetacloud.com:8443',
    apiPaths: {
      previewPictureQA: '/ai/2.0/previewPictureQA',
      chat: '/ai/2.0/chat',
      chatMath: '/ai/2.0/chatMath',
      chats: '/ai/2.0/chats',
      reviewExplainChatSX: '/ai/2.0/reviewExplainChatSX',
    },
    mqHost: 'www.imates.com.cn',
    mqPort: 5673,
    appUpdateUrl: '/appupdate_test.json',
    displayName: 'Joined Testflight',
  },
}

// localStorage 键名
const STORAGE_KEY = 'app_env_type'

// 研伴原生登录开关 特殊情况下（经开中学公开课配置）
let yanbanNativeEnabledOverride: boolean | null = false

export function getYanbanNativeEnabled(): boolean {
  if (yanbanNativeEnabledOverride !== null) return yanbanNativeEnabledOverride
  return getCurrentEnvType() === AppEnvType.INTERNAL_TEST
}

export function setYanbanNativeEnabled(enabled: boolean): void {
  yanbanNativeEnabledOverride = enabled
}

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
export function getCurrentEnvConfig(): EnvConfig {
  const envType = getCurrentEnvType()
  return ENV_CONFIGS[envType]
}

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
  return getCurrentEnvConfig().displayName
}

/**
 * 获取 API Base URL
 */
export function getApiBaseUrl(): string {
  return getCurrentEnvConfig().baseUrl
}

/**
 * 获取资源 Base URL
 */
export function getResourceBaseUrl(): string {
  return getCurrentEnvConfig().resourceBaseUrl
}

/**
 * 获取研伴/题包服务 Base URL
 */
export function getYanbanBaseUrl(): string {
  return getCurrentEnvConfig().yanbanBaseUrl
}

/**
 * 获取对话记忆管理服务 Base URL
 */
export function getHistoryManageBaseUrl(): string {
  return getCurrentEnvConfig().historyManageBaseUrl
}

/**
 * 获取 MQ Host
 */
export function getMqHost(): string {
  return getCurrentEnvConfig().mqHost
}

/**
 * 获取 MQ Port
 */
export function getMqPort(): number {
  return getCurrentEnvConfig().mqPort
}

/**
 * 获取 IM 服务完整基础URL（包含协议和域名）
 */
export function getImBaseUrl(): string {
  return getCurrentEnvConfig().imServiceBaseUrl || 'https://www.imates.com.cn'
}

/**
 * 获取应用更新接口 URL
 */
export function getAppUpdateUrl(): string {
  const envType = getCurrentEnvType()
  const envConfig = ENV_CONFIGS[envType]

  // 测试环境：仍然使用固定的 /appupdate_test.json，由 http-client 路由到 https://www.imates.com.cn
  if (envType === AppEnvType.INTERNAL_TEST) {
    return envConfig.appUpdateUrl
  }

  // 其它环境：根据当前学校配置获取 appupdate.json 路径（由 school-app-config 统一维护）
  return getCurrentSchoolAppUpdatePath() || envConfig.appUpdateUrl
}

/**
 * 获取路由映射表（用于 file:// 环境下的路径映射）
 * 动态获取，根据当前环境返回不同的 Base URL
 */
export function getRouteBaseMap(): Record<string, string> {
  const apiBaseUrl = getApiBaseUrl()
  const resourceBaseUrl = getResourceBaseUrl()
  const yanbanBaseUrl = getYanbanBaseUrl()
  const historyManageBaseUrl = getHistoryManageBaseUrl()

  return {
    // 应用更新配置（/bj101/appupdate.json）永远走学班服务
    '/bj101': 'https://www.imates.com.cn',
    // 学班服务（根据环境动态切换）
    '/admin': apiBaseUrl,
    '/permission': apiBaseUrl,
    '/ai': apiBaseUrl,
    '/history_manage': historyManageBaseUrl,
    '/biologyTopicKnowledge': apiBaseUrl,
    // 研伴API服务（根据环境动态切换）
    '/api': yanbanBaseUrl,
    '/homework': yanbanBaseUrl,
    // 研伴/教材等走资源服务器
    '/blw-edu-yb': yanbanBaseUrl,
    // Zammad 示例
    '/api/v1': 'http://app.imates.com.cn:8080',
    // 资源服务器（根据环境动态切换）
    '/resource': resourceBaseUrl,
    '/img': resourceBaseUrl,
    // 知识点查询服务
    '/knowledge': 'http://www.imates.com.cn:8090',
    // 经开二中的应用更新配置（/jinkai/update.json）
    '/jinkai': resourceBaseUrl,
    '/appupdate_test.json': 'https://www.imates.com.cn',
  }
}

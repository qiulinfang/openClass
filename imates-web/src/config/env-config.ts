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

// 环境配置接口
interface EnvConfig {
  baseUrl: string
  resourceBaseUrl: string
  yanbanBaseUrl: string
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
    yanbanBaseUrl: 'https://www.imates.com.cn:9099',
    // 这里只存一个默认路径，实际返回由 getAppUpdateUrl 结合 SCHOOL_UPDATE_CONFIGS 计算
    appUpdateUrl: '/bj101/appupdate.json',
    displayName: '',
  },
  [AppEnvType.INTERNAL_TEST]: {
    baseUrl: 'http://www.imates.com.cn:9222/blw-edu-service-alc',
    // 测试环境资源服务器同样通过 9099 提供 /resource 路径
    resourceBaseUrl: 'https://www.imates.com.cn:9099',
    // 研伴测试环境：使用 HTTPS 访问 50013 端口
    yanbanBaseUrl: 'https://43.138.16.5:50013',
    appUpdateUrl: '/appupdate_test.json',
    displayName: 'Joined Testflight',
  },
}

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

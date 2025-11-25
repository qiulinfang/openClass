/**
 * 应用环境配置
 * 对齐 Android AppEnvConfig 的环境切换逻辑
 */

// 环境类型枚举
export enum AppEnvType {
  RELEASE = 'RELEASE',
  INTERNAL_TEST = 'INTERNAL_TEST',
}

// 环境配置接口
interface EnvConfig {
  baseUrl: string
  resourceBaseUrl: string
  appUpdateUrl: string
  displayName: string
}

// 环境配置映射
const ENV_CONFIGS: Record<AppEnvType, EnvConfig> = {
  [AppEnvType.RELEASE]: {
    baseUrl: 'http://www.imates.com.cn:8222/blw-edu-service-alc',
    resourceBaseUrl: 'https://www.imates.com.cn',
    appUpdateUrl: '/bj101/appupdate.json',
    displayName: '',
  },
  [AppEnvType.INTERNAL_TEST]: {
    baseUrl: 'https://api.showcode.xyz/blw-edu-service-alc',
    resourceBaseUrl: 'https://www.showcode.xyz',
    appUpdateUrl: '/appupdate_test.json',
    displayName: 'Joined Testflight',
  },
}

// localStorage 键名
const STORAGE_KEY = 'app_env_type'

// 测试环境切换密码
const TEST_ENV_PASSWORD = '148259'

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
 * 获取应用更新接口 URL
 */
export function getAppUpdateUrl(): string {
  return getCurrentEnvConfig().appUpdateUrl
}

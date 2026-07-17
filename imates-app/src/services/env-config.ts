import { storage } from './storage';

// 环境类型枚举
export enum AppEnvType {
  RELEASE = 'RELEASE',
  INTERNAL_TEST = 'INTERNAL_TEST',
}

const STORAGE_KEY = 'app_env_type';
const TEST_ENV_PASSWORD = '985211';

// 当前在内存中缓存的环境，以支持同步读取
let currentEnvCache: AppEnvType = AppEnvType.RELEASE;

// 初始化环境缓存
export async function initEnvConfig(): Promise<void> {
  try {
    const stored = await storage.getItem(STORAGE_KEY);
    if (stored && Object.values(AppEnvType).includes(stored as AppEnvType)) {
      currentEnvCache = stored as AppEnvType;
    }
  } catch (error) {
    console.warn('[EnvConfig] 初始化环境配置失败:', error);
  }
}

/**
 * 获取当前环境类型（同步读取缓存）
 */
export function getCurrentEnvType(): AppEnvType { 
  return currentEnvCache;
}

/**
 * 获取当前环境配置
 */
export const getIsInternalTest = (): boolean => getCurrentEnvType() === AppEnvType.INTERNAL_TEST;

/**
 * 获取环境显示名称
 */
export function getEnvDisplayName(): string {
  return getIsInternalTest() ? 'Joined Testflight' : '';
}

/**
 * 强制设置环境类型
 */
export async function forceSetEnvType(envType: AppEnvType): Promise<void> {
  try {
    if (currentEnvCache !== envType) {
      // 测试、正式环境的研伴 Token 不通用，切换后必须重新获取。
      await storage.removeItem('YANBAN_TOKEN');
    }
    currentEnvCache = envType;
    await storage.setItem(STORAGE_KEY, envType);
    console.log('[EnvConfig] 环境已切换为:', envType);
  } catch (error) {
    console.error('[EnvConfig] 设置环境配置失败:', error);
  }
}

/**
 * 尝试切换环境（需要密码验证）
 * @returns 是否切换成功
 */
export async function trySwitchEnv(targetEnv: AppEnvType, password?: string): Promise<boolean> {
  if (targetEnv === AppEnvType.INTERNAL_TEST && password !== TEST_ENV_PASSWORD) {
    return false;
  }
  await forceSetEnvType(targetEnv);
  return true;
}

/**
 * 获取应用更新接口 URL
 */
export function getAppUpdateUrl(): string {
  return '/bj101/appupdate.json';
}

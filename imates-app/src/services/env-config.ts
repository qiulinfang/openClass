import { storage } from './storage';

// 环境类型枚举
export enum AppEnvType {
  RELEASE = 'RELEASE',
  INTERNAL_TEST = 'INTERNAL_TEST',
}

const STORAGE_KEY = 'app_env_type_v2';
const LEGACY_STORAGE_KEY = 'app_env_type';
const TEST_ENV_PASSWORD = '985211';

const parseEnvType = (value?: string): AppEnvType | null =>
  value && Object.values(AppEnvType).includes(value as AppEnvType)
    ? value as AppEnvType
    : null;

// Expo 会在构建时内联 EXPO_PUBLIC_*。EAS 测试/正式包以此为权威环境来源。
const bundledEnvType = parseEnvType(process.env.EXPO_PUBLIC_APP_ENV);
const lockedRuntimeEnv = bundledEnvType;
const runtimeDefaultEnv = bundledEnvType ??
  (__DEV__ ? AppEnvType.INTERNAL_TEST : AppEnvType.RELEASE);

// 当前在内存中缓存的环境，以支持接口层同步读取。
let currentEnvCache: AppEnvType = runtimeDefaultEnv;

async function clearEnvironmentTokens(): Promise<void> {
  await Promise.all([
    storage.removeItem('YANBAN_TOKEN'),
    storage.removeItem('XUEBAN_TOKEN'),
  ]);
}

// 初始化环境缓存
export async function initEnvConfig(): Promise<void> {
  try {
    const [storedValue, legacyValue] = await Promise.all([
      storage.getItem(STORAGE_KEY),
      storage.getItem(LEGACY_STORAGE_KEY),
    ]);
    const storedEnv = parseEnvType(storedValue || undefined);
    const legacyEnv = parseEnvType(legacyValue || undefined);
    const resolvedEnv = lockedRuntimeEnv ?? storedEnv ?? runtimeDefaultEnv;
    const previousEnv = storedEnv ?? legacyEnv;

    // 测试包/正式包切换，或首次迁移旧配置时，旧 Token 不能跨环境复用。
    if (previousEnv !== resolvedEnv) {
      await clearEnvironmentTokens();
    }
    currentEnvCache = resolvedEnv;
    await storage.setItem(STORAGE_KEY, resolvedEnv);
    console.log('[EnvConfig] 环境初始化完成:', {
      env: resolvedEnv,
      source: bundledEnvType
        ? 'build'
        : __DEV__
          ? '__DEV__'
          : storedEnv
            ? 'storage'
            : 'default',
    });
  } catch (error) {
    console.warn('[EnvConfig] 初始化环境配置失败:', error);
    currentEnvCache = runtimeDefaultEnv;
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
    if (lockedRuntimeEnv && envType !== lockedRuntimeEnv) {
      console.warn('[EnvConfig] 当前运行模式已锁定环境，忽略运行时切换:', lockedRuntimeEnv);
      return;
    }
    if (currentEnvCache !== envType) {
      // 测试、正式环境的登录态均不通用，切换后必须重新登录。
      await clearEnvironmentTokens();
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
  if (lockedRuntimeEnv && targetEnv !== lockedRuntimeEnv) {
    return false;
  }
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

import { Platform } from 'react-native';
import { AppEnvType, getCurrentEnvType } from './env-config';

const isInternalTest = (): boolean =>
  getCurrentEnvType() === AppEnvType.INTERNAL_TEST;

const normalizePath = (path: string): string =>
  path === '' || path.startsWith('/') ? path : `/${path}`;

/**
 * 学伴接口：Web 走 Metro/Nginx 同源代理，原生端走同一套 HTTPS 路由。
 * Android release 默认禁止 HTTP 明文流量，登录凭据也不应通过 HTTP 发送。
 */
export const getXuebanApiUrl = (path: string): string => {
  const normalizedPath = normalizePath(path);
  const routedPath = `${isInternalTest() ? '/xb-test' : '/xb-release'}${normalizedPath}`;
  if (Platform.OS === 'web') {
    return routedPath;
  }
  return `https://www.imates.com.cn${routedPath}`;
};

/**
 * 研伴接口：Web 使用同源 /yb-test 或 /yb-release，原生端使用 HTTPS 绝对地址。
 */
export const getYanbanApiUrl = (path: string): string => {
  const normalizedPath = normalizePath(path);
  const prefix = isInternalTest() ? '/yb-test' : '/yb-release';
  const routedPath = `${prefix}/blw-edu-yb${normalizedPath}`;
  return Platform.OS === 'web'
    ? routedPath
    : `https://www.imates.com.cn${routedPath}`;
};

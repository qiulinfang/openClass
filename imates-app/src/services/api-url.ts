import { Platform } from 'react-native';
import { AppEnvType, getCurrentEnvType } from './env-config';

const isInternalTest = (): boolean =>
  getCurrentEnvType() === AppEnvType.INTERNAL_TEST;

const normalizePath = (path: string): string =>
  path === '' || path.startsWith('/') ? path : `/${path}`;

/**
 * 学伴接口：Web 走 Metro/Nginx 同源代理，原生端直连对应环境端口。
 * 同源代理可确保浏览器真正发送 Token、sa-token、authorization 请求头。
 */
export const getXuebanApiUrl = (path: string): string => {
  const normalizedPath = normalizePath(path);
  if (Platform.OS === 'web') {
    return `${isInternalTest() ? '/xb-test' : '/xb-release'}${normalizedPath}`;
  }
  const port = isInternalTest() ? '58443' : '8222';
  return `http://www.imates.com.cn:${port}/blw-edu-service-alc${normalizedPath}`;
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

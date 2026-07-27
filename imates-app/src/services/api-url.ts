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
 * 课节知识点查询服务。
 *
 * Web 端通过 Metro/Nginx 的同源代理访问。原生端不能使用主站的 HTTPS
 * `/knowledge` 路由：该路由当前会把 HTTPS 流量错误地转发给 HTTP 上游并返回
 * 400，因此直接访问仅提供 HTTP 的 8090 服务。此接口不携带任何登录凭据。
 */
export const getKnowledgeApiUrl = (): string =>
  Platform.OS === 'web'
    ? '/knowledge'
    : 'http://www.imates.com.cn:8090/knowledge';

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

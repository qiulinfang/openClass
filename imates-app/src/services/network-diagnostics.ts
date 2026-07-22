import { Platform } from 'react-native';
import { getXuebanApiUrl } from './api-url';
import { getBuildDisplayName, getCurrentEnvType, isInternalBuild } from './env-config';

export const isDetailedDiagnosticsEnabled = (): boolean =>
  isInternalBuild();

export async function runLoginNetworkDiagnostics(): Promise<string> {
  const env = getCurrentEnvType();
  const url = getXuebanApiUrl('/admin/login');
  const startedAt = Date.now();
  const lines = [
    `诊断时间: ${new Date().toISOString()}`,
    `构建模式: ${getBuildDisplayName()}`,
    `运行环境: ${env}`,
    `平台: ${Platform.OS} ${String(Platform.Version)}`,
    `登录地址: ${url}`,
  ];

  try {
    const response = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        Accept: 'application/json',
      },
    });
    const body = await response.text();
    lines.push(
      `连接结果: 已连接服务器`,
      `HTTP 状态: ${response.status} ${response.statusText || ''}`.trim(),
      `耗时: ${Date.now() - startedAt} ms`,
      `响应体: ${body || '<空>'}`,
    );
  } catch (error) {
    lines.push(
      '连接结果: 失败',
      `耗时: ${Date.now() - startedAt} ms`,
      `底层错误: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
      error instanceof Error && error.stack ? `调用栈:\n${error.stack}` : '',
    );
  }

  return lines.filter(Boolean).join('\n\n');
}

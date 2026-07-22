export interface ApiErrorDetails {
  requestId: string;
  method: string;
  url: string;
  durationMs: number;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  causeName?: string;
  causeMessage?: string;
}

export class ApiRequestError extends Error {
  readonly details: ApiErrorDetails;

  constructor(message: string, details: ApiErrorDetails) {
    super(message);
    this.name = 'ApiRequestError';
    this.details = details;
  }
}

const stringifyUnknown = (value: unknown): string => {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const formatApiError = (error: unknown): string => {
  if (!(error instanceof ApiRequestError)) {
    return stringifyUnknown(error);
  }

  const details = error.details;
  return [
    `错误类型: ${error.name}`,
    `错误信息: ${error.message}`,
    `请求 ID: ${details.requestId}`,
    `请求: ${details.method} ${details.url}`,
    `耗时: ${details.durationMs} ms`,
    `HTTP 状态: ${details.status ?? '未收到响应'}${details.statusText ? ` ${details.statusText}` : ''}`,
    details.causeName ? `底层错误: ${details.causeName}: ${details.causeMessage ?? ''}` : '',
    details.responseHeaders
      ? `响应头:\n${JSON.stringify(details.responseHeaders, null, 2)}`
      : '',
    details.responseBody ? `响应体:\n${details.responseBody}` : '',
    error.stack ? `调用栈:\n${error.stack}` : '',
  ].filter(Boolean).join('\n\n');
};

export const getPublicErrorMessage = (error: unknown): string => {
  if (error instanceof ApiRequestError) {
    if (error.details.status === undefined) {
      return '无法连接服务器，请检查网络后重试';
    }
    if (error.details.status >= 500) {
      return '服务器暂时不可用，请稍后重试';
    }
    return error.message || '登录失败，请检查账号密码';
  }
  return error instanceof Error && error.message
    ? error.message
    : '登录失败，请稍后重试';
};


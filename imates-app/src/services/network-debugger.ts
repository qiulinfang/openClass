import { getBuildChannel, getCurrentEnvType, isInternalBuild } from './env-config';

export interface NetworkDebugEntry {
  id: string;
  startedAt: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  error?: string;
  completed: boolean;
}

type NetworkListener = () => void;

const MAX_ENTRIES = 200;
const MAX_BODY_LENGTH = 20_000;
const SECRET_KEY_PATTERN = /password|passwd|pass|token|authorization|cookie|secret|credential/i;
const listeners = new Set<NetworkListener>();
let entries: NetworkDebugEntry[] = [];
let installed = false;

const notify = () => listeners.forEach((listener) => listener());

const redactValue = (value: unknown, key = ''): unknown => {
  if (SECRET_KEY_PATTERN.test(key)) return '***REDACTED***';
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([childKey, childValue]) => [childKey, redactValue(childValue, childKey)]),
    );
  }
  return value;
};

const limitText = (text: string): string =>
  text.length > MAX_BODY_LENGTH
    ? `${text.slice(0, MAX_BODY_LENGTH)}\n… 已截断 ${text.length - MAX_BODY_LENGTH} 个字符`
    : text;

const sanitizeText = (text: string): string => {
  if (!text) return '<空>';
  try {
    return limitText(JSON.stringify(redactValue(JSON.parse(text)), null, 2));
  } catch {
    return limitText(text);
  }
};

const sanitizeUrl = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.forEach((value, key) => {
      if (SECRET_KEY_PATTERN.test(key)) parsed.searchParams.set(key, '***REDACTED***');
    });
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

const headersToRecord = (headers?: HeadersInit): Record<string, string> => {
  const record: Record<string, string> = {};
  if (!headers) return record;
  try {
    new Headers(headers).forEach((value, key) => {
      record[key] = SECRET_KEY_PATTERN.test(key) ? '***REDACTED***' : value;
    });
  } catch {
    record['capture-error'] = '无法解析请求头';
  }
  return record;
};

const bodyToText = (body: BodyInit | null | undefined): string => {
  if (body == null) return '<空>';
  if (typeof body === 'string') return sanitizeText(body);
  if (body instanceof URLSearchParams) return sanitizeText(body.toString());
  return `<${body.constructor?.name || typeof body}，未展开>`;
};

const upsertEntry = (entry: NetworkDebugEntry) => {
  const existingIndex = entries.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    entries = entries.map((item) => item.id === entry.id ? entry : item);
  } else {
    entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  }
  notify();
};

export const installNetworkDebugger = () => {
  if (installed || !isInternalBuild() || typeof globalThis.fetch !== 'function') return;
  installed = true;
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const [input, init] = args;
    const requestLike = typeof input === 'string' || input instanceof URL ? null : input;
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const method = (init?.method || requestLike?.method || 'GET').toUpperCase();
    const id = `net-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const started = Date.now();
    const baseEntry: NetworkDebugEntry = {
      id,
      startedAt: new Date(started).toISOString(),
      method,
      url: sanitizeUrl(rawUrl),
      requestHeaders: headersToRecord(init?.headers || requestLike?.headers),
      requestBody: bodyToText(init?.body),
      completed: false,
    };
    upsertEntry(baseEntry);

    try {
      const response = await originalFetch(...args);
      const responseHeaders = headersToRecord(response.headers);
      const completedEntry: NetworkDebugEntry = {
        ...baseEntry,
        status: response.status,
        statusText: response.statusText,
        durationMs: Date.now() - started,
        responseHeaders,
        responseBody: '<读取中>',
        completed: true,
      };
      upsertEntry(completedEntry);

      response.clone().text()
        .then((body) => upsertEntry({
          ...completedEntry,
          responseBody: sanitizeText(body),
        }))
        .catch((error) => upsertEntry({
          ...completedEntry,
          responseBody: `<响应体读取失败: ${error instanceof Error ? error.message : String(error)}>`,
        }));
      return response;
    } catch (error) {
      const errorText = error instanceof Error
        ? `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`
        : String(error);
      upsertEntry({
        ...baseEntry,
        durationMs: Date.now() - started,
        error: errorText,
        completed: true,
      });
      throw error;
    }
  }) as typeof fetch;
};

export const subscribeNetworkEntries = (listener: NetworkListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getNetworkEntries = (): NetworkDebugEntry[] => entries;

export const clearNetworkEntries = () => {
  entries = [];
  notify();
};

export const exportNetworkDebugReport = (): string => JSON.stringify({
  generatedAt: new Date().toISOString(),
  buildChannel: getBuildChannel(),
  apiEnvironment: getCurrentEnvType(),
  entries,
}, null, 2);


import { DeviceEventEmitter, Platform } from 'react-native';
import { storage } from './storage';
import { getXuebanApiUrl, getYanbanApiUrl, getImagesUploadUrl } from './api-url';

export interface HttpRequestConfig extends RequestInit {
  headers?: Record<string, string>;
  skipToken?: boolean;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  ok: boolean;
  headers: Headers;
}

export class HttpClient {
  /**
   * 智能匹配与解析 API 完整 URL：
   * - 已经以 http/https 开头的完整 URL 直接返回；
   * - /api/images/upload 特殊图片上传接口解析为专用 CDN/代理入口；
   * - 以 /permission 开头的学伴接口解析为 Xueban 架构 URL；
   * - 默认路由走 Yanban 接口基础解析。
   */
  public static resolveUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    if (path === '/api/images/upload') {
      return getImagesUploadUrl();
    }
    if (path.startsWith('/permission')) {
      return getXuebanApiUrl(path);
    }
    return getYanbanApiUrl(path);
  }

  /**
   * 自动获取有效 Auth Token：
   * - 学伴路径 (/permission 等) 优先读取 XUEBAN_TOKEN，研伴路径优先读取 YANBAN_TOKEN；
   * - 防止使用研伴 Token 请求学伴服务端产生 401 鉴权失败。
   */
  private static async getAuthHeaders(urlPath: string): Promise<Record<string, string>> {
    try {
      const isXuebanPath = urlPath.startsWith('/permission') || urlPath.startsWith('/xb-');
      const primaryTokenKey = isXuebanPath ? 'XUEBAN_TOKEN' : 'YANBAN_TOKEN';
      const secondaryTokenKey = isXuebanPath ? 'YANBAN_TOKEN' : 'XUEBAN_TOKEN';

      const primaryToken = await storage.getItem(primaryTokenKey);
      const secondaryToken = await storage.getItem(secondaryTokenKey);

      const token = (primaryToken || secondaryToken || '').trim();
      if (!token) return {};
      return {
        'Token': token,
        'sa-token': token,
        'authorization': token,
      };
    } catch {
      return {};
    }
  }

  /**
   * 统一网络请求核心构建方法
   */
  private static async request<T = any>(
    urlPath: string,
    config: HttpRequestConfig = {}
  ): Promise<T> {
    const fullUrl = this.resolveUrl(urlPath);
    const authHeaders = config.skipToken ? {} : await this.getAuthHeaders(urlPath);

    const headers: Record<string, string> = {
      ...authHeaders,
      ...(config.headers || {}),
    };

    // 如果未设置 Content-Type 且 body 为对象，默认设为 application/json
    if (
      config.body &&
      !(config.body instanceof FormData) &&
      !headers['Content-Type'] &&
      !headers['content-type']
    ) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(fullUrl, {
        ...config,
        headers,
      });

      // 401 统一拦截
      if (response.status === 401) {
        await storage.removeItem('XUEBAN_TOKEN');
        await storage.removeItem('YANBAN_TOKEN');
        DeviceEventEmitter.emit('FORCE_LOGOUT', {
          message: '设备已经在其他地方登陆，请重新登录。',
        });
        throw new Error('设备已经在其他地方登陆');
      }

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      // 自动尝试解析 JSON 响应
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }

      const textData = await response.text();
      try {
        return JSON.parse(textData);
      } catch {
        return textData as unknown as T;
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * GET 请求
   */
  public static async get<T = any>(
    path: string,
    config?: HttpRequestConfig
  ): Promise<T> {
    return this.request<T>(path, { ...config, method: 'GET' });
  }

  /**
   * POST JSON 请求
   */
  public static async post<T = any>(
    path: string,
    data?: any,
    config?: HttpRequestConfig
  ): Promise<T> {
    return this.request<T>(path, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * POST FormData 上传文件请求
   */
  public static async postFormData<T = any>(
    path: string,
    formData: FormData,
    config?: HttpRequestConfig
  ): Promise<T> {
    return this.request<T>(path, {
      ...config,
      method: 'POST',
      body: formData,
    });
  }

  /**
   * DELETE 请求
   */
  public static async delete<T = any>(
    path: string,
    config?: HttpRequestConfig
  ): Promise<T> {
    return this.request<T>(path, { ...config, method: 'DELETE' });
  }
}

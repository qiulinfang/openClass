import { getApiBaseUrl, getImBaseUrl } from '../config/env-config';

interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message: string;
  code: number;
}

export class HttpClient {
  private async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const { url, method = 'GET', data, header = {} } = config;

    // Build full URL
    let fullUrl = url;
    if (!url.startsWith('http')) {
      // Logic to decide base URL based on path, similar to imates-web
      if (url.startsWith('/xb-') || url.startsWith('/yb-')) {
        fullUrl = `${getApiBaseUrl()}${url}`;
      } else if (url.startsWith('/api/')) {
        fullUrl = `${getImBaseUrl()}${url}`;
      }
    }

    // Auth headers
    const token = uni.getStorageSync('XUEBAN_TOKEN') || uni.getStorageSync('YANBAN_TOKEN');
    if (token) {
      header['Token'] = token;
      header['sa-token'] = token;
      header['authorization'] = token;
    }

    return new Promise((resolve) => {
      uni.request({
        url: fullUrl,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          ...header,
        },
        success: (res) => {
          const data = res.data as any;
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300 && (data.success !== false),
            data: data,
            message: data.message || data.msg || '',
            code: data.code || res.statusCode,
          });
        },
        fail: (err) => {
          resolve({
            success: false,
            data: null as any,
            message: err.errMsg || '网络请求失败',
            code: 0,
          });
        },
      });
    });
  }

  get<T>(url: string, data?: any, header?: any) {
    return this.request<T>({ url, method: 'GET', data, header });
  }

  post<T>(url: string, data?: any, header?: any) {
    return this.request<T>({ url, method: 'POST', data, header });
  }
}

export const httpClient = new HttpClient();

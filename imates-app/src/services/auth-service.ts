import { storage } from './storage';
import { getXuebanApiUrl } from './api-url';
import { HomeworkService } from './homework-service';
import { ApiRequestError } from './api-error';

export interface UserInfo {
  id: string;
  name: string;
  avatar?: string;
  avatarNew?: string;
  role?: string;
}

// 统一的存储清理/读取助手
const sanitize = (value: string | null | undefined): string | null => {
  if (!value || value === 'undefined' || value.trim() === '') {
    return null;
  }
  return value;
};

// 学伴用户ID
export const getUserId = async (): Promise<string | null> => {
  const val = await storage.getItem('xuebanuserid');
  return sanitize(val);
};

// 学伴用户密码
export const getPassword = async (): Promise<string | null> => {
  const val = await storage.getItem('userPassword');
  return sanitize(val);
};

// 获取保存的用户信息
export const getUserInfo = async (): Promise<UserInfo | null> => {
  try {
    const stored = await storage.getItem('userInfo');
    if (!stored) return null;
    return JSON.parse(stored) as UserInfo;
  } catch {
    return null;
  }
};

export class AuthService {
  private static instance: AuthService;

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 获取当前环境下的 Base API 地址
   */
  private getApiBaseUrl(): string {
    return getXuebanApiUrl('');
  }

  /**
   * 学伴真实登录
   */
  public async loginXueban(account: string, password: string): Promise<string> {
    const baseUrl = this.getApiBaseUrl();
    const url = `${baseUrl}/admin/login`;
    const method = 'POST';
    const requestId = `login-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();
    console.log('[AuthService] 登录请求开始', { requestId, url, account });

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
        body: JSON.stringify({
          account,
          password,
        }),
      });
    } catch (cause) {
      const causeError = cause instanceof Error ? cause : new Error(String(cause));
      const error = new ApiRequestError('登录请求未到达服务器', {
        requestId,
        method,
        url,
        durationMs: Date.now() - startedAt,
        causeName: causeError.name,
        causeMessage: causeError.message,
      });
      console.error('[AuthService] 登录网络错误', error.details);
      throw error;
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    const responseBody = await response.text();
    let resJson: any;
    try {
      resJson = responseBody ? JSON.parse(responseBody) : null;
    } catch (cause) {
      const causeError = cause instanceof Error ? cause : new Error(String(cause));
      throw new ApiRequestError('登录接口返回了无法解析的数据', {
        requestId,
        method,
        url,
        durationMs: Date.now() - startedAt,
        status: response.status,
        statusText: response.statusText,
        responseHeaders,
        responseBody,
        causeName: causeError.name,
        causeMessage: causeError.message,
      });
    }

    if (!response.ok || !resJson?.success) {
      const error = new ApiRequestError(
        resJson?.message || `登录接口异常 (HTTP ${response.status})`,
        {
          requestId,
          method,
          url,
          durationMs: Date.now() - startedAt,
          status: response.status,
          statusText: response.statusText,
          responseHeaders,
          responseBody,
        },
      );
      console.error('[AuthService] 登录业务错误', error.details);
      throw error;
    }

    console.log('[AuthService] 登录请求成功', {
      requestId,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    const token = resJson.data?.data?.token || resJson.data?.token;
    if (!token) {
      throw new Error('未获取到有效的 Token');
    }

    // 保存到本地存储
    await storage.setItem('XUEBAN_TOKEN', token);
    await storage.setItem('xuebanuserid', account);
    await storage.setItem('userPassword', password);
    await storage.setItem('lastLoginTime', Date.now().toString());

    // 知识图谱属于研伴服务，主登录成功后同步刷新对应 Token。
    // 研伴暂时不可用时不阻断学伴主登录，知识图谱请求时仍会再次刷新。
    try {
      await HomeworkService.loginYanban(account, password);
    } catch (error) {
      await storage.removeItem('YANBAN_TOKEN');
      console.warn('[AuthService] 研伴同步登录失败，将在访问知识图谱时重试:', error);
    }

    return token;
  }

  /**
   * 获取真实用户信息
   */
  public async getUserInfo(token: string): Promise<UserInfo> {
    const baseUrl = this.getApiBaseUrl();
    const url = `${baseUrl}/admin/info?token=${token}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Token': token,
        'sa-token': token,
        'authorization': token,
      },
    });

    if (!response.ok) {
      throw new Error(`获取用户信息异常 (HTTP ${response.status})`);
    }

    const resJson = await response.json();
    if (!resJson.success || !resJson.data) {
      throw new Error(resJson.message || '获取用户信息失败');
    }

    const rawData = resJson.data?.data || resJson.data;
    const existingUserInfo = await getUserInfo();
    const userInfo: UserInfo = {
      id: rawData.id || '10001',
      name: rawData.name || rawData.username || '学伴用户',
      avatar: rawData.avatar || '',
      avatarNew: existingUserInfo?.avatarNew || '',
      role: rawData.role || 'STUDENT',
    };

    await storage.setItem('userInfo', JSON.stringify(userInfo));
    return userInfo;
  }

  /**
   * 登出清除数据
   */
  public async logout(): Promise<void> {
    await storage.removeItem('XUEBAN_TOKEN');
    await storage.removeItem('YANBAN_TOKEN');
    await storage.removeItem('userInfo');
  }
}

export const authService = AuthService.getInstance();

import { Platform } from 'react-native';
import { storage } from './storage';
import { AppEnvType, getCurrentEnvType } from './env-config';
import { HomeworkService } from './homework-service';

export interface UserInfo {
  id: string;
  name: string;
  avatar?: string;
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
    const env = getCurrentEnvType();
    if (Platform.OS === 'web') {
      return env === AppEnvType.INTERNAL_TEST ? '/xb-test' : '/xb-release';
    }
    if (env === AppEnvType.INTERNAL_TEST) {
      return 'http://www.imates.com.cn:58443/blw-edu-service-alc';
    }
    return 'http://www.imates.com.cn:8222/blw-edu-service-alc';
  }

  /**
   * 学伴真实登录
   */
  public async loginXueban(account: string, password: string): Promise<string> {
    console.log('[AuthService] 正在请求真实登录接口...', { account });

    const baseUrl = this.getApiBaseUrl();
    const url = `${baseUrl}/admin/login`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account,
        password,
      }),
    });

    if (!response.ok) {
      throw new Error(`登录接口网络异常 (HTTP ${response.status})`);
    }

    const resJson = await response.json();
    if (!resJson.success) {
      throw new Error(resJson.message || '登录失败，请检查账号密码');
    }

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
    const userInfo: UserInfo = {
      id: rawData.id || '10001',
      name: rawData.name || rawData.username || '学伴用户',
      avatar: rawData.avatar || '',
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

import CryptoJS from 'crypto-js';
import { httpClient } from '../utils/request';
import { getApiPaths, getCurrentEnvType, AppEnvType } from '../config/env-config';
import { showMessage } from '../utils';

export enum UserType {
  XUEBAN = 'XUEBAN',
  YANBAN = 'YANBAN'
}

const sanitize = (value: string | null | undefined): string | null => {
  if (!value || value === 'undefined' || value.trim() === '') {
    return null;
  }
  return value;
};

// Storage keys derived from imates-web
export const getUserId = (): string | null => sanitize(uni.getStorageSync('xuebanuserid'));
export const getPassword = (): string | null => sanitize(uni.getStorageSync('userPassword'));
export const getYanbanToken = (): string | null => sanitize(uni.getStorageSync('YANBAN_TOKEN'));
export const getXuebanToken = (): string | null => sanitize(uni.getStorageSync('XUEBAN_TOKEN'));

export const setYanbanToken = (token: string | null): void => {
  if (token === null) uni.removeStorageSync('YANBAN_TOKEN');
  else uni.setStorageSync('YANBAN_TOKEN', token);
};

export const setXuebanToken = (token: string | null): void => {
  if (token === null) uni.removeStorageSync('XUEBAN_TOKEN');
  else uni.setStorageSync('XUEBAN_TOKEN', token);
};

export const getCurrentYanbanUserId = (): string | null => {
  return sanitize(uni.getStorageSync('yanbanuserid'));
};

export const isYanbanLoggedIn = (): boolean => {
  const token = getYanbanToken();
  const userId = getCurrentYanbanUserId();
  return !!(token && userId);
};

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async handle401(): Promise<boolean> {
    try {
      showMessage('账号已在其他设备登录', 'warning', 2500);
    } catch {}

    this.forceLogoutToLogin();
    return false;
  }

  private forceLogoutToLogin(): void {
    try {
      uni.removeStorageSync('XUEBAN_TOKEN');
      uni.removeStorageSync('YANBAN_TOKEN');
      uni.removeStorageSync('userInfo');
      uni.removeStorageSync('yanbanuserid');
    } catch {}

    uni.reLaunch({ url: '/pages/login/login' });
  }

  public async loginXueban(account: string, password: string): Promise<string> {
    const response = await httpClient.post<any>(getApiPaths().xueban.admin.login, {
      account,
      password,
    });

    if (!response.success) {
      throw new Error(response.message || '登录失败');
    }

    const token = response.data?.data?.token;
    if (!token) {
      throw new Error('登录失败：未获取到token');
    }

    uni.setStorageSync('XUEBAN_TOKEN', token);
    uni.setStorageSync('xuebanuserid', account);
    uni.setStorageSync('userPassword', password);

    // Sync Yanban login
    try {
      await this.loginYanban(account, password);
    } catch (e) {
      console.warn('Yanban login failed', e);
    }

    return token;
  }

  public async loginYanban(account: string, password: string): Promise<any> {
    try {
      const md5Password = CryptoJS.MD5(password).toString();
      const endpoint = getApiPaths().yanban.auth.loginStudent;

      const response = await httpClient.post<any>(endpoint, {
        account,
        password: md5Password,
      });

      const tokenData = response.data?.data || response.data;

      if (response.success && tokenData && tokenData.token) {
        uni.setStorageSync('YANBAN_TOKEN', tokenData.token);
        uni.setStorageSync('yanbanuserid', tokenData.userId);
        return tokenData;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const authService = AuthService.getInstance();

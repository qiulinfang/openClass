import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const STORAGE_DIR = `${FileSystem.documentDirectory}storage/`;
const WEB_STORAGE_PREFIX = 'IMATES_STORAGE_';

/**
 * 确保存储文件夹目录存在
 */
async function ensureDirExists() {
  if (Platform.OS === 'web') return;

  try {
    const dirInfo = await FileSystem.getInfoAsync(STORAGE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(STORAGE_DIR, { intermediates: true });
    }
  } catch (e) {
    console.warn('[FileSystemStorage] 创建存储目录失败:', e);
  }
}

function safeFilename(key: string): string {
  return encodeURIComponent(key).replace(/:/g, '%3A');
}

/**
 * 应用级统一存储层服务 (App Storage Service):
 * 1. 基础 Key-Value 读写支持 (FileSystem 原生磁盘 + Web localStorage)；
 * 2. 泛型 JSON 自动序列化与反序列化 API (`getJSON`, `setJSON`)；
 * 3. 自动账号隔离 API (`getUserItem`, `setUserItem`, `getUserJSON`, `setUserJSON`)。
 */
class FileSystemStorage {
  private cache: Record<string, string> = {};
  private isLoaded = false;

  /**
   * 静默预载所有磁盘存储文件到内存中提高同步读性能
   */
  private async loadAll() {
    if (this.isLoaded) return;

    if (Platform.OS === 'web') {
      try {
        for (let index = 0; index < globalThis.localStorage.length; index += 1) {
          const storageKey = globalThis.localStorage.key(index);
          if (!storageKey?.startsWith(WEB_STORAGE_PREFIX)) continue;
          const key = decodeURIComponent(storageKey.slice(WEB_STORAGE_PREFIX.length));
          const value = globalThis.localStorage.getItem(storageKey);
          if (value !== null) this.cache[key] = value;
        }
      } catch (error) {
        console.warn('[WebStorage] 浏览器存储预载失败:', error);
      }
      this.isLoaded = true;
      return;
    }

    try {
      await ensureDirExists();
      const files = await FileSystem.readDirectoryAsync(STORAGE_DIR);
      for (const file of files) {
        try {
          const key = decodeURIComponent(file);
          const safeFile = file.includes(':') ? file.replace(/:/g, '%3A') : file;
          const fileUri = `${STORAGE_DIR}${safeFile}`;
          const content = await FileSystem.readAsStringAsync(fileUri);
          this.cache[key] = content;
        } catch (singleFileErr) {
          console.warn(`[FileSystemStorage] 忽略读取失败的单独存储文件 [${file}]:`, singleFileErr);
        }
      }
    } catch (e) {
      console.warn('[FileSystemStorage] 磁盘数据预载入失败:', e);
    }
    this.isLoaded = true;
  }

  /**
   * 提取当前登录用户的唯一标识账号 (自动从缓存中获取)
   */
  private async getCurrentUserId(): Promise<string> {
    const uid = await this.getItem('xuebanuserid');
    return uid?.trim() || 'anonymous';
  }

  /**
   * 生成包含当前登录账号隔离的 Storage Key
   */
  public async getUserKey(key: string): Promise<string> {
    const userId = await this.getCurrentUserId();
    return `USER_${encodeURIComponent(userId)}_${key}`;
  }

  // ================= 基础单 Key 读写 API =================

  async getItem(key: string): Promise<string | null> {
    await this.loadAll();
    const val = this.cache[key] || null;
    return val;
  }

  async getAllKeys(): Promise<string[]> {
    await this.loadAll();
    return Object.keys(this.cache);
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.loadAll();
    this.cache[key] = value;

    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage.setItem(
          `${WEB_STORAGE_PREFIX}${encodeURIComponent(key)}`,
          value
        );
      } catch (error) {
        console.warn(`[WebStorage] 浏览器存储写入失败 (Key: ${key}):`, error);
      }
      return;
    }

    try {
      await ensureDirExists();
      const fileUri = `${STORAGE_DIR}${safeFilename(key)}`;
      await FileSystem.writeAsStringAsync(fileUri, value);
    } catch (e) {
      console.warn(`[FileSystemStorage] 磁盘写入失败 (Key: ${key}):`, e);
    }
  }

  async removeItem(key: string): Promise<void> {
    await this.loadAll();
    delete this.cache[key];

    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage.removeItem(
          `${WEB_STORAGE_PREFIX}${encodeURIComponent(key)}`
        );
      } catch (error) {
        console.warn(`[WebStorage] 浏览器存储删除失败 (Key: ${key}):`, error);
      }
      return;
    }

    try {
      const fileUri = `${STORAGE_DIR}${safeFilename(key)}`;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri);
      }
    } catch (e) {
      console.warn(`[FileSystemStorage] 磁盘删除失败 (Key: ${key}):`, e);
    }
  }

  async clear(): Promise<void> {
    this.cache = {};

    if (Platform.OS === 'web') {
      try {
        const keysToRemove: string[] = [];
        for (let index = 0; index < globalThis.localStorage.length; index += 1) {
          const key = globalThis.localStorage.key(index);
          if (key?.startsWith(WEB_STORAGE_PREFIX)) keysToRemove.push(key);
        }
        keysToRemove.forEach((key) => globalThis.localStorage.removeItem(key));
      } catch (error) {
        console.warn('[WebStorage] 浏览器存储清理失败:', error);
      }
      return;
    }

    try {
      const dirInfo = await FileSystem.getInfoAsync(STORAGE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(STORAGE_DIR);
      }
      await ensureDirExists();
    } catch (e) {
      console.warn('[FileSystemStorage] 磁盘格式化失败:', e);
    }
  }

  // ================= 高级 JSON 序列化 API =================

  /**
   * 读取并解析 JSON 对象 (失败时自动返回 defaultValue 或 null)
   */
  async getJSON<T = any>(key: string, defaultValue?: T): Promise<T | null> {
    const str = await this.getItem(key);
    if (!str) return defaultValue ?? null;
    try {
      return JSON.parse(str) as T;
    } catch {
      return defaultValue ?? null;
    }
  }

  /**
   * 自动序列化并写入 JSON 对象
   */
  async setJSON<T = any>(key: string, value: T): Promise<void> {
    const str = JSON.stringify(value);
    await this.setItem(key, str);
  }

  // ================= 账号隔离高级 API (Account-Isolated API) =================

  /**
   * 读取包含账号隔离特性的字符串 (精确匹配当前用户账号 Key)
   */
  async getUserItem(key: string): Promise<string | null> {
    const userKey = await this.getUserKey(key);
    return await this.getItem(userKey);
  }

  /**
   * 写入包含账号隔离特性的字符串
   */
  async setUserItem(key: string, value: string): Promise<void> {
    const userKey = await this.getUserKey(key);
    await this.setItem(userKey, value);
  }

  /**
   * 删除包含账号隔离特性的存储记录
   */
  async removeUserItem(key: string): Promise<void> {
    const userKey = await this.getUserKey(key);
    await this.removeItem(userKey);
    await this.removeItem(key);
  }

  /**
   * 读取包含账号隔离特性的 JSON 对象 (支持泛型与默认兜底值)
   */
  async getUserJSON<T = any>(key: string, defaultValue?: T): Promise<T | null> {
    const str = await this.getUserItem(key);
    if (!str) return defaultValue ?? null;
    try {
      return JSON.parse(str) as T;
    } catch {
      return defaultValue ?? null;
    }
  }

  /**
   * 写入包含账号隔离特性的 JSON 对象
   */
  async setUserJSON<T = any>(key: string, value: T): Promise<void> {
    const userKey = await this.getUserKey(key);
    await this.setJSON(userKey, value);
  }
}

export const storage = new FileSystemStorage();
export default storage;

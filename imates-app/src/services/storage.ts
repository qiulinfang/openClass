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

/**
 * 基于手机原生文件系统（Expo FileSystem）的永久 Key-Value 存储实现。
 * 兼容 AsyncStorage API 规范，拥有无限存储空间（直接使用磁盘空间）。
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
        const key = decodeURIComponent(file);
        const fileUri = `${STORAGE_DIR}${file}`;
        const content = await FileSystem.readAsStringAsync(fileUri);
        this.cache[key] = content;
      }
    } catch (e) {
      console.warn('[FileSystemStorage] 磁盘数据预载入失败:', e);
    }
    this.isLoaded = true;
  }

  async getItem(key: string): Promise<string | null> {
    await this.loadAll();
    const val = this.cache[key] || null;
    return val;
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
      const fileUri = `${STORAGE_DIR}${encodeURIComponent(key)}`;
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
      const fileUri = `${STORAGE_DIR}${encodeURIComponent(key)}`;
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
}

export const storage = new FileSystemStorage();
export default storage;

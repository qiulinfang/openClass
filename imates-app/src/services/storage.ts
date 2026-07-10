import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_DIR = `${FileSystem.documentDirectory}storage/`;

/**
   * 确保存储文件夹目录存在
   */
async function ensureDirExists() {
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

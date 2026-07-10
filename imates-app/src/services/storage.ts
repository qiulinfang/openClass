/**
 * 简单的本地存储适配器 (可后续无缝替换为 AsyncStorage 或 SecureStore)
 */
class MemoryStorage {
  private cache: Record<string, string> = {};

  async getItem(key: string): Promise<string | null> {
    return this.cache[key] || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.cache[key] = value;
  }

  async removeItem(key: string): Promise<void> {
    delete this.cache[key];
  }

  async clear(): Promise<void> {
    this.cache = {};
  }
}

export const storage = new MemoryStorage();
export default storage;

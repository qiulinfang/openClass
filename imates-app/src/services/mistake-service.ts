import { storage } from './storage';

export interface MistakeItem {
  id: string;
  title: string;
  subject: string;
  userAnswer: string;
  correctAnswer: string;
  analysis: string;
  homeworkTitle: string;
  timestamp: number;
}

export class MistakeService {
  private static MISTAKE_KEY = 'IMATES_MISTAKES';

  /**
   * 获取所有错题
   */
  public static async getMistakes(): Promise<MistakeItem[]> {
    const data = await storage.getItem(this.MISTAKE_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * 添加或更新错题记录
   */
  public static async addMistake(mistake: Omit<MistakeItem, 'timestamp'>): Promise<void> {
    const list = await this.getMistakes();
    // 避免重复加入同一题，更新最新的作答记录
    const filtered = list.filter(m => m.id !== mistake.id);
    const newItem: MistakeItem = {
      ...mistake,
      timestamp: Date.now(),
    };
    filtered.unshift(newItem); // 最新加入的置顶
    await storage.setItem(this.MISTAKE_KEY, JSON.stringify(filtered));
  }

  /**
   * 从错题本中移除错题
   */
  public static async removeMistake(id: string): Promise<void> {
    const list = await this.getMistakes();
    const filtered = list.filter(m => m.id !== id);
    await storage.setItem(this.MISTAKE_KEY, JSON.stringify(filtered));
  }
}

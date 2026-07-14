import { storage } from './storage';
import { ExerciseItem } from './exercise-service';

export interface PracticeRecord {
  timestamp: number;
  originalAnswer: unknown;
  homeworkId?: string;
  homeworkName?: string;
}

export interface MistakeItem {
  id: string; // bmNo
  bmNo: string;
  questionData: ExerciseItem;
  timestamp: number;
  lastPracticeTime: number;
  practiceHistory: PracticeRecord[];
  subject: string; // 冗余一份顶层学科代码以利于快速过滤
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
   * 添加或更新错题记录 (与 Web 端 100% 对齐的嵌套结构)
   */
  public static async addMistake(params: {
    bmNo: string;
    questionData: ExerciseItem;
    originalAnswer?: unknown;
    homeworkId?: string;
    homeworkName?: string;
  }): Promise<void> {
    const list = await this.getMistakes();
    const existingIndex = list.findIndex(m => m.bmNo === params.bmNo);

    const newRecord: PracticeRecord = {
      timestamp: Date.now(),
      originalAnswer: params.originalAnswer,
      homeworkId: params.homeworkId,
      homeworkName: params.homeworkName
    };

    if (existingIndex > -1) {
      // 1. 如果已存在该错题，更新题目元数据并追加最新的作答历史记录
      const existing = list[existingIndex];
      const updated: MistakeItem = {
        ...existing,
        questionData: params.questionData,
        lastPracticeTime: Date.now(),
        practiceHistory: [newRecord, ...existing.practiceHistory].slice(0, 10), // 只保留最近 10 次作答
        subject: params.questionData.subject,
      };
      list[existingIndex] = updated;
    } else {
      // 2. 如果是第一次加入错题本，创建新记录结构
      const newItem: MistakeItem = {
        id: params.bmNo,
        bmNo: params.bmNo,
        questionData: params.questionData,
        timestamp: Date.now(),
        lastPracticeTime: Date.now(),
        practiceHistory: [newRecord],
        subject: params.questionData.subject,
      };
      list.unshift(newItem); // 新增错题置顶
    }
    await storage.setItem(this.MISTAKE_KEY, JSON.stringify(list));
  }

  /**
   * 从错题本中移除错题 (支持离线删除追踪)
   */
  public static async removeMistake(id: string): Promise<void> {
    const list = await this.getMistakes();
    const filtered = list.filter(m => m.id !== id && m.bmNo !== id);
    await storage.setItem(this.MISTAKE_KEY, JSON.stringify(filtered));

    // 记录被删除的错题 ID，以便在同步时推给云端进行多端同步删除
    try {
      const deletedStr = await storage.getItem('IMATES_MISTAKES_DELETED') || '[]';
      const deletedList: string[] = JSON.parse(deletedStr);
      if (!deletedList.includes(id)) {
        deletedList.push(id);
        await storage.setItem('IMATES_MISTAKES_DELETED', JSON.stringify(deletedList));
      }
    } catch (e) {
      console.warn('[MistakeService] 记录本地删除历史失败:', e);
    }
  }
}

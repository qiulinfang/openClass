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
  isDeleted?: number;
}

export class MistakeService {
  private static MISTAKE_KEY = 'MISTAKES';
  private static DELETED_KEY = 'MISTAKES_DELETED';

  /**
   * 获取所有错题 (通过封装的存储层自动账号隔离)
   */
  public static async getMistakes(): Promise<MistakeItem[]> {
    return (await storage.getUserJSON<MistakeItem[]>(this.MISTAKE_KEY, [])) || [];
  }

  /**
   * 添加或更新错题记录 (通过封装的存储层自动账号隔离)
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

    await storage.setUserJSON(this.MISTAKE_KEY, list);
  }

  /**
   * 从错题本中移除错题 (支持离线删除追踪)
   */
  public static async removeMistake(id: string): Promise<void> {
    const list = await this.getMistakes();
    const filtered = list.filter(m => m.id !== id && m.bmNo !== id);
    await storage.setUserJSON(this.MISTAKE_KEY, filtered);

    // 记录被删除的错题 ID，以便在同步时推给云端进行多端同步删除
    try {
      const deletedList = (await storage.getUserJSON<string[]>(this.DELETED_KEY, [])) || [];
      if (!deletedList.includes(id)) {
        deletedList.push(id);
        await storage.setUserJSON(this.DELETED_KEY, deletedList);
      }
    } catch (e) {
      console.warn('[MistakeService] 记录本地删除历史失败:', e);
    }
  }
}

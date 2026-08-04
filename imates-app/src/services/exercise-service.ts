import { storage } from './storage';
import { HttpClient } from './http-client';

export interface ExerciseItem {
  id: string;
  bmNo?: string; // 题目真正的题号 bmNo
  title: string; // 题目简短标题
  subject: string; // 学科数字代码 (1-9)
  content: string; // 题干富文本 / LaTeX
  answer?: string; // 正确答案
  analysis?: string; // 解析
  timestamp: number;
}

const STORAGE_KEY = 'FAVORITE_EXERCISES';

export class ExerciseService {
  // 学科英文字符转换至 APP 端数字代码的映射
  private static normalizeSubjectId(subj: string): string {
    const s = subj.toLowerCase();
    if (s === 'chinese') return '1';
    if (s === 'math') return '2';
    if (s === 'english') return '3';
    if (s === 'physics') return '4';
    if (s === 'chemistry') return '5';
    if (s === 'biology') return '6';
    if (s === 'politics') return '7';
    if (s === 'history') return '8';
    if (s === 'geography') return '9';
    return subj;
  }

  // 数字代码映射至英文字符以配合接口路由
  private static normalizeSubjectName(subjId: string): string {
    if (subjId === '1') return 'chinese';
    if (subjId === '2') return 'math';
    if (subjId === '3') return 'english';
    if (subjId === '4') return 'physics';
    if (subjId === '5') return 'chemistry';
    if (subjId === '6') return 'biology';
    if (subjId === '7') return 'politics';
    if (subjId === '8') return 'history';
    if (subjId === '9') return 'geography';
    return 'math';
  }

  /**
   * 接口对接：从云端拉取当前用户所有科目的习题列表 (仅在【我的练习/习题本】等练习功能模块中调用)
   * 策略：登录状态下始终先请求云端，成功则缓存并返回；请求失败时降级到本地缓存。
   *       未登录时直接返回本地缓存（可能为空）。
   */
  public static async getExercises(): Promise<ExerciseItem[]> {
    const token = (await storage.getItem('XUEBAN_TOKEN')) || '';
    if (!token.trim()) {
      console.log('[ExerciseService] 📭 未登录，读取本地缓存习题。');
      return this.getLocalExercises();
    }

    const subjects = ['math', 'biology', 'chemistry', 'physics', 'chinese', 'english'];

    console.log('[ExerciseService] 🚀 正在通过 HttpClient 从云端拉取自选习题库列表...');
    const promises = subjects.map(async (subj) => {
      try {
        const resJson = await HttpClient.get<any>(`/permission/selectExercises/${subj}`);
        const list = resJson?.data?.questionsList || [];
        return list.map((item: any) => ({
          id: String(item.id || item.bmNo || ''),
          bmNo: String(item.bmNo || item.id || ''),
          title: item.title || item.question || '自选练习题',
          subject: this.normalizeSubjectId(item.subject || subj),
          content: item.question || item.content || item.title || '',
          answer: item.answer || '',
          analysis: item.explanation || item.analysisData || '暂无解析',
          timestamp: Date.now(),
        }));
      } catch (e) {
        console.warn(`[ExerciseService] 拉取 ${subj} 线上题目失败:`, e);
        return [];
      }
    });

    try {
      const results = await Promise.all(promises);
      const onlineList = results.flat();
      await storage.setUserJSON(STORAGE_KEY, onlineList);
      console.log(`[ExerciseService] ✅ 云端拉取完成，共 ${onlineList.length} 条习题。`);
      return onlineList;
    } catch (e) {
      console.warn('[ExerciseService] 并行拉取线上数据失败，回退到本地缓存:', e);
    }

    return this.getLocalExercises();
  }

  /**
   * 读取本地缓存 (通过封装的存储层自动账号隔离)
   */
  public static async getLocalExercises(): Promise<ExerciseItem[]> {
    try {
      return (await storage.getUserJSON<ExerciseItem[]>(STORAGE_KEY, [])) || [];
    } catch (e) {
      console.warn('[ExerciseService] 读取本地备份失败:', e);
      return [];
    }
  }

  /**
   * 检查题目是否已被收藏/加入 (仅读取本地缓存，作答作业时绝不触发网络请求)
   */
  public static async isExerciseSaved(id: string): Promise<boolean> {
    const list = await this.getLocalExercises();
    return list.some(item => String(item.id) === String(id) || String(item.bmNo) === String(id));
  }

  /**
   * 接口对接：添加或取消收藏习题 (向云端服务器发送同步请求，并修改本地缓存)
   */
  public static async toggleExercise(item: Omit<ExerciseItem, 'timestamp'>): Promise<boolean> {
    const token = (await storage.getItem('XUEBAN_TOKEN')) || '';
    const isSaved = await this.isExerciseSaved(item.id);
    const subjectName = this.normalizeSubjectName(item.subject);

    if (isSaved) {
      // 1. 取消收藏
      console.log(`[ExerciseService] 🗑️ 请求云端删除习题: ${item.id} (Subject: ${subjectName})...`);
      if (token.trim()) {
        try {
          const res = await HttpClient.delete(`/permission/deleteExercises/${item.id}/${subjectName}`);
          console.log('[ExerciseService] 云端删除响应:', JSON.stringify(res));
        } catch (e) {
          console.warn('[ExerciseService] 云端删除出错:', e);
        }
      }

      const list = await this.getLocalExercises();
      const nextList = list.filter(ex => String(ex.id) !== String(item.id));
      await storage.setUserJSON(STORAGE_KEY, nextList);
      return false;
    } else {
      // 2. 添加收藏
      console.log(`[ExerciseService] ➕ 请求云端新增习题: ${item.id} (Subject: ${subjectName})...`);
      if (token.trim()) {
        try {
          const res = await HttpClient.post('/permission/exercises', {
            bmNo: item.id,
            type: subjectName,
            exercisesId: '',
            title: item.title || item.content || '自选练习题',
            answer: item.answer || '',
            explanation: item.analysis || '',
            analysisData: item.analysis || '',
          });
          console.log('[ExerciseService] 云端新增响应:', JSON.stringify(res));
        } catch (e) {
          console.warn('[ExerciseService] 云端新增出错:', e);
        }
      }

      const list = await this.getLocalExercises();
      list.push({
        ...item,
        timestamp: Date.now(),
      });
      await storage.setUserJSON(STORAGE_KEY, list);
      return true;
    }
  }
}

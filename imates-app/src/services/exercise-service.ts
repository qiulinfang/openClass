import { storage } from './storage';
import { AppEnvType, getCurrentEnvType } from './env-config';

export interface ExerciseItem {
  id: string;
  title: string; // 题目简短标题
  subject: string; // 学科数字代码 (1-9)
  content: string; // 题干富文本 / LaTeX
  answer?: string; // 正确答案
  analysis?: string; // 解析
  timestamp: number;
}

const STORAGE_KEY = 'XUEBAN_FAVORITE_EXERCISES';

export class ExerciseService {
  private static getApiBaseUrl(): string {
    const env = getCurrentEnvType();
    if (env === AppEnvType.INTERNAL_TEST) {
      return 'http://www.imates.com.cn:58443/blw-edu-service-alc';
    }
    return 'http://www.imates.com.cn:8222/blw-edu-service-alc';
  }

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
   * 接口对接：从云端拉取当前用户所有科目的习题列表
   */
  public static async getExercises(): Promise<ExerciseItem[]> {
    // 先获取本地备份，如果个人收藏的习题为空，直接返回空，不要从云端获取
    const local = await this.getLocalExercises();
    if (local.length === 0) {
      console.log('[ExerciseService] 📭 本地收藏习题为空，跳过云端拉取。');
      return [];
    }

    const token = await storage.getItem('XUEBAN_TOKEN') || '';
    if (!token.trim()) {
      // 未登录时，回退读取本地存储
      return local;
    }

    const baseUrl = this.getApiBaseUrl();
    const subjects = ['math', 'biology', 'chemistry', 'physics', 'chinese', 'english'];
    
    console.log('[ExerciseService] 🚀 正在从云端拉取自选习题库列表...');
    const promises = subjects.map(async (subj) => {
      const url = `${baseUrl}/permission/selectExercises/${subj}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'token': token.trim(),
            'sa-token': token.trim(),
            'authorization': token.trim(),
          }
        });
        if (!response.ok) return [];
        const resJson = await response.json();
        const list = resJson?.data?.questionsList || [];
        return list.map((item: any) => ({
          id: String(item.id || item.bmNo || ''),
          title: item.title || item.question || '自选练习题',
          subject: this.normalizeSubjectId(item.subject || subj),
          content: item.question || item.content || item.title || '',
          answer: item.answer || '',
          analysis: item.explanation || item.analysisData || '暂无解析',
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn(`[ExerciseService] 拉取 ${subj} 线上题目失败:`, e);
        return [];
      }
    });

    try {
      const results = await Promise.all(promises);
      const onlineList = results.flat();
      if (onlineList.length > 0) {
        // 同步缓存到本地，供离线时读取
        await storage.setItem(STORAGE_KEY, JSON.stringify(onlineList));
        return onlineList;
      }
    } catch (e) {
      console.warn('[ExerciseService] 并行拉取线上数据失败，回退到本地缓存:', e);
    }

    return this.getLocalExercises();
  }

  /**
   * 读取本地缓存
   */
  private static async getLocalExercises(): Promise<ExerciseItem[]> {
    try {
      const dataStr = await storage.getItem(STORAGE_KEY);
      if (dataStr) {
        return JSON.parse(dataStr);
      }
    } catch (e) {
      console.warn('[ExerciseService] 读取本地备份失败:', e);
    }
    return [];
  }

  /**
   * 检查题目是否已被收藏/加入
   */
  public static async isExerciseSaved(id: string): Promise<boolean> {
    const list = await this.getExercises();
    return list.some(item => String(item.id) === String(id));
  }

  /**
   * 接口对接：添加或取消收藏习题 (向云端服务器发送同步请求，并修改本地缓存)
   */
  public static async toggleExercise(item: Omit<ExerciseItem, 'timestamp'>): Promise<boolean> {
    const token = await storage.getItem('XUEBAN_TOKEN') || '';
    const isSaved = await this.isExerciseSaved(item.id);
    const baseUrl = this.getApiBaseUrl();
    const subjectName = this.normalizeSubjectName(item.subject);

    if (isSaved) {
      // 1. 如果已存在，则触发“取消收藏”（调用云端删除接口）
      console.log(`[ExerciseService] 🗑️ 正在请求云端删除习题: ${item.id} (Subject: ${subjectName})...`);
      if (token.trim()) {
        const deleteUrl = `${baseUrl}/permission/deleteExercises/${item.id}/${subjectName}`;
        try {
          const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'token': token.trim(),
              'sa-token': token.trim(),
              'authorization': token.trim(),
            }
          });
          const res = await response.json();
          console.log('[ExerciseService] 云端删除响应:', JSON.stringify(res));
        } catch (e) {
          console.warn('[ExerciseService] 物理调用云端删除出错:', e);
        }
      }

      // 同时更新本地缓存
      const list = await this.getLocalExercises();
      const nextList = list.filter(ex => String(ex.id) !== String(item.id));
      await storage.setItem(STORAGE_KEY, JSON.stringify(nextList));
      return false;
    } else {
      // 2. 如果不存在，则触发“添加收藏”（调用云端新增接口）
      console.log(`[ExerciseService] ➕ 正在请求云端新增习题: ${item.id} (Subject: ${subjectName})...`);
      if (token.trim()) {
        const addUrl = `${baseUrl}/permission/exercises`;
        try {
          const response = await fetch(addUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': token.trim(),
              'sa-token': token.trim(),
              'authorization': token.trim(),
            },
            body: JSON.stringify({
              bmNo: item.id,
              type: subjectName,
              exercisesId: '',
              title: item.title || item.content || '自选练习题',
              answer: item.answer || '',
              explanation: item.analysis || '',
              analysisData: item.analysis || '',
            })
          });
          const res = await response.json();
          console.log('[ExerciseService] 云端新增响应:', JSON.stringify(res));
        } catch (e) {
          console.warn('[ExerciseService] 物理调用云端新增出错:', e);
        }
      }

      // 同时更新本地缓存
      const list = await this.getLocalExercises();
      list.push({
        ...item,
        timestamp: Date.now()
      });
      await storage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    }
  }
}

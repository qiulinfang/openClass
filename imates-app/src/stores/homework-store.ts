import { useState, useEffect } from 'react';
import { storage } from '@/services/storage';
import {
  HomeworkService,
  HomeworkUndoItem,
  HomeworkQuestionDetail,
} from '@/services/homework-service';
import { MistakeService } from '@/services/mistake-service';
import {
  normalizeQuestion,
  prepareHomeworkSubmitAnswers,
  uploadAnswersImages,
  flattenHomeworkSubmitAnswers,
  IntermediateQuestionAnswer,
} from '@/utils/exercise-parser';

export interface HomeworkState {
  homeworkList: HomeworkUndoItem[];
  localSubmittedMap: Record<string, boolean>;
  currentHomeworkId: string;
  currentHomeworkTitle: string;
  currentHomeworkSubject: string;
  questions: HomeworkQuestionDetail[];
  currentIndex: number;
  answers: Record<string, any>;
  answersImage: Record<string, string>;
  isSubmitted: boolean;
  judgeDetailData: any;
  isLoading: boolean;
  isSubmitting: boolean;
}

class HomeworkStore {
  private state: HomeworkState = {
    homeworkList: [],
    localSubmittedMap: {},
    currentHomeworkId: '',
    currentHomeworkTitle: '',
    currentHomeworkSubject: '6',
    questions: [],
    currentIndex: 0,
    answers: {},
    answersImage: {},
    isSubmitted: false,
    judgeDetailData: null,
    isLoading: false,
    isSubmitting: false,
  };

  private listeners: Set<() => void> = new Set();
  private autoSaveTimer: any = null;

  constructor() {
    this.fetchHomeworkList = this.fetchHomeworkList.bind(this);
    this.loadHomeworkDetails = this.loadHomeworkDetails.bind(this);
    this.loadJudgeDetail = this.loadJudgeDetail.bind(this);
    this.setCurrentIndex = this.setCurrentIndex.bind(this);
    this.setAnswer = this.setAnswer.bind(this);
    this.setAnswerImage = this.setAnswerImage.bind(this);
    this.submitHomework = this.submitHomework.bind(this);
  }

  public getState(): HomeworkState {
    return this.state;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private updateState(partial: Partial<HomeworkState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  /**
   * 读取本地草稿与历史记录
   */
  public async loadDraft(homeworkId: string, questionsList: HomeworkQuestionDetail[]) {
    const initialAnswers: Record<string, string> = {};
    const initialImages: Record<string, string> = {};

    questionsList.forEach((q) => {
      initialAnswers[q.questionId] = '';
      initialImages[q.questionId] = '';
    });

    try {
      // 读草稿 (自动账号隔离)
      const draft = await storage.getUserJSON<any>(`HOMEWORK_DRAFT_${homeworkId}`);
      if (draft) {
        if (draft.answers && typeof draft.answers === 'object') {
          Object.assign(initialAnswers, draft.answers);
        }
        if (draft.answersImage && typeof draft.answersImage === 'object') {
          Object.assign(initialImages, draft.answersImage);
        }
        if (draft.isSubmitted) {
          this.updateState({ isSubmitted: true });
        }
      }

      const isSub = await storage.getUserItem(`HOMEWORK_SUBMITTED_${homeworkId}`);
      if (isSub === 'true') {
        this.updateState({ isSubmitted: true });
      }

      // 读错题本历史
      const localMistakes = await MistakeService.getMistakes();
      questionsList.forEach((q) => {
        const matchedMistake = localMistakes.find(
          (m) => m.bmNo === q.questionId || m.bmNo === q.id
        );
        if (
          matchedMistake &&
          matchedMistake.practiceHistory &&
          matchedMistake.practiceHistory.length > 0
        ) {
          const homeworkHistory = matchedMistake.practiceHistory
            .filter((h) => h.homeworkId === homeworkId)
            .sort((a, b) => b.timestamp - a.timestamp);

          if (homeworkHistory.length > 0) {
            const latestRecord = homeworkHistory[0];
            const originalAns = latestRecord.originalAnswer as
              | { studentAnswer?: string; studentImage?: string }
              | undefined;
            if (originalAns) {
              if (originalAns.studentAnswer !== undefined && !initialAnswers[q.questionId]) {
                initialAnswers[q.questionId] = originalAns.studentAnswer;
              }
              if (originalAns.studentImage !== undefined && !initialImages[q.questionId]) {
                initialImages[q.questionId] = originalAns.studentImage;
              }
            }
          }
        }
      });
    } catch (err) {
    }

    this.updateState({
      answers: initialAnswers,
      answersImage: initialImages,
    });
  }

  /**
   * 拉取作业列表 (100% 对标 imates-web fetchHomeworkList + 扫本地持久化状态)
   */
  public async fetchHomeworkList(params: {
    pageNumber?: number;
    pageSize?: number;
    subject?: string;
    date?: string;
  }) {
    this.updateState({ isLoading: true });
    try {
      const data = await HomeworkService.fetchHomeworkList({
        pageNumber: params.pageNumber || 1,
        pageSize: params.pageSize || 50,
        subject: params.subject,
        date: params.date,
      });

      const submittedMap: Record<string, boolean> = {};

      for (const item of data) {
        try {
          const subUserKey = await storage.getUserKey(`HOMEWORK_SUBMITTED_${item.id}`);
          const rawUserSub = await storage.getItem(subUserKey);

          const draftUserKey = await storage.getUserKey(`HOMEWORK_DRAFT_${item.id}`);
          const draft = await storage.getUserJSON<any>(`HOMEWORK_DRAFT_${item.id}`);

          let isSubmitted = false;

          if (rawUserSub === 'true') {
            isSubmitted = true;
          } else if (draft && draft.isSubmitted) {
            isSubmitted = true;
          }

          if (isSubmitted) {
            submittedMap[item.id] = true;
          }
        } catch (err) {}
      }

      this.updateState({
        homeworkList: data,
        localSubmittedMap: submittedMap,
        isLoading: false,
      });
      return data;
    } catch (e) {
      this.updateState({ isLoading: false });
      return [];
    }
  }

  /**
   * 初始化/加载指定作业的完整答题信息 (100% 对标 imates-web selectHomework)
   */
  public async loadHomeworkDetails(
    homeworkId: string,
    options?: {
      homeworkTitle?: string;
      homeworkSubject?: string;
      isSubmitted?: boolean;
      preloadedQuestions?: HomeworkQuestionDetail[];
      preloadedJudgeDetail?: any;
    }
  ) {
    const isSubmittedInitial = options?.isSubmitted ?? !!this.state.localSubmittedMap[homeworkId];

    this.updateState({
      currentHomeworkId: homeworkId,
      currentHomeworkTitle: options?.homeworkTitle || this.state.currentHomeworkTitle,
      currentHomeworkSubject: options?.homeworkSubject || this.state.currentHomeworkSubject || '6',
      isSubmitted: isSubmittedInitial,
      judgeDetailData: options?.preloadedJudgeDetail || null,
      isLoading: true,
      currentIndex: 0,
    });

    try {
      // 1. 获取题目结构列表
      let rawQuestions: HomeworkQuestionDetail[] = options?.preloadedQuestions || [];
      if (rawQuestions.length === 0) {
        rawQuestions = await HomeworkService.getHomeworkDetailList(homeworkId);
      }
      const normalizedQuestions = (rawQuestions || []).map((q, idx) =>
        normalizeQuestion(q, idx, this.state.currentHomeworkSubject)
      );

      // 2. 加载判罚明细数据
      if (options?.preloadedJudgeDetail) {
        this.updateState({ judgeDetailData: options.preloadedJudgeDetail });
      } else if (isSubmittedInitial) {
        this.loadJudgeDetail(homeworkId);
      }

      // 3. 读取本地历史/草稿恢复
      await this.loadDraft(homeworkId, normalizedQuestions);

      this.updateState({
        questions: normalizedQuestions,
        isLoading: false,
      });
    } catch (e) {
      this.updateState({ isLoading: false });
    }
  }

  /**
   * 获取判罚详情数据 (仅拉取判罚明细，不以接口返回与否覆盖本地提交状态)
   */
  public async loadJudgeDetail(homeworkId: string) {
    try {
      const res = await HomeworkService.getHomeworkSubmitJudgeDetail(homeworkId);
      if (res && res.data) {
        this.updateState({ judgeDetailData: res });
      }
    } catch (e) {
      console.warn('[HomeworkStore] 获取判罚明细异常:', e);
    }
  }

  /**
   * 重置 Store 内存状态 (账号退出或环境重置时调用)
   */
  public resetStore() {
    this.updateState({
      homeworkList: [],
      localSubmittedMap: {},
      currentHomeworkId: '',
      currentHomeworkTitle: '',
      currentHomeworkSubject: '6',
      questions: [],
      answers: {},
      answersImage: {},
      currentIndex: 0,
      isSubmitted: false,
      judgeDetailData: null,
      isLoading: false,
      isSubmitting: false,
    });
  }

  /**
   * 切换题号
   */
  public setCurrentIndex(index: number) {
    if (index >= 0 && index < this.state.questions.length) {
      this.updateState({ currentIndex: index });
    }
  }

  /**
   * 设置作答答案 (支持复合题展平与图片识别同步)
   */
  public setAnswer(questionItem: HomeworkQuestionDetail, val: any) {
    const key = questionItem.questionId || questionItem.id || '';
    const nextAnswers = { ...this.state.answers, [key]: val };
    if (questionItem.questionId) nextAnswers[questionItem.questionId] = val;
    if (questionItem.id) nextAnswers[questionItem.id] = val;

    const nextImages = { ...this.state.answersImage };

    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      Object.keys(val).forEach((subKey) => {
        nextAnswers[subKey] = val[subKey];
        const subVal = val[subKey];
        let imgUri = '';
        if (
          typeof subVal === 'string' &&
          (subVal.startsWith('http') ||
            subVal.startsWith('file:') ||
            subVal.startsWith('data:image') ||
            subVal.startsWith('blob:'))
        ) {
          imgUri = subVal;
        } else if (typeof subVal === 'object' && subVal !== null) {
          if (subVal.type === 'img' && subVal.content) imgUri = subVal.content;
          else if (subVal.photoUrl) imgUri = subVal.photoUrl;
          else if (subVal.boardImg) imgUri = subVal.boardImg;
        }
        if (imgUri) {
          nextImages[subKey] = imgUri;
        }
      });
    }

    this.updateState({ answers: nextAnswers, answersImage: nextImages });
    this.scheduleAutoSave();
  }

  /**
   * 设置图片作答
   */
  public setAnswerImage(subIdOrUri: string, possibleUri?: string) {
    const activeQ = this.state.questions[this.state.currentIndex];
    if (!activeQ) return;

    const key = activeQ.questionId || activeQ.id || '';
    let targetSubId = '';
    let targetUri = '';
    if (typeof subIdOrUri === 'string' && typeof possibleUri === 'string') {
      targetSubId = subIdOrUri;
      targetUri = possibleUri;
    } else if (typeof subIdOrUri === 'string') {
      targetUri = subIdOrUri;
    }

    const nextImages = {
      ...this.state.answersImage,
      [key]: targetUri,
      ...(activeQ.questionId ? { [activeQ.questionId]: targetUri } : {}),
      ...(activeQ.id ? { [activeQ.id]: targetUri } : {}),
      ...(targetSubId ? { [targetSubId]: targetUri } : {}),
    };

    this.updateState({ answersImage: nextImages });
    this.scheduleAutoSave();
  }

  /**
   * 自动防抖保存草稿 (500ms)
   */
  private scheduleAutoSave() {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.saveDraft();
    }, 500);
  }

  /**
   * 持久化草稿至磁盘
   */
  public async saveDraft() {
    const { currentHomeworkId, answers, answersImage, isSubmitted } = this.state;
    if (!currentHomeworkId) return;

    try {
      await storage.setUserJSON(`HOMEWORK_DRAFT_${currentHomeworkId}`, {
        answers,
        answersImage,
        isSubmitted,
        updatedAt: Date.now(),
      });
    } catch (e) {
    }
  }

  /**
   * 提交作业全流程 (对标 imates-web prepare ➔ upload ➔ flatten ➔ API submit)
   */
  public async submitHomework(): Promise<boolean> {
    const { currentHomeworkId, questions, answers, answersImage } = this.state;
    if (!currentHomeworkId) {
      console.warn('[HomeworkStore] submitHomework 校验失败: 当前作业 ID 为空');
      return false;
    }

    console.log('[HomeworkStore] 🚀 开始提交作业 submitHomework, homeworkId:', currentHomeworkId);
    this.updateState({ isSubmitting: true });
    try {
      // 1. 提取中间结构
      console.log('[HomeworkStore] 📌 步骤 1/6: 提取中间作答结构 prepareHomeworkSubmitAnswers...');
      const intermediateList = prepareHomeworkSubmitAnswers(questions, answers, answersImage);
      console.log('[HomeworkStore] [步骤 1 完成] 中间结构列表:', JSON.stringify(intermediateList, null, 2));

      // 2. 递归上传图片并替换为 CDN 链接 (就地修改 intermediateList)
      console.log('[HomeworkStore] 📌 步骤 2/6: 递归上传本地图片 uploadAnswersImages...');
      await uploadAnswersImages(intermediateList, (uri) =>
        HomeworkService.uploadImageAndGetUrl(uri)
      );
      console.log('[HomeworkStore] [步骤 2 完成] 本地图片上传与 CDN 替换完成');

      // 3. 将已上传的 CDN URL 回写到 store answers/answersImage
      console.log('[HomeworkStore] 📌 步骤 3/6: CDN URL 回写 Store...');
      const nextAnswers = { ...this.state.answers };
      const nextImages = { ...this.state.answersImage };
      const syncCdnUrls = (list: IntermediateQuestionAnswer[]) => {
        for (const item of list) {
          if (item.type === 'composite' && Array.isArray(item.answers)) {
            syncCdnUrls(item.answers as IntermediateQuestionAnswer[]);
          } else {
            const cdnImg = item.images && item.images.length > 0 ? item.images[0] : '';
            const cdnAns = typeof item.answers === 'string' ? item.answers : '';
            const finalCdn = cdnImg || cdnAns;
            if (finalCdn && (finalCdn.startsWith('http://') || finalCdn.startsWith('https://'))) {
              nextImages[item.questionId] = finalCdn;
              const existing = nextAnswers[item.questionId];
              if (
                !existing ||
                typeof existing === 'string' ||
                (typeof existing === 'object' && existing !== null && existing.type === 'img')
              ) {
                nextAnswers[item.questionId] = finalCdn;
              }
            }
          }
        }
      };
      syncCdnUrls(intermediateList);
      this.updateState({ answers: nextAnswers, answersImage: nextImages });
      console.log('[HomeworkStore] [步骤 3 完成] Store 作答状态已刷新为 CDN URL');

      // 4. 展平导出的 Payload
      console.log('[HomeworkStore] 📌 步骤 4/6: 展平 Payload flattenHomeworkSubmitAnswers...');
      const submissions = flattenHomeworkSubmitAnswers(intermediateList);
      console.log('[HomeworkStore] [步骤 4 完成] 提交 Payload 列表:', JSON.stringify(submissions, null, 2));

      // 5. 调用提交接口
      console.log('[HomeworkStore] 📌 步骤 5/6: 调用后端 HomeworkService.submitHomework 接口...');
      const success = await HomeworkService.submitHomework({
        homeworkId: currentHomeworkId,
        questionAnswerList: submissions,
      });
      console.log('[HomeworkStore] [步骤 5 完成] 提交接口返回结果:', success);

      if (success) {
        // 6. 更新状态与强持久化（此时 answers/answersImage 已含 CDN URL）
        console.log('[HomeworkStore] 📌 步骤 6/6: 更新已提交状态、清空草稿并强同步 loadJudgeDetail...');
        const nextLocalSubmittedMap = { ...this.state.localSubmittedMap, [currentHomeworkId]: true };
        this.updateState({
          isSubmitted: true,
          localSubmittedMap: nextLocalSubmittedMap,
          isSubmitting: false,
        });

        await storage.setUserItem(`HOMEWORK_SUBMITTED_${currentHomeworkId}`, 'true');
        await this.saveDraft();
        await this.loadJudgeDetail(currentHomeworkId);
        console.log('[HomeworkStore] 🎉 作业提交全流程完美成功完成！');
        return true;
      } else {
        console.warn('[HomeworkStore] ⚠️ 提交接口返回 false，提交失败');
      }
    } catch (e) {
      console.error('[HomeworkStore] ❌ submitHomework 提交全流程捕获异常:', e);
      return false;
    } finally {
      this.updateState({ isSubmitting: false });
    }
    return false;
  }
}

export const homeworkStore = new HomeworkStore();

/**
 * React 响应式订阅 Hook: 在组件中使用 useHomeworkStore() 订阅 HomeworkStore 的状态变更
 */
export function useHomeworkStore(): HomeworkState & {
  fetchHomeworkList: typeof homeworkStore.fetchHomeworkList;
  loadHomeworkDetails: typeof homeworkStore.loadHomeworkDetails;
  loadJudgeDetail: typeof homeworkStore.loadJudgeDetail;
  setCurrentIndex: typeof homeworkStore.setCurrentIndex;
  setAnswer: typeof homeworkStore.setAnswer;
  setAnswerImage: typeof homeworkStore.setAnswerImage;
  submitHomework: typeof homeworkStore.submitHomework;
} {
  const [state, setState] = useState<HomeworkState>(homeworkStore.getState());

  useEffect(() => {
    const unsubscribe = homeworkStore.subscribe(() => {
      setState(homeworkStore.getState());
    });
    return unsubscribe;
  }, []);

  return {
    ...state,
    fetchHomeworkList: homeworkStore.fetchHomeworkList,
    loadHomeworkDetails: homeworkStore.loadHomeworkDetails,
    loadJudgeDetail: homeworkStore.loadJudgeDetail,
    setCurrentIndex: homeworkStore.setCurrentIndex,
    setAnswer: homeworkStore.setAnswer,
    setAnswerImage: homeworkStore.setAnswerImage,
    submitHomework: homeworkStore.submitHomework,
  };
}

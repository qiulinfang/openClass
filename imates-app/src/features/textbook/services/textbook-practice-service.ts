import { Platform } from 'react-native';
import { AppEnvType, getCurrentEnvType } from '@/services/env-config';
import { authService } from '@/services/auth-service';
import { ExerciseItem } from '@/services/exercise-service';
import { storage } from '@/services/storage';

export interface PracticeQuestion extends ExerciseItem {
  bmNo: string;
  explanation?: string;
  analysisData?: string;
  atUserList?: boolean;
}

export interface PracticeQuestionPage {
  questions: PracticeQuestion[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export interface PreparedPracticeData {
  knowledgeIds: string;
  savedIds: Set<string>;
  page: PracticeQuestionPage;
}

const SUBJECT_MAP: Record<string, string> = {
  数学: 'math',
  生物: 'biology',
  生物学: 'biology',
  化学: 'chemistry',
  物理: 'physics',
  语文: 'chinese',
  英语: 'english',
  地理: 'geography',
  历史: 'history',
  政治: 'politics',
  '1': 'chinese',
  '2': 'math',
  '3': 'english',
  '4': 'physics',
  '5': 'chemistry',
  '6': 'biology',
  '7': 'geography',
  '8': 'history',
  '9': 'politics',
};

export class TextbookPracticeService {
  public static normalizeSubject(subject: string): string {
    const value = String(subject || '').trim();
    return SUBJECT_MAP[value] || value.toLowerCase() || 'math';
  }

  private static getXuebanBaseUrl(): string {
    return getCurrentEnvType() === AppEnvType.INTERNAL_TEST
      ? 'http://www.imates.com.cn:58443/blw-edu-service-alc'
      : 'http://www.imates.com.cn:8222/blw-edu-service-alc';
  }

  private static async getHeaders(): Promise<Record<string, string>> {
    const token = (await storage.getItem('XUEBAN_TOKEN'))?.trim() || '';
    if (!token) throw new Error('学伴登录已失效，请重新登录');
    return {
      'Content-Type': 'application/json',
      Token: token,
      'sa-token': token,
      authorization: token,
    };
  }

  private static async post(
    url: string,
    body: object,
    authenticated = true,
    retryOnUnauthorized = true
  ): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers: authenticated
        ? await this.getHeaders()
        : { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let payload: any;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const responseCode = Number(payload?.code ?? payload?.status);
    const unauthorized = response.status === 401 || responseCode === 401;
    if (authenticated && unauthorized && retryOnUnauthorized) {
      const [account, password] = await Promise.all([
        storage.getItem('xuebanuserid'),
        storage.getItem('userPassword'),
      ]);
      if (account?.trim() && password?.trim()) {
        await authService.loginXueban(account.trim(), password);
        return this.post(url, body, true, false);
      }
    }
    if (unauthorized) {
      throw new Error('学伴登录已失效，请重新登录');
    }
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || payload?.msg || `请求失败（HTTP ${response.status}）`);
    }
    return payload;
  }

  private static async get(
    url: string,
    retryOnUnauthorized = true
  ): Promise<any> {
    const response = await fetch(url, {
      method: 'GET',
      headers: await this.getHeaders(),
    });
    let payload: any;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const responseCode = Number(payload?.code ?? payload?.status);
    const unauthorized = response.status === 401 || responseCode === 401;
    if (unauthorized && retryOnUnauthorized) {
      const [account, password] = await Promise.all([
        storage.getItem('xuebanuserid'),
        storage.getItem('userPassword'),
      ]);
      if (account?.trim() && password?.trim()) {
        await authService.loginXueban(account.trim(), password);
        return this.get(url, false);
      }
    }
    if (unauthorized) {
      throw new Error('学伴登录已失效，请重新登录');
    }
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || payload?.msg || `请求失败（HTTP ${response.status}）`);
    }
    return payload;
  }

  public static async queryKnowledgeIds(
    textbookId: string,
    sectionId: string,
    subject: string
  ): Promise<string> {
    const payload = await this.post(
      Platform.OS === 'web'
        ? '/knowledge'
        : 'http://www.imates.com.cn:8090/knowledge',
      {
        subject: this.normalizeSubject(subject),
        param: [{ textbook_id: textbookId, section_id: sectionId }],
      },
      false
    );
    const data = payload?.data || payload;
    const knowledge = String(data?.knowledge || '').trim();
    const count =
      Number(data?.count) ||
      knowledge.split(',').map((item) => item.trim()).filter(Boolean).length;
    if (!knowledge || count === 0) {
      throw new Error('该课节暂无相关练习题，请选择其他课节');
    }
    return knowledge;
  }

  public static async getSavedQuestionIds(subject: string): Promise<Set<string>> {
    const normalized = this.normalizeSubject(subject);
    const payload = await this.get(
      `${this.getXuebanBaseUrl()}/permission/selectExercises/${normalized}`
    );
    const items =
      payload?.data?.questionsList ||
      payload?.data?.data?.questionsList ||
      payload?.data?.records ||
      [];
    return new Set(
      (Array.isArray(items) ? items : [])
        .map((item: any) => String(item?.bmNo || item?.id || ''))
        .filter(Boolean)
    );
  }

  public static async findQuestionsByKnowledge(
    knowledgeNo: string,
    subject: string,
    savedIds: Set<string>,
    current = 1,
    size = 10
  ): Promise<PracticeQuestionPage> {
    const normalizedSubject = this.normalizeSubject(subject);
    const payload = await this.post(
      `${this.getXuebanBaseUrl()}/biologyTopicKnowledge/knowledgeTopicAndAck`,
      {
        knowledgeNo,
        exercisesId: Array.from(savedIds).join(','),
        type: normalizedSubject,
        size,
        current,
      }
    );
    const questions = payload?.data?.questions || payload?.data?.data?.questions || [];
    const mapped = (Array.isArray(questions) ? questions : []).map(
      (question: any): PracticeQuestion => {
        const bmNo = String(question.bmNo || question.id || '');
        return {
          id: bmNo,
          bmNo,
          title: question.title || question.question || '练习题',
          subject: normalizedSubject,
          content:
            question.questionContent ||
            question.question ||
            question.title ||
            '',
          answer: Array.isArray(question.answer)
            ? question.answer.join(', ')
            : String(question.answer || ''),
          analysis:
            question.explanation ||
            question.analysisData ||
            question.answerAnalysis ||
            '',
          explanation: question.explanation || '',
          analysisData: question.analysisData || '',
          timestamp: Date.now(),
          atUserList: savedIds.has(bmNo) || !!question.atUserList,
        };
      }
    );
    return {
      questions: mapped,
      totalCount: Number(payload?.totalCount || payload?.data?.totalCount) || mapped.length,
      currentPage: Number(payload?.pageNo || payload?.data?.pageNo) || current,
      pageSize: Number(payload?.pageSize || payload?.data?.pageSize) || size,
    };
  }

  public static async preparePractice(
    textbookId: string,
    sectionId: string,
    subject: string,
    fallbackTextbookId?: string
  ): Promise<PreparedPracticeData> {
    const savedIds = await this.getSavedQuestionIds(subject);
    const candidateTextbookIds = Array.from(
      new Set([textbookId, fallbackTextbookId].filter(Boolean))
    ) as string[];
    let lastError: unknown;

    for (const candidateTextbookId of candidateTextbookIds) {
      try {
        const knowledgeIds = await this.queryKnowledgeIds(
          candidateTextbookId,
          sectionId,
          subject
        );
        const page = await this.findQuestionsByKnowledge(
          knowledgeIds,
          subject,
          savedIds,
          1
        );
        if (page.questions.length > 0) {
          return { knowledgeIds, savedIds, page };
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new Error('该课节暂无相关练习题，请选择其他课节');
  }

  public static async addQuestions(
    questions: PracticeQuestion[],
    subject: string,
    savedIds: Set<string>
  ): Promise<void> {
    const newIds = questions
      .map((question) => question.bmNo)
      .filter((id) => id && !savedIds.has(id));
    if (newIds.length === 0) return;
    await this.post(`${this.getXuebanBaseUrl()}/permission/exercises`, {
      bmNo: Array.from(new Set(newIds)).join(','),
      type: this.normalizeSubject(subject),
      exercisesId: Array.from(savedIds).join(','),
      title: '',
      answer: '',
      explanation: '',
      analysisData: '',
    });
  }
}

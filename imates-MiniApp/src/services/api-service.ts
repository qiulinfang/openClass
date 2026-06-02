import { httpClient } from '../utils/request';
import { getApiPaths } from '../config/env-config';

export class ApiService {
  private static instance: ApiService;

  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * 获取作业列表
   */
  public async getHomeworkList() {
    return httpClient.get<any>('/yb-release/blw-edu-yb/api/app/homework-undo-list');
  }

  /**
   * 获取题目详情
   */
  public async getQuestionDetail(questionId: string) {
    // Simplified for now
    return httpClient.get<any>(`/xb-release/permission/exercises/${questionId}`);
  }

  /**
   * 上传图片
   */
  public async uploadImage(base64Data: string) {
    const endpoint = getApiPaths().yanban.teacher.uploadImg;
    return httpClient.post<any>(endpoint, { file: base64Data });
  }
}

export const apiService = ApiService.getInstance();

import { storage } from '@/services/storage';
import { AppEnvType, getCurrentEnvType } from '@/services/env-config';
import { HomeworkService } from '@/services/homework-service';

export interface UserTextbookInfo {
  id: string;
  textbookId: string;
  textbookName: string;
  textbookSubjectLabel: string;
  textbookGradeLabel: string;
  textbookSemesterLabel: string;
  textbookPublisher: string;
  textbookEditionYear: string;
  textbookIsbn: string;
  textbookCover: string;
  textbookUpdateTime?: string;
  learningPackages?: LearningPackage[];
}

export class TextbookService {
  private static yanbanLoginPromise: Promise<string> | null = null;

  /**
   * 兼容研伴接口在不同网关下的 data / data.data / records / list 包装。
   */
  private static extractArrayPayload(payload: any): any[] {
    let current = payload;
    const wrapperKeys = ['data', 'records', 'list', 'rows', 'content'];

    for (let depth = 0; depth < 6; depth += 1) {
      if (Array.isArray(current)) return current;
      if (!current || typeof current !== 'object') return [];

      const key = wrapperKeys.find((candidate) => current[candidate] !== undefined);
      if (!key) return [];
      current = current[key];
    }

    return Array.isArray(current) ? current : [];
  }

  private static mapLearningPackages(rawPackages: any[]): LearningPackage[] {
    return rawPackages.map((pkg: any) => {
      const rawResources = this.extractArrayPayload(
        pkg.resourceList ?? pkg.resources ?? pkg.files ?? []
      );

      return {
        ...pkg,
        id: String(pkg.id ?? pkg.packageId ?? ''),
        sectionId: String(pkg.sectionId ?? ''),
        packageName: pkg.packageName || pkg.name || '未命名资源包',
        description: pkg.description || '',
        updateTime: pkg.updateTime || '',
        resourceList: rawResources.map((resItem: any) => ({
          ...resItem,
          id: String(resItem.id ?? resItem.fileId ?? ''),
          packageId: String(resItem.packageId ?? pkg.id ?? pkg.packageId ?? ''),
          fileName: resItem.fileName || resItem.name || '未知文件',
          fileUrl: this.normalizeFileUrl(resItem.fileUrl || resItem.url || ''),
          size: Number(resItem.size ?? resItem.fileSize ?? 0),
          mimeType: resItem.mimeType || resItem.contentType || '',
          checksum: resItem.checksum || '',
          uploadTime: resItem.uploadTime || resItem.updateTime || '',
        })),
      };
    });
  }

  private static getApiUrl(): string {
    const env = getCurrentEnvType();
    if (env === AppEnvType.INTERNAL_TEST) {
      return 'https://www.imates.com.cn/yb-test/blw-edu-yb/api/app/teacher-textbook';
    }
    return 'https://www.imates.com.cn/yb-release/blw-edu-yb/api/app/teacher-textbook';
  }

  /**
   * 获取研伴 Token。知识图谱和学伴主登录使用的是两套 Token，不能混用。
   */
  private static async getYanbanToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh) {
      const storedToken = (await storage.getItem('YANBAN_TOKEN'))?.trim();
      if (storedToken && storedToken !== 'undefined') {
        return storedToken;
      }
    }

    // 章节树和资源包会并发请求；复用同一个登录任务，避免同时签发两个 Token。
    if (!this.yanbanLoginPromise) {
      this.yanbanLoginPromise = (async () => {
        const account = (await storage.getItem('xuebanuserid'))?.trim();
        const password = await storage.getItem('userPassword');
        if (!account || !password) {
          throw new Error('缺少研伴登录凭据，请退出后重新登录');
        }

        return (await HomeworkService.loginYanban(account, password)).trim();
      })().finally(() => {
        this.yanbanLoginPromise = null;
      });
    }

    return this.yanbanLoginPromise;
  }

  /**
   * 资源文件下载沿用研伴认证头，与教材、章节和资源包接口保持同一套 Token。
   */
  public static async getYanbanAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getYanbanToken();
    return {
      Token: token,
      'sa-token': token,
      authorization: token,
    };
  }

  private static async isUnauthorized(response: Response): Promise<boolean> {
    if (response.status === 401) return true;

    // 部分网关用 HTTP 200 包装业务状态码 401。
    try {
      const body = await response.clone().json();
      return Number(body?.code) === 401;
    } catch {
      return false;
    }
  }

  /**
   * 发送知识图谱请求。401 时强制刷新研伴 Token，并且只重试一次。
   */
  private static async postWithYanbanAuth(url: string, body: object): Promise<Response> {
    const send = (token: string) => fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': token,
        'sa-token': token,
        'authorization': token,
      },
      body: JSON.stringify(body),
    });

    let token = await this.getYanbanToken();
    let response = await send(token);

    if (await this.isUnauthorized(response)) {
      await storage.removeItem('YANBAN_TOKEN');
      token = await this.getYanbanToken(true);
      response = await send(token);
    }

    if (!response.ok || await this.isUnauthorized(response)) {
      const responseBody = await response.text().catch(() => '');
      const status = response.status === 401 || response.ok ? 401 : response.status;
      throw new Error(`知识图谱接口异常 (HTTP ${status})${responseBody ? `: ${responseBody}` : ''}`);
    }

    return response;
  }

  /**
   * 拉取用户所有的线上教材资源
   */
  public static async fetchTextbooks(): Promise<UserTextbookInfo[]> {
    try {
      const response = await this.postWithYanbanAuth(this.getApiUrl(), {});

      const text = await response.text();
      const sanitizedText = text.replace(/:\s*(-?\d{15,})/g, ':"$1"');
      const res = JSON.parse(sanitizedText);
      const rawList = this.extractArrayPayload(res);
      if (Array.isArray(rawList)) {
        const BASE_URL = 'https://www.imates.com.cn:9099';
        return rawList.map((item: any) => {
          let cover = item.textbookCover || '';
          if (cover && !cover.startsWith('http')) {
            cover = BASE_URL + cover;
          }
          return {
            ...item,
            id: String(item.id ?? item.textbookId ?? ''),
            textbookId: String(item.textbookId ?? ''),
            textbookName: item.textbookName || '未命名教材',
            textbookSubjectLabel: item.textbookSubjectLabel || '其他',
            textbookGradeLabel: item.textbookGradeLabel || '全部',
            textbookSemesterLabel: item.textbookSemesterLabel || '',
            textbookPublisher: item.textbookPublisher || '人教版',
            textbookEditionYear: item.textbookEditionYear || '',
            textbookIsbn: item.textbookIsbn || '',
            textbookCover: cover,
            textbookUpdateTime: item.textbookUpdateTime || '',
            learningPackages: this.mapLearningPackages(
              this.extractArrayPayload(item.learningPackages || [])
            ),
          };
        });
      }
      return [];
    } catch (e) {
      console.warn('[TextbookService] 获取教材列表出错:', e);
      throw e;
    }
  }

  /**
   * 拉取指定教材的章节目录树
   */
  public static async fetchSectionTree(textbookId: string): Promise<ChapterNode[]> {
    try {
      const env = getCurrentEnvType();
      const url = env === AppEnvType.INTERNAL_TEST
        ? 'https://www.imates.com.cn/yb-test/blw-edu-yb/api/app/teacher-textbook-section-tree'
        : 'https://www.imates.com.cn/yb-release/blw-edu-yb/api/app/teacher-textbook-section-tree';

      const response = await this.postWithYanbanAuth(url, { id: textbookId });

      const text = await response.text();
      const sanitizedText = text.replace(/:\s*(-?\d{15,})/g, ':"$1"');
      const res = JSON.parse(sanitizedText);
      console.log(`[TextbookService] fetchSectionTree raw response for textbookId: ${textbookId}:`, JSON.stringify(res));
      const structure = this.extractArrayPayload(res);
      // 对齐 imates-web：如果最外层是整本书的根节点容器，则剥离根节点，直接返回其子节点（即实际章节列表）
      if (
        Array.isArray(structure) &&
        structure.length === 1 &&
        structure[0]?.children?.length > 0 &&
        (structure[0]?.isRoot || structure[0]?.parentId == null)
      ) {
        return structure[0].children;
      }
      return structure;
    } catch (e) {
      console.warn(`[TextbookService] 获取教材章节树失败 (textbookId: ${textbookId}):`, e);
      throw e;
    }
  }

  /**
   * 拉取指定教材的学习资源包列表
   */
  public static async fetchLearningPackages(
    textbookVersionId: string,
    textbookId?: string
  ): Promise<LearningPackage[]> {
    const env = getCurrentEnvType();
    const url = env === AppEnvType.INTERNAL_TEST
      ? 'https://www.imates.com.cn/yb-test/blw-edu-yb/api/app/teacher-textbook-learning-package'
      : 'https://www.imates.com.cn/yb-release/blw-edu-yb/api/app/teacher-textbook-learning-package';
    const candidateIds = Array.from(
      new Set([textbookVersionId, textbookId].filter((id): id is string => !!id))
    );
    let packagesWithoutFiles: LearningPackage[] = [];
    let lastError: unknown;

    for (const candidateId of candidateIds) {
      try {
        const response = await this.postWithYanbanAuth(url, { id: candidateId });
        const text = await response.text();
        const sanitizedText = text.replace(/:\s*(-?\d{15,})/g, ':"$1"');
        const res = JSON.parse(sanitizedText);
        const packages = this.mapLearningPackages(this.extractArrayPayload(res));

        console.log(
          `[TextbookService] 教材资源查询完成 (id: ${candidateId})：${packages.length} 个资源包`
        );

        if (packages.some((pkg) => pkg.resourceList.length > 0)) {
          return packages;
        }
        if (packages.length > 0) packagesWithoutFiles = packages;
      } catch (error) {
        lastError = error;
        console.warn(`[TextbookService] 获取资源包失败 (id: ${candidateId}):`, error);
      }
    }

    if (packagesWithoutFiles.length > 0) return packagesWithoutFiles;
    if (lastError && candidateIds.length === 1) throw lastError;
    return [];
  }

  /**
   * 格式化资源文件下载链接，将 relative / file:///resource/ 转换为外网绝对地址，以供 WebView 加载
   */
  private static normalizeFileUrl(fileUrl: string): string {
    if (!fileUrl) return '';
    let path = fileUrl.trim();
    
    // 如果是 file:///resource/ 形式，剥去协议头变为 /resource/
    if (path.startsWith('file:///resource/')) {
      path = path.substring('file://'.length);
    }
    
    const env = getCurrentEnvType();
    const domain = 'https://www.imates.com.cn';
    const resourceBase = env === AppEnvType.INTERNAL_TEST ? '/yb-test/resource' : '/yb-release/resource';

    if (path.startsWith('/resource/')) {
      return `${domain}${resourceBase}${path.substring('/resource'.length)}`;
    }
    
    if (path.startsWith('resource/')) {
      return `${domain}${resourceBase}${path.substring('resource'.length)}`;
    }
    
    return path;
  }
}

export interface ChapterNode {
  id: string;
  name: string;
  parentId?: string | null;
  label: string;
  level: number | null;
  isRoot: boolean;
  updateTime?: string;
  children?: ChapterNode[];
}

export interface ResourceFile {
  id: string;
  packageId?: string;
  fileName: string;
  fileUrl: string;
  remoteUrl?: string;
  size: number;
  mimeType?: string;
  checksum?: string;
  uploadTime?: string;
}

export interface LearningPackage {
  id: string;
  sectionId: string;
  packageName: string;
  description: string;
  updateTime?: string;
  resourceList: ResourceFile[];
}

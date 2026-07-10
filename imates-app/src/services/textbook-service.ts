import { storage } from './storage';
import { AppEnvType, getCurrentEnvType } from './env-config';

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
}

export class TextbookService {
  private static getApiUrl(): string {
    const env = getCurrentEnvType();
    if (env === AppEnvType.INTERNAL_TEST) {
      return 'https://www.imates.com.cn/yb-test/blw-edu-yb/api/app/teacher-textbook';
    }
    return 'https://www.imates.com.cn/yb-release/blw-edu-yb/api/app/teacher-textbook';
  }

  /**
   * 拉取用户所有的线上教材资源
   */
  public static async fetchTextbooks(): Promise<UserTextbookInfo[]> {
    const token = await storage.getItem('YANBAN_TOKEN') || '';
    if (!token) {
      console.warn('[TextbookService] 研伴 Token 为空，请先在作业页执行登录');
      return [];
    }

    try {
      const url = this.getApiUrl();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': token.trim(),
          'sa-token': token.trim(),
          'authorization': token.trim(),
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }

      const text = await response.text();
      const sanitizedText = text.replace(/:\s*(-?\d{15,})/g, ':"$1"');
      const res = JSON.parse(sanitizedText);
      const rawList = res?.data || res;
      if (Array.isArray(rawList)) {
        const BASE_URL = 'https://www.imates.com.cn:9099';
        return rawList.map((item: any) => {
          let cover = item.textbookCover || '';
          if (cover && !cover.startsWith('http')) {
            cover = BASE_URL + cover;
          }
          return {
            id: String(item.id || item.textbookId),
            textbookId: String(item.textbookId),
            textbookName: item.textbookName || '未命名教材',
            textbookSubjectLabel: item.textbookSubjectLabel || '其他',
            textbookGradeLabel: item.textbookGradeLabel || '全部',
            textbookSemesterLabel: item.textbookSemesterLabel || '',
            textbookPublisher: item.textbookPublisher || '人教版',
            textbookEditionYear: item.textbookEditionYear || '',
            textbookIsbn: item.textbookIsbn || '',
            textbookCover: cover,
          };
        });
      }
      return [];
    } catch (e) {
      console.warn('[TextbookService] 获取教材列表出错:', e);
      return [];
    }
  }

  /**
   * 拉取指定教材的章节目录树
   */
  public static async fetchSectionTree(textbookId: string): Promise<ChapterNode[]> {
    const token = await storage.getItem('YANBAN_TOKEN') || '';
    if (!token) {
      console.warn('[TextbookService] 研伴 Token 为空，无法获取章节树');
      return [];
    }

    try {
      const env = getCurrentEnvType();
      const url = env === AppEnvType.INTERNAL_TEST
        ? 'https://www.imates.com.cn/yb-test/blw-edu-yb/api/app/teacher-textbook-section-tree'
        : 'https://www.imates.com.cn/yb-release/blw-edu-yb/api/app/teacher-textbook-section-tree';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': token.trim(),
          'sa-token': token.trim(),
          'authorization': token.trim(),
        },
        body: JSON.stringify({ id: textbookId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }

      const text = await response.text();
      const sanitizedText = text.replace(/:\s*(-?\d{15,})/g, ':"$1"');
      const res = JSON.parse(sanitizedText);
      console.log(`[TextbookService] fetchSectionTree raw response for textbookId: ${textbookId}:`, JSON.stringify(res));
      const structure = res?.data || [];
      // 对齐 imates-web：如果最外层是整本书的根节点容器，则剥离根节点，直接返回其子节点（即实际章节列表）
      if (Array.isArray(structure) && structure.length > 0 && structure[0]?.children?.length > 0) {
        return structure[0].children;
      }
      return structure;
    } catch (e) {
      console.warn(`[TextbookService] 获取教材章节树失败 (textbookId: ${textbookId}):`, e);
      return [];
    }
  }

  /**
   * 拉取指定教材的学习资源包列表
   */
  public static async fetchLearningPackages(textbookId: string): Promise<LearningPackage[]> {
    const token = await storage.getItem('YANBAN_TOKEN') || '';
    if (!token) {
      console.warn('[TextbookService] 研伴 Token 为空，无法获取资源包');
      return [];
    }

    try {
      const env = getCurrentEnvType();
      const url = env === AppEnvType.INTERNAL_TEST
        ? 'https://www.imates.com.cn/yb-test/blw-edu-yb/api/app/teacher-textbook-learning-package'
        : 'https://www.imates.com.cn/yb-release/blw-edu-yb/api/app/teacher-textbook-learning-package';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': token.trim(),
          'sa-token': token.trim(),
          'authorization': token.trim(),
        },
        body: JSON.stringify({ id: textbookId }), // 注意：后端参数是 id
      });

      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }

      const text = await response.text();
      const sanitizedText = text.replace(/:\s*(-?\d{15,})/g, ':"$1"');
      const res = JSON.parse(sanitizedText);
      console.log(`[TextbookService] fetchLearningPackages raw response for textbookId: ${textbookId}:`, JSON.stringify(res));
      const rawList = res?.data || res;
      if (Array.isArray(rawList)) {
        return rawList.map((pkg: any) => ({
          id: String(pkg.id),
          sectionId: String(pkg.sectionId || ''),
          packageName: pkg.packageName || '未命名资源包',
          description: pkg.description || '',
          resourceList: Array.isArray(pkg.resourceList) ? pkg.resourceList.map((resItem: any) => ({
            id: String(resItem.id),
            fileName: resItem.fileName || '未知文件',
            fileUrl: this.normalizeFileUrl(resItem.fileUrl || ''),
            size: Number(resItem.size || 0),
            mimeType: resItem.mimeType || '',
          })) : [],
        }));
      }
      return [];
    } catch (e) {
      console.warn(`[TextbookService] 获取资源包失败 (textbookId: ${textbookId}):`, e);
      return [];
    }
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
  fileName: string;
  fileUrl: string;
  size: number;
  mimeType?: string;
}

export interface LearningPackage {
  id: string;
  sectionId: string;
  packageName: string;
  description: string;
  resourceList: ResourceFile[];
}

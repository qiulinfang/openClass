import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { storage } from '@/services/storage';
import { getCurrentEnvType } from '@/services/env-config';
import {
  ChapterNode,
  LearningPackage,
  ResourceFile,
  TextbookService,
  UserTextbookInfo,
} from './textbook-service';

export type TextbookDownloadStatus = 0 | 1 | 2 | 3;

export interface LocalTextbookFile {
  id: string;
  fileName: string;
  localUri: string;
  remoteUrl: string;
  checksum: string;
  size: number;
  uploadTime: string;
}

interface PausedFileDownload {
  resourceId: string;
  url: string;
  fileUri: string;
  options: FileSystem.DownloadOptions;
  resumeData?: string;
}

export interface StoredTextbookDownload {
  recordId: string;
  textbookId: string;
  textbook: UserTextbookInfo;
  /**
   * 最近一次完整下载成功时的教材版本时间。
   * 不能直接使用 textbook.textbookUpdateTime：教材列表刷新时 textbook 会被服务端最新数据覆盖。
   */
  installedTextbookUpdateTime?: string;
  downloadStatus: TextbookDownloadStatus;
  downloadedFiles: number;
  totalFiles: number;
  isDownloaded: boolean;
  lastDownloadTime: string;
  hasUpdatesAvailable: boolean;
  learningPackages: LearningPackage[];
  chapterTree: ChapterNode[];
  localFiles: LocalTextbookFile[];
  pausedFile?: PausedFileDownload;
}

export interface TextbookDownloadProgress {
  progress: number;
  downloadedFiles: number;
  totalFiles: number;
}

const DOWNLOAD_INDEX_KEY_PREFIX = 'TEXTBOOK_DOWNLOAD_INDEX_V2';
const DOWNLOAD_ROOT = `${FileSystem.documentDirectory}textbooks/`;
const WEB_CACHE_NAME_PREFIX = 'IMATES_TEXTBOOK_FILES_V2';
const WEB_CACHE_PATH = '/__imates_textbook_cache/';

const environmentKey = (): string => getCurrentEnvType();
const downloadRoot = (): string => `${DOWNLOAD_ROOT}${environmentKey()}/`;
const webCacheName = (): string =>
  `${WEB_CACHE_NAME_PREFIX}_${environmentKey()}`;

const initialRecord = (textbook: UserTextbookInfo): StoredTextbookDownload => ({
  recordId: textbook.id,
  textbookId: textbook.textbookId,
  textbook,
  downloadStatus: 0,
  downloadedFiles: 0,
  totalFiles: 0,
  isDownloaded: false,
  lastDownloadTime: '',
  hasUpdatesAvailable: false,
  learningPackages: [],
  chapterTree: [],
  localFiles: [],
});

const safeFilePart = (value: string): string =>
  value.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_').slice(0, 120) || 'resource';

const uniqueResources = (packages: LearningPackage[]): ResourceFile[] => {
  const byId = new Map<string, ResourceFile>();
  for (const pkg of packages) {
    for (const resource of pkg.resourceList || []) {
      if (resource.id && resource.fileUrl) {
        byId.set(resource.id, resource);
      }
    }
  }
  return Array.from(byId.values());
};

const resourceSignature = (resource: ResourceFile): string =>
  [
    resource.id,
    resource.checksum || '',
    resource.size || 0,
    resource.uploadTime || '',
    resource.fileUrl || '',
  ].join('|');

const isNewer = (serverTime?: string, installedTime?: string): boolean => {
  if (!serverTime) return false;
  if (!installedTime) return true;

  const serverTimestamp = Date.parse(serverTime);
  const installedTimestamp = Date.parse(installedTime);
  if (Number.isNaN(serverTimestamp) || Number.isNaN(installedTimestamp)) {
    // 与 Web 端保持一致：无法解析版本时间时采用安全更新策略。
    return serverTime !== installedTime;
  }
  return serverTimestamp > installedTimestamp;
};

export class DownloadPausedError extends Error {
  constructor() {
    super('教材下载已暂停');
    this.name = 'DownloadPausedError';
  }
}

/**
 * 教材下载与本地清单服务。
 * 后端数据仍完全复用 TextbookService 的教材、章节树和学习资源包接口。
 */
export class TextbookDownloadService {
  private static activeDownloads = new Map<string, FileSystem.DownloadResumable>();
  private static webDownloadControllers = new Map<string, AbortController>();
  private static webObjectUrls = new Set<string>();
  private static pauseRequests = new Set<string>();
  private static cancelRequests = new Set<string>();
  private static indexQueue: Promise<void> = Promise.resolve();

  private static async getIndexKey(): Promise<string> {
    const userId = (await storage.getItem('xuebanuserid'))?.trim() || 'anonymous';
    return `${DOWNLOAD_INDEX_KEY_PREFIX}_${encodeURIComponent(userId)}_${environmentKey()}`;
  }

  private static async withIndexLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.indexQueue;
    let release!: () => void;
    this.indexQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private static async readIndex(): Promise<Record<string, StoredTextbookDownload>> {
    const raw = await storage.getItem(await this.getIndexKey());
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, StoredTextbookDownload>;
    } catch {
      return {};
    }
  }

  private static async writeIndex(
    index: Record<string, StoredTextbookDownload>
  ): Promise<void> {
    await storage.setItem(await this.getIndexKey(), JSON.stringify(index));
  }

  private static async saveRecord(record: StoredTextbookDownload): Promise<void> {
    await this.withIndexLock(async () => {
      const index = await this.readIndex();
      index[record.recordId] = record;
      await this.writeIndex(index);
    });
  }

  private static async updateRecord(
    recordId: string,
    update: (record: StoredTextbookDownload) => void
  ): Promise<StoredTextbookDownload | null> {
    return this.withIndexLock(async () => {
      const index = await this.readIndex();
      const record = index[recordId];
      if (!record) return null;
      update(record);
      await this.writeIndex(index);
      return record;
    });
  }

  private static async ensureRoot(): Promise<void> {
    if (Platform.OS === 'web') {
      await this.getWebCache();
      return;
    }

    const root = downloadRoot();
    const rootInfo = await FileSystem.getInfoAsync(root);
    if (!rootInfo.exists) {
      await FileSystem.makeDirectoryAsync(root, { intermediates: true });
    }
  }

  private static directoryFor(recordId: string): string {
    return `${downloadRoot()}${safeFilePart(recordId)}/`;
  }

  private static fileUriFor(recordId: string, resource: ResourceFile): string {
    const extension = resource.fileName.includes('.')
      ? `.${safeFilePart(resource.fileName.split('.').pop() || '')}`
      : '';
    return `${this.directoryFor(recordId)}${safeFilePart(resource.id)}${extension}`;
  }

  private static async getWebCache(): Promise<Cache> {
    if (typeof globalThis.caches === 'undefined') {
      throw new Error('当前浏览器不支持教材离线缓存，请使用最新版 Chrome、Edge 或 Safari');
    }
    return globalThis.caches.open(webCacheName());
  }

  private static webCachePrefix(recordId: string): string {
    const origin = globalThis.location?.origin || 'https://imates.local';
    return `${origin}${WEB_CACHE_PATH}${environmentKey()}/${encodeURIComponent(recordId)}/`;
  }

  private static webCacheUrl(recordId: string, resourceId: string): string {
    return `${this.webCachePrefix(recordId)}${encodeURIComponent(resourceId)}`;
  }

  private static async localFileExists(localUri: string): Promise<boolean> {
    if (Platform.OS === 'web') {
      return !!(await (await this.getWebCache()).match(localUri));
    }
    return (await FileSystem.getInfoAsync(localUri)).exists;
  }

  private static async deleteLocalFile(localUri: string): Promise<void> {
    if (Platform.OS === 'web') {
      await (await this.getWebCache()).delete(localUri);
      return;
    }
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  }

  private static async deleteTextbookFiles(recordId: string): Promise<void> {
    if (Platform.OS === 'web') {
      const cache = await this.getWebCache();
      const prefix = this.webCachePrefix(recordId);
      const requests = await cache.keys();
      await Promise.all(
        requests
          .filter((request) => request.url.startsWith(prefix))
          .map((request) => cache.delete(request))
      );
      return;
    }
    await FileSystem.deleteAsync(this.directoryFor(recordId), {
      idempotent: true,
    });
  }

  private static async downloadWebResource(
    recordId: string,
    resource: ResourceFile,
    resourceIndex: number,
    totalResources: number,
    headers: Record<string, string>,
    onProgress?: (progress: TextbookDownloadProgress) => void,
    downloadedFiles = 0
  ): Promise<string> {
    const controller = new AbortController();
    this.webDownloadControllers.set(recordId, controller);

    try {
      const response = await fetch(resource.fileUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`资源请求失败 (HTTP ${response.status})：${resource.fileName}`);
      }

      const expectedBytes = Number(response.headers.get('Content-Length') || 0);
      const contentType =
        response.headers.get('Content-Type') ||
        resource.mimeType ||
        'application/octet-stream';
      let blob: Blob;

      if (response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            receivedBytes += value.byteLength;
            const fileProgress = expectedBytes > 0 ? receivedBytes / expectedBytes : 0;
            onProgress?.({
              progress: Math.min(
                99,
                Math.round(
                  ((resourceIndex + fileProgress) / totalResources) * 100
                )
              ),
              downloadedFiles,
              totalFiles: totalResources,
            });
          }
        }

        blob = new Blob(chunks as BlobPart[], { type: contentType });
      } else {
        blob = await response.blob();
      }

      const localUri = this.webCacheUrl(recordId, resource.id);
      await (await this.getWebCache()).put(
        localUri,
        new Response(blob, {
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(blob.size),
          },
        })
      );
      return localUri;
    } catch (error) {
      if (controller.signal.aborted) {
        const abortError = new Error('教材下载已暂停');
        abortError.name = 'AbortError';
        throw abortError;
      }
      throw error;
    } finally {
      if (this.webDownloadControllers.get(recordId) === controller) {
        this.webDownloadControllers.delete(recordId);
      }
    }
  }

  public static hasActiveDownload(recordId: string): boolean {
    return (
      this.activeDownloads.has(recordId) ||
      this.webDownloadControllers.has(recordId)
    );
  }

  public static async getRecords(): Promise<StoredTextbookDownload[]> {
    return this.withIndexLock(async () => {
      const index = await this.readIndex();
      let changed = false;

      for (const record of Object.values(index)) {
        if (record.downloadStatus === 1 && !this.hasActiveDownload(record.recordId)) {
          record.downloadStatus =
            record.pausedFile || record.downloadedFiles > 0 ? 3 : 0;
          record.isDownloaded = false;
          changed = true;
        }
      }

      if (changed) {
        await this.writeIndex(index);
      }
      return Object.values(index);
    });
  }

  public static async getRecord(
    recordIdOrTextbookId: string
  ): Promise<StoredTextbookDownload | null> {
    const records = await this.getRecords();
    return (
      records.find(
        (record) =>
          record.recordId === recordIdOrTextbookId ||
          record.textbookId === recordIdOrTextbookId
      ) || null
    );
  }

  public static async getCachedTextbooks(): Promise<UserTextbookInfo[]> {
    return (await this.getRecords()).map((record) => record.textbook);
  }

  public static async getDownloadedLearningPackages(
    recordIdOrTextbookId: string
  ): Promise<LearningPackage[] | null> {
    const record = await this.getRecord(recordIdOrTextbookId);
    if (!record?.isDownloaded) return null;

    const localById = new Map(record.localFiles.map((file) => [file.id, file]));
    if (Platform.OS === 'web') {
      this.webObjectUrls.forEach((url) => globalThis.URL.revokeObjectURL(url));
      this.webObjectUrls.clear();
      const cache = await this.getWebCache();

      return Promise.all(
        record.learningPackages.map(async (pkg) => {
          const resources = await Promise.all(
            pkg.resourceList.map(async (resource) => {
              const localFile = localById.get(resource.id);
              if (!localFile) return null;
              const cachedResponse = await cache.match(localFile.localUri);
              if (!cachedResponse) return null;
              const objectUrl = globalThis.URL.createObjectURL(
                await cachedResponse.blob()
              );
              this.webObjectUrls.add(objectUrl);
              return {
                ...resource,
                remoteUrl: resource.remoteUrl || resource.fileUrl,
                fileUrl: objectUrl,
              };
            })
          );
          return {
            ...pkg,
            resourceList: resources.filter((resource) => resource !== null),
          };
        })
      );
    }

    return record.learningPackages.map((pkg) => ({
      ...pkg,
      resourceList: pkg.resourceList
        .filter((resource) => localById.has(resource.id))
        .map((resource) => ({
          ...resource,
          remoteUrl: resource.remoteUrl || resource.fileUrl,
          fileUrl: localById.get(resource.id)!.localUri,
        })),
    }));
  }

  public static async getCachedChapterTree(
    recordIdOrTextbookId: string
  ): Promise<ChapterNode[] | null> {
    const record = await this.getRecord(recordIdOrTextbookId);
    return record?.isDownloaded && record.chapterTree.length > 0
      ? record.chapterTree
      : null;
  }

  public static async syncServerTextbooks(
    serverTextbooks: UserTextbookInfo[]
  ): Promise<void> {
    if (serverTextbooks.length === 0) return;

    await this.withIndexLock(async () => {
      const index = await this.readIndex();
      const serverIds = new Set(serverTextbooks.map((book) => book.id));
      let changed = false;

      for (const [recordId, record] of Object.entries(index)) {
        const serverBook = serverTextbooks.find((book) => book.id === recordId);
        if (serverBook) {
          record.textbook = serverBook;
          record.textbookId = serverBook.textbookId;
          changed = true;
        } else if (!serverIds.has(recordId)) {
          await this.cancelDownload(recordId);
          await this.deleteTextbookFiles(recordId).catch(() => undefined);
          delete index[recordId];
          changed = true;
        }
      }

      if (changed) {
        await this.writeIndex(index);
      }
    });
  }

  public static async checkForUpdates(
    textbooks: UserTextbookInfo[]
  ): Promise<Set<string>> {
    const index = await this.withIndexLock(() => this.readIndex());
    const updated = new Set<string>();

    for (const textbook of textbooks) {
      const record = index[textbook.id];
      if (!record?.isDownloaded) continue;

      try {
        const serverPackages = await TextbookService.fetchLearningPackages(
          textbook.id
        );
        const serverFiles = uniqueResources(serverPackages);
        const localById = new Map(record.localFiles.map((file) => [file.id, file]));
        const localPackagesById = new Map(
          record.learningPackages.map((pkg) => [pkg.id, pkg])
        );

        const fileSetChanged =
          serverFiles.length !== record.localFiles.length ||
          serverFiles.some((resource) => {
            const local = localById.get(resource.id);
            if (!local) return true;
            return resourceSignature(resource) !==
              [
                local.id,
                local.checksum || '',
                local.size || 0,
                local.uploadTime || '',
                local.remoteUrl || '',
              ].join('|');
          });
        const packageSetChanged =
          serverPackages.length !== record.learningPackages.length ||
          serverPackages.some((pkg) => {
            const localPackage = localPackagesById.get(pkg.id);
            return (
              !localPackage ||
              isNewer(pkg.updateTime, localPackage.updateTime)
            );
          });

        const installedTextbookUpdateTime =
          record.installedTextbookUpdateTime ??
          record.textbook.textbookUpdateTime;
        const textbookChanged = isNewer(
          textbook.textbookUpdateTime,
          installedTextbookUpdateTime
        );

        const hasUpdates = fileSetChanged || packageSetChanged || textbookChanged;
        await this.updateRecord(textbook.id, (current) => {
          if (current.isDownloaded) {
            // 旧版记录首次迁移时固化已安装基线，避免随后同步服务端元数据后丢失版本差异。
            if (current.installedTextbookUpdateTime === undefined) {
              current.installedTextbookUpdateTime =
                installedTextbookUpdateTime || '';
            }
            current.hasUpdatesAvailable = hasUpdates;
          }
        });
        if (hasUpdates) updated.add(textbook.id);
      } catch {
        // 更新检查失败不改变已有状态，避免把网络问题误报为更新。
        if (record.hasUpdatesAvailable) updated.add(textbook.id);
      }
    }

    return updated;
  }

  public static async downloadTextbook(
    textbook: UserTextbookInfo,
    onProgress?: (progress: TextbookDownloadProgress) => void,
    forceRefreshPackages = false
  ): Promise<StoredTextbookDownload> {
    if (this.hasActiveDownload(textbook.id)) {
      throw new Error('该教材正在下载中');
    }

    this.pauseRequests.delete(textbook.id);
    this.cancelRequests.delete(textbook.id);
    await this.ensureRoot();
    if (Platform.OS !== 'web') {
      const textbookDir = this.directoryFor(textbook.id);
      const dirInfo = await FileSystem.getInfoAsync(textbookDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(textbookDir, { intermediates: true });
      }
    }

    const existing = await this.getRecord(textbook.id);
    const record: StoredTextbookDownload = existing
      ? { ...existing, textbook }
      : initialRecord(textbook);

    const canReusePausedPackages =
      !forceRefreshPackages &&
      record.downloadStatus === 3 &&
      record.learningPackages.length > 0;
    const embeddedPackages = textbook.learningPackages || [];
    const canUseEmbeddedPackages =
      !forceRefreshPackages &&
      uniqueResources(embeddedPackages).length > 0;
    const packages = canReusePausedPackages
      ? record.learningPackages
      : canUseEmbeddedPackages
        ? embeddedPackages
        : await TextbookService.fetchLearningPackages(
            textbook.id
          );

    if (packages.length === 0 || uniqueResources(packages).length === 0) {
      const error = new Error('暂无可用的学习资源');
      error.name = 'EmptyLearningPackages';
      throw error;
    }

    const chapterTree =
      canReusePausedPackages && record.chapterTree.length > 0
        ? record.chapterTree
        : await TextbookService.fetchSectionTree(textbook.textbookId)
            .catch(() => record.chapterTree);
    const resources = uniqueResources(packages);
    const serverIds = new Set(resources.map((resource) => resource.id));

    for (const localFile of record.localFiles.filter((file) => !serverIds.has(file.id))) {
      await this.deleteLocalFile(localFile.localUri).catch(() => undefined);
    }
    record.localFiles = record.localFiles.filter((file) => serverIds.has(file.id));
    record.learningPackages = packages;
    record.chapterTree = chapterTree;
    record.totalFiles = resources.length;
    record.downloadStatus = 1;
    record.isDownloaded = false;
    record.hasUpdatesAvailable = false;
    await this.saveRecord(record);

    // Web 资源地址与原 Web 端一致，走公开的 /resource 静态路由。
    // 不附加自定义认证头，避免浏览器触发不必要的 CORS 预检。
    const authHeaders =
      Platform.OS === 'web'
        ? {}
        : await TextbookService.getYanbanAuthHeaders();
    const localById = new Map(record.localFiles.map((file) => [file.id, file]));

    try {
      for (let index = 0; index < resources.length; index += 1) {
        const resource = resources[index];
        if (this.cancelRequests.has(textbook.id)) {
          const error = new Error('教材下载已取消');
          error.name = 'DownloadCanceledError';
          throw error;
        }

        const existingFile = localById.get(resource.id);
        const unchanged =
          existingFile &&
          existingFile.remoteUrl === resource.fileUrl &&
          existingFile.checksum === (resource.checksum || '') &&
          existingFile.size === (resource.size || 0) &&
          existingFile.uploadTime === (resource.uploadTime || '') &&
          await this.localFileExists(existingFile.localUri);

        if (unchanged) {
          record.downloadedFiles = localById.size;
          onProgress?.({
            progress: Math.round((record.downloadedFiles / record.totalFiles) * 100),
            downloadedFiles: record.downloadedFiles,
            totalFiles: record.totalFiles,
          });
          continue;
        }

        let resultUri: string;
        if (Platform.OS === 'web') {
          resultUri = await this.downloadWebResource(
            textbook.id,
            resource,
            index,
            resources.length,
            authHeaders,
            onProgress,
            record.downloadedFiles
          );
        } else {
          const fileUri = this.fileUriFor(textbook.id, resource);
          const paused = record.pausedFile?.resourceId === resource.id
            ? record.pausedFile
            : undefined;
          const options: FileSystem.DownloadOptions = paused?.options || {
            headers: authHeaders,
          };
          const resumable = FileSystem.createDownloadResumable(
            resource.fileUrl,
            fileUri,
            options,
            ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
              const fileProgress =
                totalBytesExpectedToWrite > 0
                  ? totalBytesWritten / totalBytesExpectedToWrite
                  : 0;
              onProgress?.({
                progress: Math.min(
                  99,
                  Math.round(((index + fileProgress) / resources.length) * 100)
                ),
                downloadedFiles: record.downloadedFiles,
                totalFiles: record.totalFiles,
              });
            },
            paused?.resumeData
          );

          this.activeDownloads.set(textbook.id, resumable);
          const result = paused
            ? await resumable.resumeAsync()
            : await resumable.downloadAsync();
          this.activeDownloads.delete(textbook.id);

          if (!result || this.pauseRequests.has(textbook.id)) {
            throw new DownloadPausedError();
          }
          resultUri = result.uri;
        }

        const localFile: LocalTextbookFile = {
          id: resource.id,
          fileName: resource.fileName,
          localUri: resultUri,
          remoteUrl: resource.fileUrl,
          checksum: resource.checksum || '',
          size: resource.size || 0,
          uploadTime: resource.uploadTime || '',
        };
        localById.set(resource.id, localFile);
        record.localFiles = Array.from(localById.values());
        record.downloadedFiles = record.localFiles.length;
        delete record.pausedFile;
        await this.saveRecord(record);
        onProgress?.({
          progress: Math.round((record.downloadedFiles / record.totalFiles) * 100),
          downloadedFiles: record.downloadedFiles,
          totalFiles: record.totalFiles,
        });
      }

      record.downloadStatus = 2;
      record.isDownloaded = true;
      record.downloadedFiles = record.totalFiles;
      record.lastDownloadTime = new Date().toISOString();
      record.hasUpdatesAvailable = false;
      record.installedTextbookUpdateTime = textbook.textbookUpdateTime || '';
      record.textbook = textbook;
      delete record.pausedFile;
      await this.saveRecord(record);
      return record;
    } catch (error) {
      this.activeDownloads.delete(textbook.id);
      this.webDownloadControllers.delete(textbook.id);
      if (error instanceof DownloadPausedError || this.pauseRequests.has(textbook.id)) {
        await this.updateRecord(textbook.id, (current) => {
          current.downloadStatus = 3;
          current.isDownloaded = false;
        });
        throw new DownloadPausedError();
      }
      if (this.cancelRequests.has(textbook.id)) {
        throw error;
      }
      record.downloadStatus = record.downloadedFiles > 0 ? 3 : 0;
      record.isDownloaded = false;
      await this.saveRecord(record);
      throw error;
    } finally {
      this.activeDownloads.delete(textbook.id);
      this.webDownloadControllers.delete(textbook.id);
      this.pauseRequests.delete(textbook.id);
      this.cancelRequests.delete(textbook.id);
    }
  }

  public static async pauseDownload(recordId: string): Promise<boolean> {
    const webController = this.webDownloadControllers.get(recordId);
    if (webController) {
      this.pauseRequests.add(recordId);
      webController.abort();
      await this.updateRecord(recordId, (record) => {
        record.downloadStatus = 3;
        record.isDownloaded = false;
      });
      return true;
    }

    const active = this.activeDownloads.get(recordId);
    if (!active) return false;

    this.pauseRequests.add(recordId);
    const pauseState = await active.pauseAsync();
    const record = await this.getRecord(recordId);
    if (record) {
      const resource = uniqueResources(record.learningPackages).find(
        (item) => item.fileUrl === pauseState.url
      );
      record.downloadStatus = 3;
      record.isDownloaded = false;
      record.pausedFile = {
        resourceId: resource?.id || '',
        url: pauseState.url,
        fileUri: pauseState.fileUri,
        options: pauseState.options,
        resumeData: pauseState.resumeData,
      };
      await this.saveRecord(record);
    }
    return true;
  }

  public static async pauseAll(): Promise<void> {
    const activeRecordIds = new Set([
      ...this.activeDownloads.keys(),
      ...this.webDownloadControllers.keys(),
    ]);
    await Promise.all(
      Array.from(activeRecordIds).map((recordId) =>
        this.pauseDownload(recordId).catch(() => false)
      )
    );
  }

  public static async cancelDownload(recordId: string): Promise<void> {
    this.cancelRequests.add(recordId);
    this.webDownloadControllers.get(recordId)?.abort();
    this.webDownloadControllers.delete(recordId);
    const active = this.activeDownloads.get(recordId);
    if (active) {
      await active.cancelAsync().catch(() => undefined);
    }
    this.activeDownloads.delete(recordId);
  }

  public static async clearTextbook(recordId: string): Promise<void> {
    await this.cancelDownload(recordId);
    await this.deleteTextbookFiles(recordId);

    await this.withIndexLock(async () => {
      const index = await this.readIndex();
      const record = index[recordId];
      if (record) {
        index[recordId] = {
          ...initialRecord(record.textbook),
          hasUpdatesAvailable: false,
        };
        await this.writeIndex(index);
      }
    });
  }
}

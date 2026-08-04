import { storage } from './storage';
import { getXuebanApiUrl } from './api-url';
import { MistakeService, MistakeItem } from './mistake-service';
import { AiChatSessionService } from '@/features/ai-chat/services/ai-chat-session-service';
import type { AiChatSession } from '@/features/ai-chat/types';
import type { ChatMessage } from './ai-chat-service';

export interface SyncPullResponse<T> {
  success: boolean;
  code?: number;
  data: {
    records: T[];
    serverTime: number;
  };
}

export interface SyncPushResponse {
  success: boolean;
  code?: number;
  count?: number;
  data?: {
    serverTime: number;
  };
}

/**
 * 移动端增量数据同步引擎与接口封装
 */
export class SyncService {
  private static LAST_SYNC_MISTAKE = 'LAST_SYNC_TIME_MISTAKE';
  private static LAST_SYNC_CHAT = 'LAST_SYNC_TIME_CHAT';
  private static cloudSyncUnavailable = false;

  private static getApiBaseUrl(): string {
    return getXuebanApiUrl('');
  }

  /**
   * 云同步是可选能力，不能用它的鉴权结果清理 AI 主链路的登录态。
   * 测试环境尚未部署同步接口时，本次运行内停止继续请求即可。
   */
  private static throwIfCloudSyncUnavailable(response: Response): void {
    if (response.status !== 401 && response.status !== 404) return;
    this.cloudSyncUnavailable = true;
    throw new Error(
      `[SyncService] 云同步接口暂不可用 (HTTP ${response.status})`
    );
  }

  /**
   * 向云端拉取增量更新
   */
  public static async pullFromServer<T>(module: 'chat' | 'mistake', lastSyncTime: number): Promise<SyncPullResponse<T>> {
    if (this.cloudSyncUnavailable) {
      return { success: false, data: { serverTime: Date.now(), records: [] } };
    }

    const token = await storage.getItem('XUEBAN_TOKEN') || '';
    if (!token.trim()) {
      return { success: false, data: { serverTime: Date.now(), records: [] } };
    }

    const baseUrl = this.getApiBaseUrl();
    const url = `${baseUrl}/permission/sync/pull?module=${module}&lastSyncTime=${lastSyncTime}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Token': token.trim(),
          'sa-token': token.trim(),
          'authorization': token.trim(),
        }
      });

      if (response.status === 404 || response.status === 401) {
        this.cloudSyncUnavailable = true;
        return { success: false, data: { serverTime: Date.now(), records: [] } };
      }

      if (!response.ok) {
        return { success: false, data: { serverTime: Date.now(), records: [] } };
      }

      return await response.json();
    } catch (e) {
      this.cloudSyncUnavailable = true;
      return { success: false, data: { serverTime: Date.now(), records: [] } };
    }
  }

  /**
   * 将本地脏数据推送上报至云端
   */
  public static async pushToServer(module: 'chat' | 'mistake', records: any[]): Promise<SyncPushResponse> {
    if (this.cloudSyncUnavailable) {
      return { success: false, count: 0 };
    }

    const token = await storage.getItem('XUEBAN_TOKEN') || '';
    if (!token.trim()) {
      return { success: false, count: 0 };
    }

    const baseUrl = this.getApiBaseUrl();
    const url = `${baseUrl}/permission/sync/push`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': token.trim(),
          'sa-token': token.trim(),
          'authorization': token.trim(),
        },
        body: JSON.stringify({ module, records }),
      });

      if (response.status === 404 || response.status === 401) {
        this.cloudSyncUnavailable = true;
        return { success: false, count: 0 };
      }

      if (!response.ok) {
        return { success: false, count: 0 };
      }

      return await response.json();
    } catch (e) {
      this.cloudSyncUnavailable = true;
      return { success: false, count: 0 };
    }
  }

  /**
   * 执行错题本双向增量同步
   */
  public static async syncMistakes(): Promise<void> {
    if (this.cloudSyncUnavailable) return;
    try {
      const lastSyncTime = Number(await storage.getItem(this.LAST_SYNC_MISTAKE)) || 0;

      // 1. 从云端拉取增量数据
      const pullRes = await this.pullFromServer<MistakeItem>('mistake', lastSyncTime);
      if (!pullRes.success) {
        throw new Error(JSON.stringify(pullRes));
      }
      const cloudRecords = pullRes.data.records || [];
      const serverTime = pullRes.data.serverTime || Date.now();

      // 2. 获取本地现有的错题
      const localRecords = await MistakeService.getMistakes();
      const localMap = new Map<string, MistakeItem>();
      localRecords.forEach(item => localMap.set(item.bmNo, item));

      // 3. 数据合并 (LWW + 删除逻辑)
      cloudRecords.forEach(c => {
        const local = localMap.get(c.bmNo);
        if (c.isDeleted === 1) {
          // 云端标记删除 ➔ 本地直接删除
          localMap.delete(c.bmNo);
        } else {
          // 云端活跃记录 ➔ 若本地没有，或云端时间戳更新，则覆盖本地
          if (!local || c.lastPracticeTime > local.lastPracticeTime) {
            localMap.set(c.bmNo, {
              ...c,
              id: c.bmNo // 确保 ID 与 bmNo 对齐
            });
          }
        }
      });

      // 4. 收集本地脏数据 (在上次同步时间之后更新的，且未被标记删除的)
      const dirtyRecords = Array.from(localMap.values()).filter(
        item => item.lastPracticeTime > lastSyncTime
      );

      // 5. 搜集并拼装本地离线删除的数据列表
      const deletedStr = await storage.getItem('IMATES_MISTAKES_DELETED') || '[]';
      const deletedList: string[] = JSON.parse(deletedStr);
      
      const pushRecords = [...dirtyRecords];
      deletedList.forEach(id => {
        pushRecords.push({
          id: id,
          bmNo: id,
          isDeleted: 1,
          lastPracticeTime: Date.now(),
          timestamp: Date.now(),
          subject: 'general',
          questionData: {} as any,
          practiceHistory: []
        });
      });

      // 6. 如果有需要推送的增量或删除项，推送到云端
      if (pushRecords.length > 0) {
        const pushRes = await this.pushToServer('mistake', pushRecords);
        if (pushRes.success) {
          // 清空本地已上报的删除追踪队列
          await storage.setItem('IMATES_MISTAKES_DELETED', '[]');
        }
      }

      // 7. 保存最终合并的错题本数据，并更新本地 lastSyncTime
      const finalLocalList = Array.from(localMap.values());
      await storage.setItem('IMATES_MISTAKES', JSON.stringify(finalLocalList));
      await storage.setItem(this.LAST_SYNC_MISTAKE, String(serverTime));
    } catch (e) {
    }
  }

  /**
   * 执行 AI 对话会话双向同步
   */
  public static async syncChatHistory(): Promise<void> {
    if (this.cloudSyncUnavailable) return;
    try {
      const lastSyncTime = Number(await storage.getItem(this.LAST_SYNC_CHAT)) || 0;
      const userId = await storage.getItem('xuebanuserid') || 'user';

      // 1. 从云端拉取所有增量会话，不能只处理最后一个活跃会话。
      const pullRes = await this.pullFromServer<any>('chat', lastSyncTime);
      if (!pullRes.success) {
        throw new Error(JSON.stringify(pullRes));
      }
      const cloudSessions = pullRes.data.records || [];
      const serverTime = pullRes.data.serverTime || Date.now();

      const localBeforePull = await AiChatSessionService.loadSessions(
        userId,
        'general'
      );
      const localSessionMap = new Map(
        localBeforePull.map((session) => [session.id, session])
      );

      // 2. 合并云端会话及消息。Web 使用 ISO 时间字符串，App 统一转为时间戳。
      for (const cloudSession of cloudSessions) {
        if (
          cloudSession?.scenario &&
          cloudSession.scenario !== 'GENERAL'
        ) {
          continue;
        }
        const sessionId = String(
          cloudSession?.sessionId || cloudSession?.id || ''
        ).trim();
        if (!sessionId) continue;
        const localSession = localSessionMap.get(sessionId);
        const cloudUpdatedAt = this.toTimestamp(
          cloudSession.updatedAt || cloudSession.updateTime
        );
        if (cloudSession.isDeleted === 1) {
          if (
            localSession &&
            cloudUpdatedAt >= localSession.updatedAt
          ) {
            await AiChatSessionService.deleteSession(
              userId,
              localSession
            );
            localSessionMap.delete(sessionId);
          }
          continue;
        }

        const [localMessages, normalizedCloudMessages] =
          await Promise.all([
            localSession
              ? AiChatSessionService.loadMessages(sessionId)
              : Promise.resolve([]),
            Promise.resolve(
              this.normalizeCloudMessages(
                cloudSession.messages || [],
                sessionId
              )
            ),
          ]);
        const mergedMessages = this.mergeChatMessages(
          localMessages,
          normalizedCloudMessages
        );
        const createdAt =
          this.toTimestamp(
            cloudSession.createdAt || cloudSession.createTime
          ) ||
          localSession?.createdAt ||
          mergedMessages[0]?.timestamp ||
          Date.now();
        const updatedAt = Math.max(
          cloudUpdatedAt,
          localSession?.updatedAt || 0,
          mergedMessages[mergedMessages.length - 1]?.timestamp || 0,
          createdAt
        );
        const title = String(
          cloudSession.title ||
            cloudSession.sessionName ||
            localSession?.title ||
            mergedMessages.find((message) => message.sender === 'user')
              ?.content ||
            '历史会话'
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 25);
        const lastContent =
          [...mergedMessages]
            .reverse()
            .find((message) => message.content.trim())?.content || title;
        const mergedSession: AiChatSession = {
          id: sessionId,
          scopeKey: 'general',
          scene: 'general',
          title: title || '历史会话',
          summary: lastContent.replace(/\s+/g, ' ').trim().slice(0, 46),
          createdAt,
          updatedAt,
          messageCount: mergedMessages.length,
          pinned: localSession?.pinned,
          favorited: localSession?.favorited,
          favoritedAt: localSession?.favoritedAt,
        };
        await AiChatSessionService.importConversation(
          userId,
          mergedSession,
          mergedMessages
        );
        localSessionMap.set(sessionId, mergedSession);
      }

      // 3. 推送所有本地增量会话，与 Web 的全会话同步行为保持一致。
      const localAfterPull = await AiChatSessionService.loadSessions(
        userId,
        'general'
      );
      const dirtySessions = localAfterPull.filter(
        (session) => session.updatedAt > lastSyncTime
      );
      if (dirtySessions.length > 0) {
        const pushRecords = await Promise.all(
          dirtySessions.map(async (session) => ({
            sessionId: session.id,
            subject: 'general',
            scenario: 'GENERAL',
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            isDeleted: 0,
            messages: await AiChatSessionService.loadMessages(session.id),
          }))
        );
        await this.pushToServer('chat', pushRecords);
      }

      // 4. 更新时间游标。
      await storage.setItem(this.LAST_SYNC_CHAT, String(serverTime));
    } catch (e) {
    }
  }

  private static toTimestamp(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) return numeric;
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  private static normalizeCloudMessages(
    messages: any[],
    sessionId: string
  ): ChatMessage[] {
    if (!Array.isArray(messages)) return [];
    return messages
      .map((message, index): ChatMessage | null => {
        const sender =
          message?.sender === 'user' || message?.type === 'user'
            ? 'user'
            : 'ai';
        const timestamp =
          this.toTimestamp(message?.timestamp) ||
          Date.now() + index;
        const imageUri =
          message?.imageUri ||
          message?.imageData?.base64DataUrl ||
          message?.imageList?.[0]?.base64DataUrl;
        const content = String(
          message?.content ?? message?.message ?? ''
        );
        if (!content && !imageUri) return null;
        return {
          id: String(
            message?.id || `${sessionId}-cloud-${timestamp}-${index}`
          ),
          sender,
          content,
          timestamp,
          imageUri: imageUri ? String(imageUri) : undefined,
          isStreaming: false,
        };
      })
      .filter(
        (message): message is ChatMessage => message !== null
      );
  }

  private static mergeChatMessages(
    localMessages: ChatMessage[],
    cloudMessages: ChatMessage[]
  ): ChatMessage[] {
    const messageMap = new Map<string, ChatMessage>();
    [...localMessages, ...cloudMessages].forEach((message) => {
      const existing = messageMap.get(message.id);
      if (!existing || message.timestamp >= existing.timestamp) {
        messageMap.set(message.id, {
          ...message,
          isStreaming: false,
        });
      }
    });
    return Array.from(messageMap.values()).sort(
      (left, right) => left.timestamp - right.timestamp
    );
  }
}

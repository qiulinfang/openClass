import { storage } from './storage';
import { AppEnvType, getCurrentEnvType } from './env-config';
import { MistakeService, MistakeItem } from './mistake-service';
import { DeviceEventEmitter } from 'react-native';

export interface SyncPullResponse<T> {
  success: boolean;
  code: number;
  data: {
    records: T[];
    serverTime: number;
  };
}

export interface SyncPushResponse {
  success: boolean;
  code: number;
  data: {
    serverTime: number;
  };
}

/**
 * 移动端增量数据同步引擎与接口封装
 */
export class SyncService {
  private static LAST_SYNC_MISTAKE = 'LAST_SYNC_TIME_MISTAKE';
  private static LAST_SYNC_CHAT = 'LAST_SYNC_TIME_CHAT';

  private static getApiBaseUrl(): string {
    const env = getCurrentEnvType();
    if (env === AppEnvType.INTERNAL_TEST) {
      return 'http://www.imates.com.cn:58443/blw-edu-service-alc';
    }
    return 'http://www.imates.com.cn:8222/blw-edu-service-alc';
  }

  /**
   * 向云端拉取增量更新
   */
  public static async pullFromServer<T>(module: 'chat' | 'mistake', lastSyncTime: number): Promise<SyncPullResponse<T>> {
    const token = await storage.getItem('XUEBAN_TOKEN') || '';
    if (!token.trim()) {
      throw new Error('[SyncService] ⚠️ 未登录或未获取到 Token，无法拉取云同步数据');
    }

    const baseUrl = this.getApiBaseUrl();
    const url = `${baseUrl}/permission/sync/pull?module=${module}&lastSyncTime=${lastSyncTime}`;

    console.log(`[SyncService] 🔄 Sending Pull Request for module: ${module}, lastSyncTime: ${lastSyncTime}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'token': token.trim(),
        'sa-token': token.trim(),
        'authorization': token.trim(),
      }
    });

    if (response.status === 401) {
      console.warn('[SyncService] Token 401 过期，触发强制登出...');
      await storage.removeItem('XUEBAN_TOKEN');
      await storage.removeItem('YANBAN_TOKEN');
      DeviceEventEmitter.emit('FORCE_LOGOUT', { message: '设备已经在其他地方登陆，请重新登录。' });
      throw new Error('设备已经在其他地方登陆');
    }

    if (!response.ok) {
      throw new Error(`[SyncService] Pull Request Failed (HTTP ${response.status})`);
    }

    return await response.json();
  }

  /**
   * 将本地脏数据推送上报至云端
   */
  public static async pushToServer(module: 'chat' | 'mistake', records: any[]): Promise<SyncPushResponse> {
    const token = await storage.getItem('XUEBAN_TOKEN') || '';
    if (!token.trim()) {
      throw new Error('[SyncService] ⚠️ 未登录或未获取到 Token，无法推送本地脏数据');
    }

    const baseUrl = this.getApiBaseUrl();
    const url = `${baseUrl}/permission/sync/push`;

    console.log(`[SyncService] 📤 Sending Push Request for module: ${module}, records count: ${records.length}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token.trim(),
        'sa-token': token.trim(),
        'authorization': token.trim(),
      },
      body: JSON.stringify({
        module,
        records
      })
    });

    if (response.status === 401) {
      console.warn('[SyncService] Token 401 过期，触发强制登出...');
      await storage.removeItem('XUEBAN_TOKEN');
      await storage.removeItem('YANBAN_TOKEN');
      DeviceEventEmitter.emit('FORCE_LOGOUT', { message: '设备已经在其他地方登陆，请重新登录。' });
      throw new Error('设备已经在其他地方登陆');
    }

    if (!response.ok) {
      throw new Error(`[SyncService] Push Request Failed (HTTP ${response.status})`);
    }

    return await response.json();
  }

  /**
   * 执行错题本双向增量同步
   */
  public static async syncMistakes(): Promise<void> {
    try {
      const lastSyncTime = Number(await storage.getItem(this.LAST_SYNC_MISTAKE)) || 0;
      console.log(`[SyncService] 🔄 开始同步错题本... 上次同步时间: ${lastSyncTime}`);

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
          console.log(`[SyncService] 📤 成功推送 ${pushRecords.length} 条错题变更`);
        }
      }

      // 7. 保存最终合并的错题本数据，并更新本地 lastSyncTime
      const finalLocalList = Array.from(localMap.values());
      await storage.setItem('IMATES_MISTAKES', JSON.stringify(finalLocalList));
      await storage.setItem(this.LAST_SYNC_MISTAKE, String(serverTime));

      console.log(`[SyncService] ✅ 错题本同步完成. 当前本地有效错题总数: ${finalLocalList.length}`);
    } catch (e) {
      console.warn('[SyncService] ❌ 错题本同步过程中出错:', e);
    }
  }

  /**
   * 执行 AI 对话会话双向同步
   */
  public static async syncChatHistory(): Promise<void> {
    try {
      const lastSyncTime = Number(await storage.getItem(this.LAST_SYNC_CHAT)) || 0;
      const userId = await storage.getItem('xuebanuserid') || 'user';
      const lastSessionId = await storage.getItem(`IMATES_LAST_SESSION_ID_${userId}`);
      if (!lastSessionId) {
        console.log('[SyncService] ℹ️ 未检测到本地活跃的聊天会话，跳过同步');
        return;
      }

      console.log(`[SyncService] 🔄 开始同步 AI 聊天会话... 会话ID: ${lastSessionId}, 上次同步时间: ${lastSyncTime}`);

      // 1. 从云端拉取增量会话数据
      const pullRes = await this.pullFromServer<any>('chat', lastSyncTime);
      if (!pullRes.success) {
        throw new Error(JSON.stringify(pullRes));
      }
      const cloudSessions = pullRes.data.records || [];
      const serverTime = pullRes.data.serverTime || Date.now();

      // 2. 读取本地当前会话的消息缓存
      const localMsgStr = await storage.getItem(`IMATES_CHAT_SESSION_${lastSessionId}`);
      const localMessages = localMsgStr ? JSON.parse(localMsgStr) : [];

      // 3. 构建本地会话的大 JSON 包，用于上报或比对
      // 如果本地有消息，包装成一个 session 记录
      const localSessionWrapper = {
        sessionId: lastSessionId,
        subject: 'general',
        scenario: 'GENERAL',
        title: '移动端会话',
        createdAt: localMessages[0]?.timestamp || Date.now(),
        updatedAt: localMessages[localMessages.length - 1]?.timestamp || Date.now(),
        isDeleted: 0,
        messages: localMessages
      };

      // 4. 合并云端拉取的会话数据与本地数据
      let finalMessages = [...localMessages];
      let updatedAt = localSessionWrapper.updatedAt;

      // 寻找属于该 sessionId 的云端会话
      const matchingCloudSession = cloudSessions.find(s => s.sessionId === lastSessionId);
      if (matchingCloudSession) {
        // 如果云端的更新时间新于本地，进行数据与消息合并
        if (matchingCloudSession.updatedAt > localSessionWrapper.updatedAt) {
          const cloudMessages = matchingCloudSession.messages || [];
          
          // 对消息进行 ID 去重
          const msgMap = new Map<string, any>();
          localMessages.forEach((msg: any) => msgMap.set(msg.id, msg));
          cloudMessages.forEach((msg: any) => {
            const local = msgMap.get(msg.id);
            if (!local || msg.timestamp > local.timestamp) {
              msgMap.set(msg.id, msg);
            }
          });

          // 按时间戳排序
          finalMessages = Array.from(msgMap.values()).sort((a, b) => a.timestamp - b.timestamp);
          updatedAt = matchingCloudSession.updatedAt;
        }
      }

      // 5. 将本地脏数据（在上次同步时间之后产生的新对话气泡）上报给云端
      const localNewMessages = localMessages.filter((msg: any) => msg.timestamp > lastSyncTime);
      if (localNewMessages.length > 0) {
        const pushSession = {
          ...localSessionWrapper,
          messages: localMessages // 传输当前会话全量消息以保持最新状态
        };
        const pushRes = await this.pushToServer('chat', [pushSession]);
        if (pushRes.success) {
          console.log(`[SyncService] 📤 成功推送本地会话 ${lastSessionId} 的 ${localNewMessages.length} 条新消息至云端`);
        }
      }

      // 6. 保存最终合并的聊天数据，并更新时间戳
      await storage.setItem(`IMATES_CHAT_SESSION_${lastSessionId}`, JSON.stringify(finalMessages));
      await storage.setItem(this.LAST_SYNC_CHAT, String(serverTime));

      console.log(`[SyncService] ✅ AI 对话消息同步完成`);
    } catch (e) {
      console.warn('[SyncService] ❌ AI 对话同步过程中出错:', e);
    }
  }
}

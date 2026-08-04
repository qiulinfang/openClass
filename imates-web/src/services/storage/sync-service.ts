import { SyncApi } from '../http/sync-api';
import { getAllMistakes, addMistake, deleteMistake } from './mistake-storage';
import { ChatStorageService } from './chat-storage';
import { STORE_NAMES, IDB_CONFIGS } from './db-config';
import { IndexedDBService } from './indexeddb-service';
import type { MistakeItem } from './mistake-storage';

export class SyncService {
  private static LAST_SYNC_MISTAKE = 'LAST_SYNC_TIME_MISTAKE';
  private static LAST_SYNC_CHAT = 'LAST_SYNC_TIME_CHAT';
  private static syncApi = new SyncApi();

  /**
   * 同步错题本数据 (双向增量同步)
   */
  public static async syncMistakes(): Promise<void> {
    try {
      const lastSyncTime = Number(localStorage.getItem(this.LAST_SYNC_MISTAKE)) || 0;

      // 1. 从云端拉取增量记录
      const pullRes = await this.syncApi.pull('mistake', lastSyncTime);
      if (!pullRes.success) {
        throw new Error(JSON.stringify(pullRes));
      }
      const cloudRecords = pullRes.data.records || [];
      const serverTime = pullRes.data.serverTime;

      // 2. 获取本地 IndexedDB 中现有的错题
      const localRecords = await getAllMistakes();
      const localMap = new Map<string, MistakeItem>();
      localRecords.forEach(m => localMap.set(m.bmNo, m));

      // 3. 合并云端记录 (LWW + 删除逻辑)
      for (const c of cloudRecords) {
        const local = localMap.get(c.bmNo);
        if (c.isDeleted === 1) {
          // 云端标记删除 ➔ 本地物理删除 (直接删除，防止记录触发 offline 删除再次上报)
          const mistakeStorage = IndexedDBService.getInstance(IDB_CONFIGS.MISTAKE_STORAGE());
          await mistakeStorage.delete(STORE_NAMES.MISTAKES, c.bmNo);
          localMap.delete(c.bmNo);
        } else {
          // 云端活跃记录 ➔ 本地无或云端更新，则覆写本地
          if (!local || c.lastPracticeTime > local.lastPracticeTime) {
            await addMistake({
              bmNo: c.bmNo,
              questionData: c.questionData,
              originalAnswer: c.practiceHistory?.[0]?.originalAnswer,
              homeworkId: c.practiceHistory?.[0]?.homeworkId,
              homeworkName: c.practiceHistory?.[0]?.homeworkName
            });
            localMap.set(c.bmNo, c);
          }
        }
      }

      // 4. 收集本地脏数据 (在上次同步时间之后做过练习或修改的)
      const dirtyRecords = Array.from(localMap.values()).filter(
        m => m.lastPracticeTime > lastSyncTime
      );

      // 5. 搜集并合并本地离线删除的数据列表
      const deletedStr = localStorage.getItem('IMATES_MISTAKES_DELETED') || '[]';
      const deletedList: string[] = JSON.parse(deletedStr);
      
      const pushRecords = [...dirtyRecords];
      deletedList.forEach(id => {
        pushRecords.push({
          id,
          bmNo: id,
          isDeleted: 1,
          lastPracticeTime: Date.now(),
          timestamp: Date.now(),
          questionData: {} as any,
          practiceHistory: []
        });
      });

      // 6. 推送脏数据/删除数据至云端
      if (pushRecords.length > 0) {
        const pushRes = await this.syncApi.push('mistake', pushRecords);
        if (pushRes.success) {
          // 成功后清空本地已上报的删除队列
          localStorage.setItem('IMATES_MISTAKES_DELETED', '[]');
        }
      }

      // 7. 保存同步时间戳
      localStorage.setItem(this.LAST_SYNC_MISTAKE, String(serverTime));

    } catch (e) {
    }
  }

  /**
   * 同步 AI 对话会话记录 (双向增量同步)
   */
  public static async syncChatHistory(): Promise<void> {
    try {
      const lastSyncTime = Number(localStorage.getItem(this.LAST_SYNC_CHAT)) || 0;

      // 1. 从云端拉取增量记录
      const pullRes = await this.syncApi.pull('chat', lastSyncTime);
      if (!pullRes.success) {
        throw new Error(JSON.stringify(pullRes));
      }
      const cloudSessions = pullRes.data.records || [];
      const serverTime = pullRes.data.serverTime;

      const chatStorage = ChatStorageService.getInstance();
      await chatStorage.initialize();

      // 2. 遍历并合并云端拉取的会话及其消息
      for (const cs of cloudSessions) {
        // A. 写入会话元数据（如果是通用会话）
        if (cs.scenario === 'GENERAL') {
          const generalStorage = IndexedDBService.getInstance(IDB_CONFIGS.CHAT_STORAGE());
          await generalStorage.put(STORE_NAMES.AI_GENERAL_SESSIONS, {
            id: cs.sessionId,
            sessionId: cs.sessionId,
            sessionName: cs.title,
            createTime: cs.createdAt,
            updateTime: cs.updatedAt,
            msgCount: cs.messages?.length || 0
          });
        }
        
        // B. 合并并写入对话消息内容
        const localHistory = await chatStorage.loadChatHistory(cs.sessionId);
        let mergedMessages = cs.messages || [];

        if (localHistory && localHistory.messages) {
          // 本地存在，合并并去重
          const msgMap = new Map<string, any>();
          localHistory.messages.forEach(msg => msgMap.set(msg.id, msg));
          (cs.messages || []).forEach(msg => {
            const localMsg = msgMap.get(msg.id);
            if (!localMsg || msg.timestamp > localMsg.timestamp) {
              msgMap.set(msg.id, msg);
            }
          });
          mergedMessages = Array.from(msgMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        }

        await chatStorage.saveChatHistory(cs.sessionId, {
          questionId: cs.sessionId,
          messages: mergedMessages,
          chatResponseTimes: mergedMessages.length,
          lastUpdated: cs.updatedAt
        });
      }

      // 3. 收集并推送本地有更新的会话 (在上次同步时间之后更新的消息会话)
      // Web端查找所有会话ID
      const allSessionKeys = await chatStorage.getAllChatHistoryKeys();
      const dirtySessions = [];

      for (const key of allSessionKeys) {
        const history = await chatStorage.loadChatHistory(key);
        if (history && history.lastUpdated > lastSyncTime) {
          // 查询会话的基本标题元数据
          const generalStorage = IndexedDBService.getInstance(IDB_CONFIGS.CHAT_STORAGE());
          const sessionMeta = await generalStorage.get<any>(STORE_NAMES.AI_GENERAL_SESSIONS, key);

          dirtySessions.push({
            sessionId: key,
            subject: 'general',
            scenario: 'GENERAL',
            title: sessionMeta?.sessionName || 'Web对话会话',
            createdAt: sessionMeta?.createTime || history.lastUpdated,
            updatedAt: history.lastUpdated,
            isDeleted: 0,
            messages: history.messages || []
          });
        }
      }

      if (dirtySessions.length > 0) {
        await this.syncApi.push('chat', dirtySessions);
      }

      // 4. 保存同步时间戳
      localStorage.setItem(this.LAST_SYNC_CHAT, String(serverTime));

    } catch (e) {
    }
  }
}

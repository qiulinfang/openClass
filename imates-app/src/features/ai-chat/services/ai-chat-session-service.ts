import { storage } from '@/services/storage';
import type { ChatMessage } from '@/services/ai-chat-service';
import type {
  AiChatContext,
  AiChatSession,
} from '../types';

const SESSION_INDEX_VERSION = 1;
const SESSION_INDEX_PREFIX = 'IMATES_AI_CHAT_SESSIONS_V1_';
const ACTIVE_SESSION_PREFIX = 'IMATES_AI_CHAT_ACTIVE_V1_';
const MESSAGE_PREFIX = 'IMATES_CHAT_SESSION_';

interface PersistedSessionIndex {
  version: number;
  sessions: AiChatSession[];
}

const normalizeTitle = (value: string): string => {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '新会话';
  return compact.length > 24 ? `${compact.slice(0, 24)}…` : compact;
};

const messageSummary = (messages: ChatMessage[]): string => {
  const content =
    [...messages]
      .reverse()
      .find((message) => message.content.trim())?.content || '';
  return normalizeTitle(content).slice(0, 46);
};

const sessionSort = (a: AiChatSession, b: AiChatSession): number => {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  return b.updatedAt - a.updatedAt;
};

export class AiChatSessionService {
  private static indexKey(userId: string): string {
    return `${SESSION_INDEX_PREFIX}${userId || 'user'}`;
  }

  private static activeKey(userId: string, scopeKey: string): string {
    return `${ACTIVE_SESSION_PREFIX}${userId || 'user'}_${encodeURIComponent(
      scopeKey
    )}`;
  }

  private static async readAll(userId: string): Promise<AiChatSession[]> {
    const raw = await storage.getItem(this.indexKey(userId));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as PersistedSessionIndex;
      return Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    } catch {
      return [];
    }
  }

  private static async writeAll(
    userId: string,
    sessions: AiChatSession[]
  ): Promise<void> {
    const payload: PersistedSessionIndex = {
      version: SESSION_INDEX_VERSION,
      sessions: sessions.sort(sessionSort),
    };
    await storage.setItem(this.indexKey(userId), JSON.stringify(payload));
  }

  private static async migrateLegacyGeneralSession(
    userId: string,
    sessions: AiChatSession[]
  ): Promise<AiChatSession[]> {
    const legacySessionId = await storage.getItem(
      `IMATES_LAST_SESSION_ID_${userId || 'user'}`
    );
    if (
      !legacySessionId ||
      sessions.some((session) => session.id === legacySessionId)
    ) {
      return sessions;
    }
    const messages = await this.loadMessages(legacySessionId);
    if (messages.length === 0) return sessions;
    const firstUserMessage = messages.find(
      (message) => message.sender === 'user' && message.content.trim()
    );
    const createdAt = Number(messages[0]?.timestamp) || Date.now();
    const updatedAt =
      Number(messages[messages.length - 1]?.timestamp) || createdAt;
    const legacySession: AiChatSession = {
      id: legacySessionId,
      scopeKey: 'general',
      scene: 'general',
      title: normalizeTitle(firstUserMessage?.content || '历史会话'),
      summary: messageSummary(messages),
      createdAt,
      updatedAt,
      messageCount: messages.length,
    };
    const nextSessions = [legacySession, ...sessions];
    await this.writeAll(userId, nextSessions);
    return nextSessions;
  }

  public static async loadSessions(
    userId: string,
    scopeKey: string
  ): Promise<AiChatSession[]> {
    let sessions = await this.readAll(userId);
    if (scopeKey === 'general') {
      sessions = await this.migrateLegacyGeneralSession(userId, sessions);
    }
    return sessions
      .filter((session) => session.scopeKey === scopeKey)
      .sort(sessionSort);
  }

  public static async getActiveSessionId(
    userId: string,
    scopeKey: string
  ): Promise<string | null> {
    return storage.getItem(this.activeKey(userId, scopeKey));
  }

  public static async setActiveSession(
    userId: string,
    scopeKey: string,
    sessionId: string | null
  ): Promise<void> {
    const key = this.activeKey(userId, scopeKey);
    if (sessionId) {
      await storage.setItem(key, sessionId);
      if (scopeKey === 'general') {
        await storage.setItem(
          `IMATES_LAST_SESSION_ID_${userId || 'user'}`,
          sessionId
        );
      }
      return;
    }
    await storage.removeItem(key);
  }

  public static createSession(
    userId: string,
    context: AiChatContext,
    firstPrompt: string
  ): AiChatSession {
    const now = Date.now();
    const suffix =
      context.scene === 'general'
        ? 'general-session'
        : context.scene === 'exercise'
          ? `exercise-${context.exerciseQuestion?.id || 'question'}`
          : `textbook-${context.resourceId || 'resource'}`;
    return {
      id: `${userId || 'user'}-${suffix}-${now}`,
      scopeKey: context.scopeKey,
      scene: context.scene,
      title: normalizeTitle(firstPrompt),
      summary: normalizeTitle(firstPrompt),
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      thumbnailUri: context.initialAttachment?.uri,
      pageNumber: context.initialAttachment?.pageNumber,
      resourceName: context.resourceName,
      subject: context.subject,
      sectionName: context.sectionName,
    };
  }

  public static async saveSession(
    userId: string,
    session: AiChatSession
  ): Promise<void> {
    const sessions = await this.readAll(userId);
    const index = sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) sessions[index] = session;
    else sessions.unshift(session);
    await this.writeAll(userId, sessions);
  }

  public static async saveConversation(
    userId: string,
    session: AiChatSession,
    messages: ChatMessage[]
  ): Promise<AiChatSession> {
    const nextSession: AiChatSession = {
      ...session,
      summary: messageSummary(messages),
      updatedAt: Date.now(),
      messageCount: messages.length,
    };
    await Promise.all([
      storage.setItem(
        `${MESSAGE_PREFIX}${session.id}`,
        JSON.stringify(messages)
      ),
      this.saveSession(userId, nextSession),
      this.setActiveSession(userId, session.scopeKey, session.id),
    ]);
    return nextSession;
  }

  /**
   * 导入云端会话时只更新会话与消息，不改变用户当前正在查看的会话。
   */
  public static async importConversation(
    userId: string,
    session: AiChatSession,
    messages: ChatMessage[]
  ): Promise<void> {
    await Promise.all([
      storage.setItem(
        `${MESSAGE_PREFIX}${session.id}`,
        JSON.stringify(messages)
      ),
      this.saveSession(userId, session),
    ]);
  }

  public static async loadMessages(
    sessionId: string
  ): Promise<ChatMessage[]> {
    const raw = await storage.getItem(`${MESSAGE_PREFIX}${sessionId}`);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public static async togglePinned(
    userId: string,
    sessionId: string
  ): Promise<AiChatSession[]> {
    const sessions = await this.readAll(userId);
    const target = sessions.find((session) => session.id === sessionId);
    if (target) {
      target.pinned = !target.pinned;
      target.updatedAt = Date.now();
      await this.writeAll(userId, sessions);
    }
    return sessions.sort(sessionSort);
  }

  public static async deleteSession(
    userId: string,
    session: AiChatSession
  ): Promise<void> {
    const sessions = await this.readAll(userId);
    await Promise.all([
      this.writeAll(
        userId,
        sessions.filter((item) => item.id !== session.id)
      ),
      storage.removeItem(`${MESSAGE_PREFIX}${session.id}`),
    ]);
    const activeId = await this.getActiveSessionId(
      userId,
      session.scopeKey
    );
    if (activeId === session.id) {
      await this.setActiveSession(userId, session.scopeKey, null);
    }
  }
}

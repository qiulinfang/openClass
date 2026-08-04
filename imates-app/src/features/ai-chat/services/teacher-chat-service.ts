import { AppEnvType, getCurrentEnvType } from '@/services/env-config';
import { HomeworkService } from '@/services/homework-service';
import { storage } from '@/services/storage';
import type { ChatMessage } from '@/services/ai-chat-service';
import { Platform, DeviceEventEmitter } from 'react-native';

export type TeacherSubject =
  | 'CHINESE'
  | 'MATH'
  | 'ENGLISH'
  | 'POLITICS'
  | 'HISTORY'
  | 'GEOGRAPHY'
  | 'PHYSICS'
  | 'CHEMISTRY'
  | 'BIOLOGY';

export interface TeacherChatSession {
  id: string;
  title: string;
  subject: TeacherSubject;
  subjectId: string;
}

interface TeacherSocketMessage {
  type?: string;
  sessionId?: string;
  content?: string;
  messageId?: string;
  timestamp?: string | number;
  msgType?: string;
  senderType?: string;
  [key: string]: unknown;
}

const SUBJECTS: Array<
  Pick<TeacherChatSession, 'title' | 'subject' | 'subjectId'>
> = [
  { title: '语文', subject: 'CHINESE', subjectId: '1' },
  { title: '数学', subject: 'MATH', subjectId: '2' },
  { title: '英语', subject: 'ENGLISH', subjectId: '3' },
  { title: '政治', subject: 'POLITICS', subjectId: '9' },
  { title: '历史', subject: 'HISTORY', subjectId: '7' },
  { title: '地理', subject: 'GEOGRAPHY', subjectId: '8' },
  { title: '物理', subject: 'PHYSICS', subjectId: '4' },
  { title: '化学', subject: 'CHEMISTRY', subjectId: '5' },
  { title: '生物', subject: 'BIOLOGY', subjectId: '6' },
];

const isUnauthorized = async (response: Response): Promise<boolean> => {
  if (response.status === 401) return true;
  try {
    return Number((await response.clone().json())?.code) === 401;
  } catch {
    return false;
  }
};

const parseTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value || '').trim();
  if (/^\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(text)) {
    return new Date(`${new Date().getFullYear()}-${text}:00`).getTime();
  }
  const parsed = new Date(text).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const extractHistoryRows = (payload: any): any[] => {
  let current = payload;
  for (let depth = 0; depth < 6; depth += 1) {
    if (Array.isArray(current)) return current;
    if (!current || typeof current !== 'object') return [];
    const key = ['data', 'records', 'list', 'rows'].find(
      (candidate) => current[candidate] !== undefined
    );
    if (!key) return [];
    current = current[key];
  }
  return [];
};

export class TeacherChatService {
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private currentSessionId: string | null = null;
  private onMessage: ((message: ChatMessage, sessionId: string) => void) | null =
    null;
  private onConnectionChange: ((connected: boolean) => void) | null = null;

  public static async getSessions(): Promise<TeacherChatSession[]> {
    const account =
      (await storage.getItem('xuebanuserid'))?.trim() || 'default';
    return SUBJECTS.map((item) => ({
      ...item,
      id: `teacher_${account}_${item.subject.toLowerCase()}`,
    }));
  }

  public setListeners(options: {
    onMessage: (message: ChatMessage, sessionId: string) => void;
    onConnectionChange: (connected: boolean) => void;
  }): void {
    this.onMessage = options.onMessage;
    this.onConnectionChange = options.onConnectionChange;
  }

  public setCurrentSession(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  private static getHistoryUrl(): string {
    const path =
      getCurrentEnvType() === AppEnvType.INTERNAL_TEST
        ? '/yb-teacher-test/yb-teacher/api/question/historyList'
        : '/yb-teacher-release/blw-edu-yb/api/question/historyList';
    return Platform.OS === 'web'
      ? path
      : `https://www.imates.com.cn${path}`;
  }

  private static getWebSocketPath(): string {
    return getCurrentEnvType() === AppEnvType.INTERNAL_TEST
      ? '/teacher-ws-test/yb-teacher-ws'
      : '/teacher-ws-release/blw-edu-yb/ws';
  }

  private static async getToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh) {
      const token = (await storage.getItem('YANBAN_TOKEN'))?.trim();
      if (token && token !== 'undefined') return token;
    }
    const account = (await storage.getItem('xuebanuserid'))?.trim();
    const password = await storage.getItem('userPassword');
    if (!account || !password) {
      throw new Error('登录信息已失效，请退出后重新登录');
    }
    const token = await HomeworkService.loginYanban(account, password);
    return token.trim();
  }

  public async loadHistory(sessionId: string): Promise<ChatMessage[]> {
    const send = async (token: string) =>
      fetch(TeacherChatService.getHistoryUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Token: token,
          'sa-token': token,
          authorization: token,
        },
        body: JSON.stringify({ sessionId, page: 1, pageSize: 100 }),
      });

    let token = await TeacherChatService.getToken();
    let response = await send(token);
    if (await isUnauthorized(response)) {
      await storage.removeItem('YANBAN_TOKEN');
      token = await TeacherChatService.getToken(true);
      response = await send(token);
    }
    if (await isUnauthorized(response)) {
      await storage.removeItem('XUEBAN_TOKEN');
      await storage.removeItem('YANBAN_TOKEN');
      DeviceEventEmitter.emit('FORCE_LOGOUT', { message: '登录凭证已失效，请重新登录。' });
      throw new Error('登录凭证已失效，请重新登录');
    }
    if (!response.ok) {
      throw new Error(`老师答疑记录加载失败（HTTP ${response.status}）`);
    }

    const rows = extractHistoryRows(await response.json());
    const account = (await storage.getItem('xuebanuserid'))?.trim();
    return rows
      .map((row: any): ChatMessage => {
        const senderType = String(row.senderType || '').toLowerCase();
        const isSelf = senderType
          ? senderType === 'user'
          : String(row.account || row.msgSendId || '') === account;
        const isImage = String(row.msgType || '0') === '1';
        return {
          id: String(row.messageId || row.id || `teacher-${Math.random()}`),
          sender: isSelf ? 'user' : 'ai',
          content: isImage ? '' : String(row.msgContent || row.content || ''),
          timestamp: parseTimestamp(row.createTime || row.timestamp),
          imageUri: isImage
            ? TeacherChatService.resolveResourceUrl(
                String(row.msgContent || row.content || '')
              )
            : undefined,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private static resolveResourceUrl(path: string): string {
    if (!path || path.startsWith('http') || path.startsWith('data:')) {
      return path;
    }
    return `https://www.imates.com.cn:9099${path.startsWith('/') ? '' : '/'}${path}`;
  }

  public async connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      const token = await TeacherChatService.getToken();
      const userId =
        (await storage.getItem('yanbanuserid'))?.trim() ||
        (await storage.getItem('xuebanuserid'))?.trim() ||
        'guest';
      const url =
        `wss://www.imates.com.cn${TeacherChatService.getWebSocketPath()}` +
        `?userId=${encodeURIComponent(userId)}` +
        `&clientType=web&token=${encodeURIComponent(token)}`;

      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(url);
        let opened = false;
        let settled = false;
        this.socket = socket;
        const succeed = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          reject(error);
        };
        const timeout = setTimeout(() => {
          socket.close();
          fail(new Error('老师答疑连接超时'));
        }, 10000);

        socket.onopen = () => {
          clearTimeout(timeout);
          if (this.socket !== socket) {
            socket.close();
            fail(new Error('老师答疑连接已取消'));
            return;
          }
          opened = true;
          this.onConnectionChange?.(true);
          this.heartbeat = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'PING' }));
            }
          }, 30000);
          succeed();
        };
        socket.onerror = () => {
          clearTimeout(timeout);
          if (this.socket === socket) this.socket = null;
          fail(new Error('老师答疑连接失败'));
        };
        socket.onclose = () => {
          clearTimeout(timeout);
          if (this.socket === socket) this.socket = null;
          this.clearHeartbeat();
          this.onConnectionChange?.(false);
          if (!opened) fail(new Error('老师答疑连接已断开'));
        };
        socket.onmessage = (event) => {
          try {
            this.handleSocketMessage(JSON.parse(String(event.data)));
          } catch {
            // 心跳或非 JSON 消息无需影响当前会话。
          }
        };
      });
    })().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private handleSocketMessage(message: TeacherSocketMessage): void {
    if (
      message.type !== 'TEACHER_RESPONSE' ||
      !message.sessionId ||
      !message.messageId
    ) {
      return;
    }
    const image = message.msgType === '1';
    this.onMessage?.(
      {
        id: message.messageId,
        sender: 'ai',
        content: image ? '' : String(message.content || ''),
        timestamp: parseTimestamp(message.timestamp),
        imageUri: image
          ? TeacherChatService.resolveResourceUrl(String(message.content || ''))
          : undefined,
      },
      message.sessionId
    );
  }

  public async send(
    session: TeacherChatSession,
    content: string
  ): Promise<ChatMessage> {
    this.setCurrentSession(session.id);
    await this.connect();
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('老师答疑连接尚未建立');
    }
    const userId =
      (await storage.getItem('xuebanuserid'))?.trim() || '';
    const timestamp = Date.now();
    const messageId = `msg_${timestamp}_${Math.random()
      .toString(36)
      .slice(2, 11)}`;
    this.socket.send(
      JSON.stringify({
        type: 'STUDENT_MESSAGE',
        sessionId: session.id,
        content,
        msgType: '0',
        userId,
        messageId,
        subject: session.subjectId,
        timestamp: String(timestamp),
        senderType: 'user',
        from: userId,
      })
    );
    return {
      id: messageId,
      sender: 'user',
      content,
      timestamp,
    };
  }

  private clearHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  public disconnect(): void {
    this.clearHeartbeat();
    const socket = this.socket;
    this.socket = null;
    if (socket) socket.close();
    this.connectPromise = null;
    this.currentSessionId = null;
    this.onConnectionChange?.(false);
  }
}

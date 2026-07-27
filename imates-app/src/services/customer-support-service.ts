export type CustomerSupportSender = 'user' | 'agent' | 'system';

export interface CustomerSupportMessage {
  id: string;
  content: string;
  sender: CustomerSupportSender;
  timestamp: string;
  read?: boolean;
}

interface ServerChatMessage {
  messageId?: string;
  fromId?: string;
  from?: string;
  content?: string;
  createdAt?: string;
  timestamp?: string;
  read?: boolean;
  type?: string;
}

interface CustomerSupportListeners {
  onMessage: (message: CustomerSupportMessage) => void;
  onConnectionChange: (connected: boolean) => void;
  onError: (message: string) => void;
}

const IM_API_BASE_URL = 'https://www.imates.com.cn:8200';
const IM_WEBSOCKET_URL = 'wss://www.imates.com.cn:8200/ws/im';
const SUPPORT_AGENT_ID = 'Agent_007';

const createMessageId = (): string =>
  `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const toCustomerSupportMessage = (
  message: ServerChatMessage,
  userId: string
): CustomerSupportMessage => ({
  id: message.messageId || createMessageId(),
  content: message.content || '',
  sender:
    (message.fromId || message.from) === userId
      ? 'user'
      : message.type === 'SYSTEM'
        ? 'system'
        : 'agent',
  timestamp:
    message.createdAt || message.timestamp || new Date().toISOString(),
  read: message.read,
});

export class CustomerSupportService {
  private socket: WebSocket | null = null;
  private userId = '';
  private listeners: CustomerSupportListeners | null = null;

  async loadHistory(userId: string): Promise<CustomerSupportMessage[]> {
    const conversationId = `user-client-session-${userId}`;
    const response = await fetch(
      `${IM_API_BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages?page=1&pageSize=50`
    );
    if (!response.ok) {
      throw new Error(`客服记录加载失败 (HTTP ${response.status})`);
    }

    const result = await response.json();
    const messages = Array.isArray(result?.messages) ? result.messages : [];
    return messages
      .map((message: ServerChatMessage) =>
        toCustomerSupportMessage(message, userId)
      )
      .filter((message: CustomerSupportMessage) => message.content.trim())
      .sort(
        (first: CustomerSupportMessage, second: CustomerSupportMessage) =>
          new Date(first.timestamp).getTime() -
          new Date(second.timestamp).getTime()
      );
  }

  async connect(
    userId: string,
    listeners: CustomerSupportListeners
  ): Promise<void> {
    this.disconnect();
    this.userId = userId;
    this.listeners = listeners;

    const authResponse = await fetch(
      `${IM_API_BASE_URL}/api/auth/user-login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `userId=${encodeURIComponent(userId)}`,
      }
    );
    const authResult = await authResponse.json();
    const imToken = authResult?.data?.token;
    if (!authResponse.ok || !authResult?.success || !imToken) {
      throw new Error(authResult?.message || '客服身份认证失败');
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(
        `${IM_WEBSOCKET_URL}?token=${encodeURIComponent(imToken)}&role=user`
      );
      this.socket = socket;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.close();
        reject(new Error('连接客服超时，请重试'));
      }, 12000);

      socket.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        listeners.onConnectionChange(true);
        this.sendUserJoin();
        this.sendReadStatus();
        resolve();
      };

      socket.onmessage = (event) => {
        try {
          const serverMessage = JSON.parse(event.data) as ServerChatMessage;
          if (serverMessage.type === 'CHAT' && serverMessage.content?.trim()) {
            listeners.onMessage(
              toCustomerSupportMessage(serverMessage, this.userId)
            );
            this.sendReadStatus();
          }
        } catch (error) {
          console.warn('[CustomerSupport] 无法解析客服消息:', error);
        }
      };

      socket.onerror = () => {
        listeners.onConnectionChange(false);
        listeners.onError('客服连接出现异常，请稍后重试');
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error('客服连接失败'));
        }
      };

      socket.onclose = () => {
        clearTimeout(timeout);
        listeners.onConnectionChange(false);
      };
    });
  }

  send(content: string): CustomerSupportMessage {
    const normalizedContent = content.trim();
    if (
      !normalizedContent ||
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN
    ) {
      throw new Error('客服尚未连接');
    }

    const message: CustomerSupportMessage = {
      id: createMessageId(),
      content: normalizedContent,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    this.socket.send(
      JSON.stringify({
        type: 'CHAT',
        content: message.content,
        timestamp: message.timestamp,
        from: this.userId,
        to: SUPPORT_AGENT_ID,
        messageId: message.id,
        conversationId: `user-client-session-${this.userId}`,
      })
    );
    return message;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.close();
    }
    this.socket = null;
    this.listeners = null;
  }

  private sendUserJoin(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(
      JSON.stringify({
        type: 'USER_JOIN',
        from: this.userId,
        to: SUPPORT_AGENT_ID,
        conversationId: `user-client-session-${this.userId}`,
        timestamp: new Date().toISOString(),
        userId: this.userId,
      })
    );
  }

  private sendReadStatus(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(
      JSON.stringify({
        type: 'READ_STATUS',
        from: this.userId,
        to: SUPPORT_AGENT_ID,
        conversationId: `user-client-session-${this.userId}`,
        timestamp: new Date().toISOString(),
        status: 'read',
      })
    );
  }
}

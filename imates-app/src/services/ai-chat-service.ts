import { storage } from './storage';
import { AppEnvType, getCurrentEnvType } from './env-config';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  imageUri?: string; // 支持图片气泡渲染
}

interface SSEPayload {
  content?: string;
  agent_status?: string;
  history_messages?: any[];
}

export class AiChatService {
  /**
   * 获取当前环境下的 AI 聊天 API 终点 URL
   */
  private static getApiUrl(): string {
    const env = getCurrentEnvType();
    if (env === AppEnvType.INTERNAL_TEST) {
      return 'http://www.imates.com.cn:58443/blw-edu-service-alc/ai/2.0/chats';
    }
    return 'http://www.imates.com.cn:8222/blw-edu-service-alc/ai/2.0/chats';
  }

  /**
   * 去掉尾部的 end 标记（后端可能在文本末尾附带 end）
   */
  private static stripTrailingEnd(text: string): string {
    const input = String(text ?? '');
    const trimmed = input.trim();
    if (/^end$/i.test(trimmed)) return '';
    return input.replace(/end\s*$/i, '');
  }

  /**
   * 合并新旧内容，处理后端可能返回全量文本或增量文本的情况
   */
  private static mergeContent(accumulated: string, newChunk: string): string {
    if (!newChunk) return accumulated;
    if (!accumulated) return newChunk;

    const matchIndex = newChunk.indexOf(accumulated);
    if (matchIndex !== -1 && accumulated.length > 5) {
      const realNewPart = newChunk.slice(matchIndex + accumulated.length);
      return accumulated + realNewPart;
    }

    return accumulated + newChunk;
  }

  /**
   * 解析可能包含 data: 的 SSE 报文
   */
  private static parseSseText(raw: string): {
    hasData: boolean;
    ended: boolean;
    textChunk: string;
    latestHistory?: any[];
  } {
    const input = String(raw || '');
    const normalized = input.replace(/\r\n/g, '\n');
    const lines = normalized
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const dataParts = normalized.includes('data:')
      ? normalized
          .split('data:')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

    let hasData = false;
    let ended = false;
    let textChunk = '';
    let latestHistory: any[] | undefined;

    if (lines.length === 1 && lines[0] === 'end') {
      return { hasData: false, ended: true, textChunk: '' };
    }

    const handlePayloadString = (payloadStr: string) => {
      const trimmed = payloadStr.trim();
      if (!trimmed) return;

      const withoutTrailingEnd = trimmed.endsWith('end') ? trimmed.slice(0, -3).trim() : trimmed;
      if (trimmed !== withoutTrailingEnd) {
        ended = true;
      }

      if (!withoutTrailingEnd) return;

      if (withoutTrailingEnd === 'end') {
        ended = true;
        return;
      }

      try {
        const payload = JSON.parse(withoutTrailingEnd) as SSEPayload;
        if (typeof payload.content === 'string' && payload.content.length > 0) {
          textChunk += payload.content;
        }
        if (Array.isArray(payload.history_messages) && payload.history_messages.length > 0) {
          latestHistory = payload.history_messages;
        }
      } catch (e) {
        console.warn('[AiChatService] SSE payload 解析失败:', { payloadStr: withoutTrailingEnd, error: e });
      }
    };

    if (dataParts.length > 0) {
      hasData = true;
      for (const part of dataParts) {
        if (part === 'end') {
          ended = true;
          continue;
        }
        handlePayloadString(part);
      }
    } else {
      for (const line of lines) {
        if (line === 'end') {
          ended = true;
          continue;
        }
        if (!line.startsWith('data:')) {
          continue;
        }
        hasData = true;
        const jsonStr = line.slice('data:'.length).trim();
        if (!jsonStr) continue;
        if (jsonStr === 'end') {
          ended = true;
          continue;
        }
        handlePayloadString(jsonStr);
      }
    }

    return {
      hasData,
      ended,
      textChunk,
      latestHistory,
    };
  }

  /**
   * 发送聊天请求并以打字机流式效果返回回复（对接真实轮询接口）
   * @param userMessage 用户输入内容
   * @param sessionId 当前会话 ID
   * @param onChunk 每次收到字符碎片时的回调
   * @param onComplete 回复结束时的回调
   * @param onError 发生错误时的回调
   */
  public static sendStreamMessage(
    userMessage: string,
    sessionId: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullText: string, historyMessages?: any[]) => void,
    onError: (err: Error) => void
  ) {
    let isCancelled = false;
    let accumulatedContent = '';
    let latestHistory: any[] = [];
    let pollTimer: NodeJS.Timeout | null = null;

    const cancel = () => {
      isCancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };

    const poll = async (isFirst: boolean) => {
      if (isCancelled) return;

      try {
        const url = this.getApiUrl();
        const token = await storage.getItem('XUEBAN_TOKEN') || '';
        const userId = await storage.getItem('xuebanuserid') || 'User';

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Token': token,
          'sa-token': token,
          'authorization': token,
        };

        const dstUrl = getCurrentEnvType() === AppEnvType.INTERNAL_TEST
          ? '/xb-test/ai/2.0/chats'
          : '/xb-release/ai/2.0/chats';

        const body = {
          sessionId: sessionId,
          newValue: isFirst ? '1' : '0',
          coversation: isFirst ? userMessage : '',
          question: '',
          answer: '',
          name: userId,
          reason: isFirst ? 'start' : 'continue',
          bmNo: sessionId,
          isWebSearch: '0',
          role: 'mate',
          subject: '',
          dstUrl: dstUrl,
          explanation: '',
        };

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`HTTP 异常: ${response.status}`);
        }

        const resData = await response.json();
        
        if (!resData.success) {
          throw new Error(resData.message || '服务器返回错误');
        }

        // 提取消息内容
        const rawMessage = resData.data && resData.data.message != null ? resData.data.message : resData.message ?? '';
        const rawStr = String(rawMessage).trim();

        // 采用 Web 端的健壮式解析
        const parsed = this.parseSseText(rawStr);
        
        if (parsed.latestHistory && parsed.latestHistory.length > 0) {
          latestHistory = parsed.latestHistory;
        }

        const chunkText = parsed.hasData ? parsed.textChunk : this.stripTrailingEnd(rawStr);

        if (chunkText) {
          // 合并内容，完美解决全量包与增量包对齐问题
          const newAccumulated = this.mergeContent(accumulatedContent, chunkText);
          const delta = newAccumulated.slice(accumulatedContent.length);
          if (delta) {
            accumulatedContent = newAccumulated;
            onChunk(delta);
          }
        }

        // 判断是否结束
        if (parsed.ended || rawStr.endsWith('end') || rawStr === 'end') {
          onComplete(accumulatedContent, latestHistory);
        } else {
          // 继续轮询
          pollTimer = setTimeout(() => {
            poll(false);
          }, 500);
        }
      } catch (err: any) {
        if (!isCancelled) {
          onError(err);
        }
      }
    };

    // 启动轮询
    poll(true);

    return cancel;
  }
}

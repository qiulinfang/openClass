import { Platform } from 'react-native';
import { storage } from './storage';
import { AppEnvType, getCurrentEnvType } from './env-config';
import { DeviceEventEmitter } from 'react-native';
import { getXuebanApiUrl } from './api-url';
import { authService } from './auth-service';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  isStopped?: boolean;
  isError?: boolean;
  retryCount?: number;
  imageUri?: string; // 支持图片气泡渲染
}

interface SSEPayload {
  content?: string;
  agent_status?: string;
  history_messages?: any[];
}

export interface TextbookExploreRequest {
  prompt: string;
  sessionId: string;
  imageDataUrl?: string;
  subject?: string;
  sectionName?: string;
  isNewSession: boolean;
}

export interface AiConversationRequest extends TextbookExploreRequest {
  scene: 'general' | 'textbook' | 'exercise';
  role?: 'mate' | 'mentor' | 'researcher';
  enableWebSearch?: boolean;
  forcePreviewPictureApi?: boolean;
}

export class AiChatService {
  /**
   * 获取当前环境下的 AI 聊天 API 终点 URL
   */
  private static getApiUrl(): string {
    return getXuebanApiUrl('/ai/2.0/chats');
  }

  /**
   * 教材截图问答与 Web 端保持相同路由。
   * Web 必须走 Metro/Nginx 同源代理，原生端继续使用原有学伴服务地址。
   */
  private static getConversationApiUrl(path: string): string {
    if (Platform.OS === 'web') return path;
    const port =
      getCurrentEnvType() === AppEnvType.INTERNAL_TEST ? '58443' : '8222';
    const endpoint = path.split('/ai/2.0/')[1] || 'chats';
    return `http://www.imates.com.cn:${port}/blw-edu-service-alc/ai/2.0/${endpoint}`;
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
   * 兼容部分 AI 接口把多个 JSON 对象直接拼接返回的情况。
   */
  private static extractMessageFromConcatenatedJson(
    text: string
  ): string | null {
    const input = String(text || '').trim();
    if (!input.startsWith('{') || !input.includes('"message"')) {
      return null;
    }

    const objects: any[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaping = false;

    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (char === '\\') {
          escaping = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        if (depth === 0) start = index;
        depth += 1;
      } else if (char === '}') {
        if (depth > 0) depth -= 1;
        if (depth === 0 && start >= 0) {
          try {
            objects.push(JSON.parse(input.slice(start, index + 1)));
          } catch {
            return null;
          }
          start = -1;
        }
      }
    }

    if (objects.length <= 1) return null;
    const messages = objects
      .map((item) =>
        item && typeof item.message === 'string' ? item.message : ''
      )
      .filter(Boolean);
    return messages.length > 0 ? messages.join('\n') : null;
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

        if (response.status === 401) {
          console.warn('[AiChatService] Token 401 过期，触发强制登出...');
          await storage.removeItem('XUEBAN_TOKEN');
          await storage.removeItem('YANBAN_TOKEN');
          DeviceEventEmitter.emit('FORCE_LOGOUT', { message: '设备已经在其他地方登陆，请重新登录。' });
          throw new Error('设备已经在其他地方登陆');
        }

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

  /**
   * 通用 AI 对话请求。主 AI 问答和教材探索共用同一套轮询、
   * 鉴权刷新与响应解析逻辑。
   */
  public static sendConversationMessage(
    request: AiConversationRequest,
    onChunk: (chunk: string) => void,
    onComplete: (fullText: string) => void,
    onError: (err: Error) => void
  ) {
    let isCancelled = false;
    let accumulatedContent = '';
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const abortController = new AbortController();

    const cancel = () => {
      if (isCancelled) return;
      isCancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
      abortController.abort();
    };

    const poll = async (isFirstRequest: boolean) => {
      if (isCancelled) return;

      try {
        let [token, userId] = await Promise.all([
          storage.getItem('XUEBAN_TOKEN'),
          storage.getItem('xuebanuserid'),
        ]);
        if (!token?.trim()) {
          const password = await storage.getItem('userPassword');
          if (!userId?.trim() || !password?.trim()) {
            throw new Error('学伴登录已失效，请退出后重新登录');
          }
          token = await authService.loginXueban(
            userId.trim(),
            password
          );
        }

        const normalizedImage = request.imageDataUrl?.startsWith(
          'data:image/jpeg;'
        )
          ? request.imageDataUrl.replace(
              'data:image/jpeg;',
              'data:image/jpg;'
            )
          : request.imageDataUrl;
        const usePreviewPictureApi =
          !!request.forcePreviewPictureApi || !!normalizedImage;
        const destinationPath =
          getCurrentEnvType() === AppEnvType.INTERNAL_TEST
            ? `/xb-test/ai/2.0/${
                usePreviewPictureApi ? 'previewPictureQA' : 'chats'
              }`
            : `/xb-release/ai/2.0/${
                usePreviewPictureApi ? 'previewPictureQA' : 'chats'
              }`;
        const requestBody = JSON.stringify({
          sessionId: request.sessionId,
          newValue:
            isFirstRequest && request.isNewSession ? '1' : '0',
          coversation: isFirstRequest ? request.prompt : '',
          question: '',
          answer:
            request.scene === 'textbook' ? request.sectionName || '' : '',
          name: userId?.trim() || 'User',
          reason: isFirstRequest ? 'start' : 'continue',
          bmNo: request.sessionId,
          isWebSearch: request.enableWebSearch ? '1' : '0',
          role: request.role || 'mate',
          subject: request.subject || '',
          sectionName:
            request.scene === 'textbook'
              ? request.sectionName || undefined
              : undefined,
          dstUrl: destinationPath,
          explanation: '',
          imageList:
            isFirstRequest && normalizedImage
              ? [{ base64DataUrl: normalizedImage }]
              : undefined,
        });
        const sendRequest = (authToken: string) =>
          fetch(this.getConversationApiUrl(destinationPath), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Token: authToken,
              'sa-token': authToken,
              authorization: authToken,
            },
            body: requestBody,
            signal: abortController.signal,
          });

        let response = await sendRequest(token.trim());
        if (isCancelled) return;
        let payload: any;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        const isUnauthorized = () => {
          const code = Number(
            payload?.code ??
              payload?.status ??
              payload?.data?.code ??
              payload?.data?.status
          );
          return (
            response.status === 401 ||
            code === 401 ||
            code === 28004
          );
        };

        if (isUnauthorized()) {
          const [account, password] = await Promise.all([
            storage.getItem('xuebanuserid'),
            storage.getItem('userPassword'),
          ]);
          if (!account?.trim() || !password?.trim()) {
            throw new Error('学伴登录已失效，请退出后重新登录');
          }
          const refreshedToken = await authService.loginXueban(
            account.trim(),
            password
          );
          response = await sendRequest(refreshedToken.trim());
          if (isCancelled) return;
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }
        }

        if (isCancelled) return;
        if (isUnauthorized()) {
          throw new Error('学伴登录已失效，请退出后重新登录');
        }
        if (!response.ok || payload?.success === false) {
          const serverMessage =
            payload?.message ||
            payload?.msg ||
            (typeof payload?.data === 'string' ? payload.data : '');
          throw new Error(
            serverMessage || `探索问答请求失败（HTTP ${response.status}）`
          );
        }
        const rawMessage = String(
          payload?.data?.message ?? payload?.message ?? ''
        ).trim();
        if (rawMessage === '成功' && !rawMessage.includes('data:')) {
          pollTimer = setTimeout(() => void poll(false), 500);
          return;
        }
        const normalizedMessage =
          this.extractMessageFromConcatenatedJson(rawMessage) ?? rawMessage;
        const parsed = this.parseSseText(normalizedMessage);
        const chunkText = parsed.hasData
          ? parsed.textChunk
          : this.stripTrailingEnd(normalizedMessage);

        if (chunkText) {
          const nextContent = this.mergeContent(
            accumulatedContent,
            chunkText
          );
          const delta = nextContent.slice(accumulatedContent.length);
          accumulatedContent = nextContent;
          if (delta) onChunk(delta);
        }

        if (
          parsed.ended ||
          normalizedMessage === 'end' ||
          normalizedMessage.endsWith('end')
        ) {
          if (isCancelled) return;
          onComplete(accumulatedContent);
          return;
        }
        pollTimer = setTimeout(() => void poll(false), 500);
      } catch (error) {
        if (!isCancelled) {
          onError(
            error instanceof Error ? error : new Error('探索问答请求失败')
          );
        }
      }
    };

    void poll(true);
    return cancel;
  }

  /**
   * 保留教材调用入口，内部转到统一对话请求。
   */
  public static sendTextbookExploreMessage(
    request: TextbookExploreRequest,
    onChunk: (chunk: string) => void,
    onComplete: (fullText: string) => void,
    onError: (err: Error) => void
  ) {
    return this.sendConversationMessage(
      {
        ...request,
        scene: 'textbook',
        forcePreviewPictureApi: true,
      },
      onChunk,
      onComplete,
      onError
    );
  }

  /**
   * 练习场景专用 AI 请求：沿用 Web 端 solvingbot 参数，传递真实题干、答案与题号。
   */
  public static sendExerciseStreamMessage(
    userMessage: string,
    sessionId: string,
    question: {
      id: string;
      content: string;
      answer?: string;
      analysis?: string;
      subject: string;
    },
    options: {
      isNewSession: boolean;
      role?: 'mate' | 'mentor' | 'researcher';
      enableWebSearch?: boolean;
    },
    onChunk: (chunk: string) => void,
    onComplete: (fullText: string) => void,
    onError: (err: Error) => void
  ) {
    let isCancelled = false;
    let accumulatedContent = '';
    let pollTimer: NodeJS.Timeout | null = null;
    const abortController = new AbortController();

    const subjectMap: Record<string, string> = {
      '1': 'chinese',
      '2': 'math',
      '3': 'english',
      '4': 'physics',
      '5': 'chemistry',
      '6': 'biology',
      '7': 'geography',
      '8': 'history',
      '9': 'politics',
      数学: 'math',
      生物: 'biology',
      化学: 'chemistry',
      物理: 'physics',
      语文: 'chinese',
      英语: 'english',
    };
    const normalizedSubject =
      subjectMap[String(question.subject)] ||
      String(question.subject || 'math').toLowerCase();

    const cancel = () => {
      isCancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      abortController.abort();
    };

    const poll = async (isFirst: boolean) => {
      if (isCancelled) return;
      try {
        let [token, userId] = await Promise.all([
          storage.getItem('XUEBAN_TOKEN'),
          storage.getItem('xuebanuserid'),
        ]);
        if (!token?.trim()) {
          const password = await storage.getItem('userPassword');
          if (!userId?.trim() || !password?.trim()) {
            throw new Error('学伴登录已失效，请退出后重新登录');
          }
          token = await authService.loginXueban(userId.trim(), password);
        }
        const prefix =
          getCurrentEnvType() === AppEnvType.INTERNAL_TEST ? '/xb-test' : '/xb-release';
        const dstUrl =
          normalizedSubject === 'math'
            ? `${prefix}/ai/2.0/chatMath`
            : `${prefix}/ai/2.0/chat`;
        const requestBody = JSON.stringify({
            sessionId,
            newValue:
              isFirst && options.isNewSession ? '1' : '0',
            coversation: isFirst ? userMessage : '',
            question: question.content,
            answer: question.answer || '',
            name: userId || 'User',
            reason: isFirst ? 'start' : 'continue',
            bmNo: question.id,
            isWebSearch: options.enableWebSearch ? '1' : '0',
            role: options.role || 'mate',
            subject: normalizedSubject.toUpperCase(),
            dstUrl,
            explanation: question.analysis || '',
          });
        const send = (authToken: string) =>
          fetch(this.getConversationApiUrl(dstUrl), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Token: authToken,
              'sa-token': authToken,
              authorization: authToken,
            },
            body: requestBody,
            signal: abortController.signal,
          });
        let response = await send(token.trim());
        let payload = await response.json().catch(() => null);
        const unauthorized = () =>
          response.status === 401 ||
          [401, 28004].includes(
            Number(payload?.code ?? payload?.data?.code)
          );
        if (unauthorized()) {
          const password = await storage.getItem('userPassword');
          if (!userId?.trim() || !password?.trim()) {
            throw new Error('学伴登录已失效，请退出后重新登录');
          }
          token = await authService.loginXueban(userId.trim(), password);
          response = await send(token.trim());
          payload = await response.json().catch(() => null);
        }
        if (unauthorized()) {
          throw new Error('学伴登录已失效，请退出后重新登录');
        }
        if (!response.ok || payload?.success === false) {
          throw new Error(
            payload?.message || `AI 导学请求失败（HTTP ${response.status}）`
          );
        }
        const raw = String(payload?.data?.message ?? payload?.message ?? '').trim();
        if (raw === '成功' && !raw.includes('data:')) {
          pollTimer = setTimeout(() => void poll(false), 500);
          return;
        }
        const normalizedRaw =
          this.extractMessageFromConcatenatedJson(raw) ?? raw;
        const parsed = this.parseSseText(normalizedRaw);
        const nextChunk = parsed.hasData
          ? parsed.textChunk
          : this.stripTrailingEnd(normalizedRaw);
        if (nextChunk) {
          const merged = this.mergeContent(accumulatedContent, nextChunk);
          const delta = merged.slice(accumulatedContent.length);
          accumulatedContent = merged;
          if (delta) onChunk(delta);
        }
        if (
          parsed.ended ||
          normalizedRaw.endsWith('end') ||
          normalizedRaw === 'end'
        ) {
          onComplete(accumulatedContent);
        } else {
          pollTimer = setTimeout(() => void poll(false), 500);
        }
      } catch (error) {
        if (!isCancelled) {
          onError(error instanceof Error ? error : new Error('AI 导学请求失败'));
        }
      }
    };

    void poll(true);
    return cancel;
  }
}

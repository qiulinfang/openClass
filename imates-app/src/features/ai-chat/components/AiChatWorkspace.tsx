import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppSafeAreaInsets } from '@/components/AppSafeArea';
import * as ImagePicker from 'expo-image-picker';
import {
  AiChatService,
  type ChatMessage,
} from '@/services/ai-chat-service';
import { storage } from '@/services/storage';
import { SyncService } from '@/services/sync-service';
import { AiChatSessionService } from '../services/ai-chat-session-service';
import {
  TeacherChatService,
  type TeacherChatSession,
} from '../services/teacher-chat-service';
import type {
  AiChatAttachment,
  AiChatContext,
  AiChatRole,
  AiChatSession,
  AiChatWorkspaceTab,
} from '../types';
import { AiConversationView } from './AiConversationView';
import type { ChatKeyboardAvoidanceMode } from './ChatKeyboardAvoidingView';
import { AiSessionList } from './AiSessionList';
import { TeacherConversationView } from './TeacherConversationView';
import { TeacherSessionList } from './TeacherSessionList';

interface AiChatWorkspaceProps {
  context: AiChatContext;
  onClose?: () => void;
  onReselect?: () => void;
  prefillStorageKey?: string;
  respectBottomSafeArea?: boolean;
  keyboardAvoidanceMode?: ChatKeyboardAvoidanceMode;
  initialTab?: AiChatWorkspaceTab;
  initialCategory?: 'companion' | 'teacher';
  initialSessionId?: string;
}

const attachmentKey = (
  attachment: AiChatAttachment | null | undefined
): string =>
  attachment
    ? `${attachment.pageNumber || 0}-${attachment.dataUrl.slice(-48)}`
    : '';

const sortSessions = (
  first: AiChatSession,
  second: AiChatSession
): number => {
  if (!!first.pinned !== !!second.pinned) return first.pinned ? -1 : 1;
  return second.updatedAt - first.updatedAt;
};

const replaceMessage = (
  messages: ChatMessage[],
  messageId: string,
  update: (message: ChatMessage) => ChatMessage
): ChatMessage[] => {
  const lastIndex = messages.length - 1;
  const index =
    messages[lastIndex]?.id === messageId
      ? lastIndex
      : messages.findIndex((message) => message.id === messageId);
  if (index < 0) return messages;
  const nextMessages = messages.slice();
  nextMessages[index] = update(messages[index]);
  return nextMessages;
};

export function AiChatWorkspace({
  context,
  onClose,
  onReselect,
  prefillStorageKey,
  respectBottomSafeArea = true,
  keyboardAvoidanceMode = 'active',
  initialTab = 'chat',
  initialCategory = 'companion',
  initialSessionId,
}: AiChatWorkspaceProps) {
  const insets = useAppSafeAreaInsets();
  const cancelRequestRef = useRef<(() => void) | null>(null);
  const activeRequestRef = useRef<{
    session: AiChatSession;
    messages: ChatMessage[];
    aiMessageId: string;
    accumulated: string;
  } | null>(null);
  const loadedAttachmentKeyRef = useRef('');
  const teacherServiceRef = useRef(new TeacherChatService());
  const currentTeacherSessionIdRef = useRef<string | null>(null);
  const pendingTeacherForwardRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] =
    useState<AiChatWorkspaceTab>(initialTab);
  const [chatCategory, setChatCategory] =
    useState<'companion' | 'teacher'>(initialCategory);
  const [userId, setUserId] = useState('user');
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [currentSession, setCurrentSession] =
    useState<AiChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [pendingAttachment, setPendingAttachment] =
    useState<AiChatAttachment | null>(
      context.initialAttachment || null
    );
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [role, setRole] = useState<AiChatRole>('mate');
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [teacherSessions, setTeacherSessions] = useState<
    TeacherChatSession[]
  >([]);
  const [currentTeacherSession, setCurrentTeacherSession] =
    useState<TeacherChatSession | null>(null);
  const [teacherMessages, setTeacherMessages] = useState<ChatMessage[]>([]);
  const [teacherInputText, setTeacherInputText] = useState('');
  const [isLoadingTeacherHistory, setIsLoadingTeacherHistory] =
    useState(false);
  const [isSendingToTeacher, setIsSendingToTeacher] = useState(false);
  const [isTeacherConnected, setIsTeacherConnected] = useState(false);
  const [teacherUnreadIds, setTeacherUnreadIds] = useState<Set<string>>(
    new Set()
  );
  const [pendingTeacherForwardCount, setPendingTeacherForwardCount] =
    useState(0);

  const initialAttachmentKey = useMemo(
    () => attachmentKey(context.initialAttachment),
    [context.initialAttachment]
  );

  const refreshSessions = async (
    nextUserId = userId
  ): Promise<AiChatSession[]> => {
    const nextSessions = await AiChatSessionService.loadSessions(
      nextUserId,
      context.scopeKey
    );
    setSessions(nextSessions);
    return nextSessions;
  };

  const upsertSession = (session: AiChatSession) => {
    setSessions((current) =>
      [session, ...current.filter((item) => item.id !== session.id)].sort(
        sortSessions
      )
    );
  };

  useEffect(() => {
    let disposed = false;
    cancelRequestRef.current?.();
    cancelRequestRef.current = null;
    activeRequestRef.current = null;
    setIsSending(false);
    setEditingMessageId(null);
    setIsLoadingSessions(true);
    setIsInitialized(false);

    const initialize = async () => {
      const nextUserId =
        (await storage.getItem('xuebanuserid'))?.trim() || 'user';
      const nextSessions = await AiChatSessionService.loadSessions(
        nextUserId,
        context.scopeKey
      );
      const nextTeacherSessions = await TeacherChatService.getSessions();
      if (disposed) return;
      setUserId(nextUserId);
      setSessions(nextSessions);
      setTeacherSessions(nextTeacherSessions);

      const hasFreshTextbookCapture =
        context.scene === 'textbook' && !!initialAttachmentKey;
      if (hasFreshTextbookCapture) {
        loadedAttachmentKeyRef.current = initialAttachmentKey;
        setCurrentSession(null);
        setMessages([]);
        setPendingAttachment(context.initialAttachment || null);
      } else {
        const activeSessionId =
          await AiChatSessionService.getActiveSessionId(
            nextUserId,
            context.scopeKey
          );
        const nextSession =
          nextSessions.find(
            (session) => session.id === initialSessionId
          ) ||
          nextSessions.find(
            (session) => session.id === activeSessionId
          ) ||
          nextSessions[0] ||
          null;
        const nextMessages = nextSession
          ? await AiChatSessionService.loadMessages(nextSession.id)
          : [];
        if (disposed) return;
        setCurrentSession(nextSession);
        setMessages(nextMessages);
        setPendingAttachment(null);
      }
      setIsLoadingSessions(false);
      setIsInitialized(true);

      if (context.scene === 'general') {
        void SyncService.syncChatHistory().then(async () => {
          if (disposed) return;
          const syncedSessions =
            await AiChatSessionService.loadSessions(
              nextUserId,
              context.scopeKey
            );
          if (!disposed) setSessions(syncedSessions);
        });
      }
    };

    void initialize();
    return () => {
      disposed = true;
      cancelRequestRef.current?.();
      teacherServiceRef.current.disconnect();
    };
  }, [
    context.scopeKey,
    context.scene,
    initialAttachmentKey,
    initialSessionId,
  ]);

  useEffect(() => {
    teacherServiceRef.current.setListeners({
      onMessage: (message, sessionId) => {
        if (sessionId === currentTeacherSessionIdRef.current) {
          setTeacherMessages((current) =>
            current.some((item) => item.id === message.id)
              ? current
              : [...current, message]
          );
          return;
        }
        setTeacherUnreadIds((current) => {
          const next = new Set(current);
          next.add(sessionId);
          return next;
        });
      },
      onConnectionChange: setIsTeacherConnected,
    });
  }, []);

  useEffect(() => {
    if (
      context.scene !== 'textbook' ||
      !initialAttachmentKey ||
      loadedAttachmentKeyRef.current === initialAttachmentKey
    ) {
      return;
    }
    loadedAttachmentKeyRef.current = initialAttachmentKey;
    cancelRequestRef.current?.();
    cancelRequestRef.current = null;
    activeRequestRef.current = null;
    setCurrentSession(null);
    setMessages([]);
    setInputText('');
    setEditingMessageId(null);
    setIsSending(false);
    setPendingAttachment(context.initialAttachment || null);
    setActiveTab('chat');
  }, [
    context.initialAttachment,
    context.scene,
    initialAttachmentKey,
  ]);

  const persistConversation = async (
    session: AiChatSession,
    nextMessages: ChatMessage[]
  ) => {
    const savedSession =
      await AiChatSessionService.saveConversation(
        userId,
        session,
        nextMessages
      );
    setCurrentSession(savedSession);
    upsertSession(savedSession);
    if (context.scene === 'general') {
      void SyncService.syncChatHistory();
    }
  };

  const startAiRequest = async (options: {
    prompt: string;
    baseMessages: ChatMessage[];
    requestAttachment?: AiChatAttachment | null;
    appendUserMessage: boolean;
    retryCount?: number;
  }) => {
    const prompt = options.prompt.trim();
    if (!prompt || isSending || !isInitialized) return;

    let targetSession = currentSession;
    if (!targetSession) {
      targetSession = AiChatSessionService.createSession(
        userId,
        {
          ...context,
          initialAttachment: options.requestAttachment,
        },
        prompt
      );
      await AiChatSessionService.saveSession(userId, targetSession);
      await AiChatSessionService.setActiveSession(
        userId,
        context.scopeKey,
        targetSession.id
      );
      setCurrentSession(targetSession);
      upsertSession(targetSession);
    }
    const session = targetSession;
    const firstMessage =
      session.messageCount === 0 && options.baseMessages.length === 0;
    const now = Date.now();
    const userMessage: ChatMessage | null = options.appendUserMessage
      ? {
          id: `chat-user-${now}`,
          sender: 'user',
          content: prompt,
          timestamp: now,
          imageUri: options.requestAttachment?.uri,
        }
      : null;
    const aiMessageId = `chat-ai-${now}`;
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      sender: 'ai',
      content: '',
      timestamp: now + 1,
      isStreaming: true,
      retryCount: options.retryCount,
    };
    const requestMessages = [
      ...options.baseMessages,
      ...(userMessage ? [userMessage] : []),
      aiMessage,
    ];
    setMessages(requestMessages);
    setInputText('');
    setEditingMessageId(null);
    setPendingAttachment(null);
    setIsSending(true);
    activeRequestRef.current = {
      session,
      messages: requestMessages,
      aiMessageId,
      accumulated: '',
    };

    const onChunk = (chunk: string) => {
      const activeRequest = activeRequestRef.current;
      if (activeRequest?.aiMessageId !== aiMessageId) return;
      activeRequest.accumulated += chunk;
      setMessages((current) =>
        replaceMessage(current, aiMessageId, (message) => ({
          ...message,
          content: activeRequest.accumulated,
        }))
      );
    };
    const onComplete = (fullText: string) => {
      const activeRequest = activeRequestRef.current;
      if (activeRequest?.aiMessageId !== aiMessageId) return;
      const finalMessages = requestMessages.map((message) =>
        message.id === aiMessageId
          ? {
              ...message,
              content:
                fullText ||
                activeRequest.accumulated ||
                '暂时没有返回有效内容',
              isStreaming: false,
              isError: false,
            }
          : message
      );
      setMessages(finalMessages);
      cancelRequestRef.current = null;
      activeRequestRef.current = null;
      void persistConversation(session, finalMessages)
        .catch((error) => {
          console.warn('[AiChatWorkspace] 保存会话失败:', error);
        })
        .finally(() => setIsSending(false));
    };
    const onError = (error: Error) => {
      if (activeRequestRef.current?.aiMessageId !== aiMessageId) return;
      const finalMessages = requestMessages.map((message) =>
        message.id === aiMessageId
          ? {
              ...message,
              content: `发送失败：${error.message}`,
              isStreaming: false,
              isError: true,
            }
          : message
      );
      setMessages(finalMessages);
      cancelRequestRef.current = null;
      activeRequestRef.current = null;
      void persistConversation(session, finalMessages)
        .catch((saveError) => {
          console.warn('[AiChatWorkspace] 保存失败消息失败:', saveError);
        })
        .finally(() => setIsSending(false));
    };

    cancelRequestRef.current =
      context.scene === 'exercise' && context.exerciseQuestion
        ? AiChatService.sendExerciseStreamMessage(
            prompt,
            session.id,
            context.exerciseQuestion,
            {
              isNewSession: firstMessage,
              role,
              enableWebSearch,
            },
            onChunk,
            onComplete,
            onError
          )
        : AiChatService.sendConversationMessage(
            {
              prompt,
              sessionId: session.id,
              imageDataUrl: options.requestAttachment?.dataUrl,
              subject: context.subject,
              sectionName: context.sectionName || context.resourceName,
              isNewSession: firstMessage,
              scene: context.scene,
              role,
              enableWebSearch,
              forcePreviewPictureApi: context.scene === 'textbook',
            },
            onChunk,
            onComplete,
            onError
          );
  };

  const handleSend = async (promptOverride?: string) => {
    const prompt =
      promptOverride?.trim() ||
      inputText.trim() ||
      (pendingAttachment ? '请分析这张图片中的内容' : '');
    if (!prompt || isSending || !isInitialized) return;

    if (editingMessageId) {
      const editingIndex = messages.findIndex(
        (message) => message.id === editingMessageId
      );
      if (editingIndex >= 0) {
        await startAiRequest({
          prompt,
          baseMessages: messages.slice(0, editingIndex),
          requestAttachment: pendingAttachment,
          appendUserMessage: true,
        });
        return;
      }
      setEditingMessageId(null);
    }

    await startAiRequest({
      prompt,
      baseMessages: messages,
      requestAttachment: pendingAttachment,
      appendUserMessage: true,
    });
  };

  const editMessage = (message: ChatMessage) => {
    if (isSending || message.sender !== 'user') return;
    setEditingMessageId(message.id);
    setInputText(message.content);
    setPendingAttachment(
      message.imageUri?.startsWith('data:')
        ? {
            uri: message.imageUri,
            dataUrl: message.imageUri,
            label: '原提问图片',
          }
        : null
    );
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setInputText('');
    setPendingAttachment(null);
  };

  const retryMessage = async (message: ChatMessage) => {
    if (isSending || message.sender !== 'ai') return;
    if ((message.retryCount || 0) >= 3) {
      Alert.alert('已达到重试上限', '可以编辑原提问后重新发送');
      return;
    }
    const aiIndex = messages.findIndex((item) => item.id === message.id);
    if (aiIndex < 0) return;
    let userIndex = aiIndex - 1;
    while (userIndex >= 0 && messages[userIndex]?.sender !== 'user') {
      userIndex -= 1;
    }
    const sourceMessage = messages[userIndex];
    if (!sourceMessage || sourceMessage.sender !== 'user') {
      Alert.alert('无法重试', '没有找到这条回答对应的提问');
      return;
    }
    const requestAttachment = sourceMessage.imageUri?.startsWith('data:')
      ? {
          uri: sourceMessage.imageUri,
          dataUrl: sourceMessage.imageUri,
          label: '原提问图片',
        }
      : null;
    await startAiRequest({
      prompt: sourceMessage.content,
      baseMessages: messages.slice(0, aiIndex),
      requestAttachment,
      appendUserMessage: false,
      retryCount: (message.retryCount || 0) + 1,
    });
  };

  const handleStop = () => {
    const activeRequest = activeRequestRef.current;
    if (!isSending || !activeRequest) return;

    cancelRequestRef.current?.();
    cancelRequestRef.current = null;
    activeRequestRef.current = null;

    const finalMessages = activeRequest.messages.map((message) =>
      message.id === activeRequest.aiMessageId
        ? {
            ...message,
            content: activeRequest.accumulated,
            isStreaming: false,
            isStopped: true,
          }
        : message
    );
    setMessages(finalMessages);
    void persistConversation(activeRequest.session, finalMessages)
      .catch((error) => {
        console.warn('[AiChatWorkspace] 保存已停止的会话失败:', error);
      })
      .finally(() => setIsSending(false));
  };

  useEffect(() => {
    if (!isInitialized || !prefillStorageKey) return;
    let disposed = false;
    const loadPrefill = async () => {
      const prefill = await storage.getItem(prefillStorageKey);
      if (!prefill || disposed) return;
      await storage.removeItem(prefillStorageKey);
      if (!disposed) void handleSend(prefill);
    };
    void loadPrefill();
    return () => {
      disposed = true;
    };
  }, [isInitialized, prefillStorageKey]);

  const selectSession = async (session: AiChatSession) => {
    setChatCategory('companion');
    cancelRequestRef.current?.();
    cancelRequestRef.current = null;
    activeRequestRef.current = null;
    setIsSending(false);
    setCurrentSession(session);
    setMessages(await AiChatSessionService.loadMessages(session.id));
    setEditingMessageId(null);
    setPendingAttachment(null);
    await AiChatSessionService.setActiveSession(
      userId,
      context.scopeKey,
      session.id
    );
    setActiveTab('chat');
  };

  const createNewConversation = () => {
    if (isSending) return;
    setChatCategory('companion');
    setCurrentSession(null);
    setMessages([]);
    setInputText('');
    setEditingMessageId(null);
    setPendingAttachment(
      context.scene === 'textbook'
        ? context.initialAttachment || null
        : null
    );
    setActiveTab('chat');
    void AiChatSessionService.setActiveSession(
      userId,
      context.scopeKey,
      null
    );
  };

  const togglePin = async (session: AiChatSession) => {
    const nextSessions = await AiChatSessionService.togglePinned(
      userId,
      session.id
    );
    setSessions(
      nextSessions
        .filter((item) => item.scopeKey === context.scopeKey)
        .sort(sortSessions)
    );
  };

  const toggleFavorite = async (session: AiChatSession) => {
    const nextSessions = await AiChatSessionService.toggleFavorite(
      userId,
      session.id
    );
    setSessions(
      nextSessions
        .filter((item) => item.scopeKey === context.scopeKey)
        .sort(sortSessions)
    );
  };

  const deleteSession = async (session: AiChatSession) => {
    await AiChatSessionService.deleteSession(userId, session);
    const nextSessions = await refreshSessions(userId);
    if (currentSession?.id !== session.id) return;
    const nextSession = nextSessions[0] || null;
    setCurrentSession(nextSession);
    setMessages(
      nextSession
        ? await AiChatSessionService.loadMessages(nextSession.id)
        : []
    );
  };

  const pickImage = async (
    source: 'camera' | 'library'
  ): Promise<void> => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        '需要授权',
        source === 'camera'
          ? '请允许访问相机后再拍摄题目。'
          : '请允许访问相册后再选择图片。'
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.82,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            quality: 0.82,
            base64: true,
          });
    const asset = !result.canceled ? result.assets?.[0] : undefined;
    if (!asset) return;
    if (!asset.base64) {
      Alert.alert('图片读取失败', '请重新选择图片');
      return;
    }
    const mimeType = asset.mimeType || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${asset.base64}`;
    setPendingAttachment({
      uri: dataUrl,
      dataUrl,
      label: source === 'camera' ? '拍摄的题目' : '选择的图片',
    });
  };

  const selectTeacherSession = async (session: TeacherChatSession) => {
    setChatCategory('teacher');
    setCurrentTeacherSession(session);
    currentTeacherSessionIdRef.current = session.id;
    teacherServiceRef.current.setCurrentSession(session.id);
    setTeacherMessages([]);
    setTeacherInputText('');
    setIsLoadingTeacherHistory(true);
    setTeacherUnreadIds((current) => {
      const next = new Set(current);
      next.delete(session.id);
      return next;
    });
    setActiveTab('chat');
    const [historyResult, connectionResult] = await Promise.allSettled([
      teacherServiceRef.current.loadHistory(session.id),
      teacherServiceRef.current.connect(),
    ]);
    try {
      if (historyResult.status === 'rejected') {
        throw historyResult.reason;
      }
      if (currentTeacherSessionIdRef.current === session.id) {
        setTeacherMessages((current) => {
          const byId = new Map(
            [...historyResult.value, ...current].map((message) => [
              message.id,
              message,
            ])
          );
          return Array.from(byId.values()).sort(
            (a, b) => a.timestamp - b.timestamp
          );
        });
      }
      if (connectionResult.status === 'rejected') {
        if (!pendingTeacherForwardRef.current) {
          Alert.alert(
            '实时连接失败',
            connectionResult.reason instanceof Error
              ? connectionResult.reason.message
              : '可在答疑页点击重新连接'
          );
        }
      }

      const pendingForward = pendingTeacherForwardRef.current;
      if (pendingForward) {
        if (connectionResult.status === 'rejected') {
          throw connectionResult.reason;
        }
        const forwardedMessage = await teacherServiceRef.current.send(
          session,
          pendingForward
        );
        setTeacherMessages((current) =>
          current.some((item) => item.id === forwardedMessage.id)
            ? current
            : [...current, forwardedMessage]
        );
        pendingTeacherForwardRef.current = null;
        setPendingTeacherForwardCount(0);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '老师答疑加载失败';
      const pendingForward = pendingTeacherForwardRef.current;
      if (pendingForward) {
        setTeacherInputText(pendingForward);
        pendingTeacherForwardRef.current = null;
        setPendingTeacherForwardCount(0);
      }
      Alert.alert('老师答疑暂不可用', message);
    }
    if (currentTeacherSessionIdRef.current === session.id) {
      setIsLoadingTeacherHistory(false);
    }
  };

  const retryTeacherConnection = async () => {
    try {
      await teacherServiceRef.current.connect();
    } catch (error) {
      Alert.alert(
        '连接失败',
        error instanceof Error ? error.message : '请稍后重试'
      );
    }
  };

  const sendToTeacher = async () => {
    const prompt = teacherInputText.trim();
    const session = currentTeacherSession;
    if (!prompt || !session || isSendingToTeacher) return;
    setIsSendingToTeacher(true);
    try {
      const message = await teacherServiceRef.current.send(session, prompt);
      setTeacherMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current
          : [...current, message]
      );
      setTeacherInputText('');
    } catch (error) {
      Alert.alert(
        '发送失败',
        error instanceof Error ? error.message : '请稍后重试'
      );
    } finally {
      setIsSendingToTeacher(false);
    }
  };

  const switchChatCategory = (category: 'companion' | 'teacher') => {
    setChatCategory(category);
    if (category === 'companion') {
      pendingTeacherForwardRef.current = null;
      setPendingTeacherForwardCount(0);
      teacherServiceRef.current.disconnect();
      setIsTeacherConnected(false);
    }
  };

  const openAiConversationTab = () => {
    if (interactionBusy) return;
    switchChatCategory('companion');
    setActiveTab('chat');
  };

  const interactionBusy = isSending || isSendingToTeacher;

  const openTeacherConversationTab = () => {
    if (interactionBusy) return;
    switchChatCategory('teacher');
    setActiveTab('chat');
    if (currentTeacherSession && !isTeacherConnected) {
      void retryTeacherConnection();
    }
  };

  const bottomInset = respectBottomSafeArea
    ? Math.max(10, insets.bottom)
    : 10;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'chat' &&
              chatCategory === 'companion' &&
              styles.tabActive,
            interactionBusy && styles.tabDisabled,
          ]}
          onPress={openAiConversationTab}
          disabled={interactionBusy}
          accessibilityRole="tab"
          accessibilityState={{
            selected:
              activeTab === 'chat' &&
              chatCategory === 'companion',
            disabled: interactionBusy,
          }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'chat' &&
                chatCategory === 'companion' &&
                styles.tabTextActive,
            ]}
            numberOfLines={1}
          >
            AI问答
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'chat' &&
              chatCategory === 'teacher' &&
              styles.tabActive,
            interactionBusy && styles.tabDisabled,
          ]}
          onPress={openTeacherConversationTab}
          disabled={interactionBusy}
          accessibilityRole="tab"
          accessibilityState={{
            selected:
              activeTab === 'chat' &&
              chatCategory === 'teacher',
            disabled: interactionBusy,
          }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'chat' &&
                chatCategory === 'teacher' &&
                styles.tabTextActive,
            ]}
            numberOfLines={1}
          >
            问老师
          </Text>
          {teacherUnreadIds.size > 0 ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {Math.min(9, teacherUnreadIds.size)}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'sessions' && styles.tabActive,
            interactionBusy && styles.tabDisabled,
          ]}
          onPress={() => setActiveTab('sessions')}
          disabled={interactionBusy}
          accessibilityRole="tab"
          accessibilityState={{
            selected: activeTab === 'sessions',
            disabled: interactionBusy,
          }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'sessions' && styles.tabTextActive,
            ]}
          >
            会话记录
          </Text>
          {sessions.length + teacherSessions.length > 0 ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {Math.min(99, sessions.length + teacherSessions.length)}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <View style={styles.tabActions}>
          <TouchableOpacity
            style={styles.tabIconButton}
            onPress={createNewConversation}
            disabled={interactionBusy}
            accessibilityRole="button"
            accessibilityLabel="新建聊天"
            accessibilityState={{ disabled: interactionBusy }}
          >
            <Text style={styles.newChatIcon}>＋</Text>
          </TouchableOpacity>
          {onClose ? (
            <TouchableOpacity
              style={styles.tabIconButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="关闭 AI 对话"
            >
              <Text style={styles.closeIcon}>×</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.content}>
        {activeTab === 'chat' && chatCategory === 'teacher' ? (
          currentTeacherSession ? (
            <TeacherConversationView
              session={currentTeacherSession}
              messages={teacherMessages}
              inputText={teacherInputText}
              loading={isLoadingTeacherHistory}
              sending={isSendingToTeacher}
              connected={isTeacherConnected}
              bottomInset={bottomInset}
              keyboardAvoidanceMode={keyboardAvoidanceMode}
              onInputChange={setTeacherInputText}
              onSend={() => void sendToTeacher()}
              onRetry={() => void retryTeacherConnection()}
            />
          ) : (
            <View style={styles.teacherEmptyState}>
              <View style={styles.teacherEmptyMark}>
                <Text style={styles.teacherEmptyMarkText}>师</Text>
              </View>
              <Text style={styles.teacherEmptyTitle}>
                请先选择学科老师
              </Text>
              <Text style={styles.teacherEmptyHint}>
                选择需要答疑的学科后，即可进入对应老师的固定会话
              </Text>
              <TouchableOpacity
                style={styles.teacherEmptyAction}
                onPress={() => setActiveTab('sessions')}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel="选择学科老师"
              >
                <Text style={styles.teacherEmptyActionText}>
                  选择学科老师
                </Text>
              </TouchableOpacity>
            </View>
          )
        ) : activeTab === 'chat' ? (
          <AiConversationView
            context={context}
            messages={messages}
            inputText={inputText}
            attachment={pendingAttachment}
            isInitializing={!isInitialized}
            isSending={isSending}
            role={role}
            enableWebSearch={enableWebSearch}
            bottomInset={bottomInset}
            keyboardAvoidanceMode={keyboardAvoidanceMode}
            onInputChange={setInputText}
            onSend={(prompt) => void handleSend(prompt)}
            onStop={handleStop}
            onPickImage={(source) => void pickImage(source)}
            onRemoveAttachment={() => setPendingAttachment(null)}
            onReselect={onReselect}
            onRoleChange={setRole}
            onToggleWebSearch={() =>
              setEnableWebSearch((current) => !current)
            }
            editingMessageId={editingMessageId}
            onCancelEdit={cancelEditMessage}
            onEditMessage={editMessage}
            onRetryMessage={(message) => void retryMessage(message)}
          />
        ) : (
          <View style={styles.sessionHistory}>
            <View
              style={styles.categorySelector}
              accessibilityRole="tablist"
            >
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  chatCategory === 'companion' &&
                    styles.categoryButtonActive,
                ]}
                onPress={() => switchChatCategory('companion')}
                accessibilityRole="tab"
                accessibilityState={{
                  selected: chatCategory === 'companion',
                }}
              >
                <Text
                  style={[
                    styles.categoryText,
                    chatCategory === 'companion' &&
                      styles.categoryTextActive,
                  ]}
                >
                  学伴默认
                </Text>
                <Text style={styles.categoryCount}>{sessions.length}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  chatCategory === 'teacher' &&
                    styles.categoryButtonActive,
                ]}
                onPress={() => switchChatCategory('teacher')}
                accessibilityRole="tab"
                accessibilityState={{
                  selected: chatCategory === 'teacher',
                }}
              >
                <Text
                  style={[
                    styles.categoryText,
                    chatCategory === 'teacher' &&
                      styles.categoryTextActive,
                  ]}
                >
                  问老师
                </Text>
                {teacherUnreadIds.size > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {Math.min(9, teacherUnreadIds.size)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.categoryCount}>
                    {teacherSessions.length}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {chatCategory === 'companion' ? (
              <AiSessionList
                sessions={sessions}
                currentSessionId={currentSession?.id}
                loading={isLoadingSessions}
                allowFavorite={context.scene === 'general'}
                onSelect={(session) => void selectSession(session)}
                onToggleFavorite={(session) =>
                  void toggleFavorite(session)
                }
                onTogglePin={(session) => void togglePin(session)}
                onDelete={(session) => void deleteSession(session)}
                onCreate={createNewConversation}
              />
            ) : (
              <TeacherSessionList
                sessions={teacherSessions}
                currentSessionId={currentTeacherSession?.id}
                unreadSessionIds={teacherUnreadIds}
                pendingForwardCount={pendingTeacherForwardCount}
                loading={isLoadingSessions}
                onSelect={(session) => void selectTeacherSession(session)}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7FC',
  },
  closeIcon: {
    marginTop: -2,
    fontSize: 28,
    color: '#5E6378',
  },
  newChatIcon: {
    marginTop: -2,
    fontSize: 23,
    fontWeight: '500',
    color: '#6256D9',
  },
  tabs: {
    minHeight: 52,
    paddingLeft: 8,
    paddingRight: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#DFE1EA',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    minWidth: 68,
    minHeight: 48,
    marginRight: 2,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderColor: 'transparent',
  },
  tabActions: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tabIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  tabActive: {
    borderColor: '#6256D9',
  },
  tabDisabled: {
    opacity: 0.45,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#777C90',
  },
  tabTextActive: {
    fontWeight: '900',
    color: '#5348C9',
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    marginLeft: 6,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#EEEAFE',
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#6256D9',
  },
  content: {
    flex: 1,
  },
  teacherEmptyState: {
    flex: 1,
    paddingHorizontal: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7FC',
  },
  teacherEmptyMark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDEAFF',
  },
  teacherEmptyMarkText: {
    fontSize: 27,
    fontWeight: '900',
    color: '#6256D9',
  },
  teacherEmptyTitle: {
    marginTop: 20,
    fontSize: 19,
    fontWeight: '900',
    color: '#24283E',
  },
  teacherEmptyHint: {
    maxWidth: 320,
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#7B8093',
  },
  teacherEmptyAction: {
    minWidth: 168,
    minHeight: 48,
    marginTop: 24,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6256D9',
  },
  teacherEmptyActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sessionHistory: {
    flex: 1,
  },
  categorySelector: {
    minHeight: 54,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 2,
    padding: 4,
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: '#ECECF4',
  },
  categoryButton: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  categoryButtonActive: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0DDF7',
    backgroundColor: '#FFFFFF',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#73788C',
  },
  categoryTextActive: {
    color: '#5348C9',
  },
  categoryCount: {
    marginLeft: 7,
    fontSize: 11,
    fontWeight: '800',
    color: '#9498A9',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    marginLeft: 7,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#E94C5C',
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});

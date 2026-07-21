import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { AiSessionList } from './AiSessionList';
import { TeacherConversationView } from './TeacherConversationView';
import { TeacherSessionList } from './TeacherSessionList';

interface AiChatWorkspaceProps {
  context: AiChatContext;
  onClose?: () => void;
  onReselect?: () => void;
  prefillStorageKey?: string;
  respectBottomSafeArea?: boolean;
}

const attachmentKey = (
  attachment: AiChatAttachment | null | undefined
): string =>
  attachment
    ? `${attachment.pageNumber || 0}-${attachment.dataUrl.slice(-48)}`
    : '';

export function AiChatWorkspace({
  context,
  onClose,
  onReselect,
  prefillStorageKey,
  respectBottomSafeArea = true,
}: AiChatWorkspaceProps) {
  const insets = useSafeAreaInsets();
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
  const [activeTab, setActiveTab] =
    useState<AiChatWorkspaceTab>('chat');
  const [chatCategory, setChatCategory] =
    useState<'companion' | 'teacher'>('companion');
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

  useEffect(() => {
    let disposed = false;
    cancelRequestRef.current?.();
    cancelRequestRef.current = null;
    activeRequestRef.current = null;
    setIsSending(false);
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
  }, [context.scopeKey, context.scene, initialAttachmentKey]);

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
    await refreshSessions(userId);
    if (context.scene === 'general') {
      void SyncService.syncChatHistory();
    }
  };

  const handleSend = async (promptOverride?: string) => {
    const prompt =
      promptOverride?.trim() ||
      inputText.trim() ||
      (pendingAttachment ? '请分析这张图片中的内容' : '');
    if (!prompt || isSending || !isInitialized) return;

    let targetSession = currentSession;
    if (!targetSession) {
      targetSession = AiChatSessionService.createSession(
        userId,
        {
          ...context,
          initialAttachment: pendingAttachment,
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
      await refreshSessions(userId);
    }

    const firstMessage =
      targetSession.messageCount === 0 && messages.length === 0;
    const now = Date.now();
    const userMessage: ChatMessage = {
      id: `chat-user-${now}`,
      sender: 'user',
      content: prompt,
      timestamp: now,
      imageUri: pendingAttachment?.uri,
    };
    const aiMessageId = `chat-ai-${now}`;
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      sender: 'ai',
      content: '',
      timestamp: now + 1,
      isStreaming: true,
    };
    const requestAttachment = pendingAttachment;
    const requestMessages = [...messages, userMessage, aiMessage];
    setMessages(requestMessages);
    setInputText('');
    setPendingAttachment(null);
    setIsSending(true);
    activeRequestRef.current = {
      session: targetSession,
      messages: requestMessages,
      aiMessageId,
      accumulated: '',
    };

    const onChunk = (chunk: string) => {
      const activeRequest = activeRequestRef.current;
      if (activeRequest?.aiMessageId !== aiMessageId) return;
      activeRequest.accumulated += chunk;
      setMessages((current) =>
        current.map((message) =>
          message.id === aiMessageId
            ? { ...message, content: activeRequest.accumulated }
            : message
        )
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
            }
          : message
      );
      setMessages(finalMessages);
      cancelRequestRef.current = null;
      activeRequestRef.current = null;
      void persistConversation(targetSession, finalMessages)
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
            }
          : message
      );
      setMessages(finalMessages);
      cancelRequestRef.current = null;
      activeRequestRef.current = null;
      void persistConversation(targetSession, finalMessages)
        .catch((saveError) => {
          console.warn('[AiChatWorkspace] 保存失败消息失败:', saveError);
        })
        .finally(() => setIsSending(false));
    };

    cancelRequestRef.current =
      context.scene === 'exercise' && context.exerciseQuestion
        ? AiChatService.sendExerciseStreamMessage(
            prompt,
            targetSession.id,
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
              sessionId: targetSession.id,
              imageDataUrl: requestAttachment?.dataUrl,
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
    await AiChatSessionService.togglePinned(userId, session.id);
    await refreshSessions(userId);
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

  const showImageSource = () => {
    Alert.alert('添加图片', '选择图片来源', [
      {
        text: '拍照',
        onPress: () => void pickImage('camera'),
      },
      {
        text: '从相册选择',
        onPress: () => void pickImage('library'),
      },
      { text: '取消', style: 'cancel' },
    ]);
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
        Alert.alert(
          '实时连接失败',
          connectionResult.reason instanceof Error
            ? connectionResult.reason.message
            : '可在答疑页点击重新连接'
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '老师答疑加载失败';
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
      teacherServiceRef.current.disconnect();
      setIsTeacherConnected(false);
    }
  };

  const openConversationTab = () => {
    if (chatCategory === 'teacher') {
      if (!currentTeacherSession) {
        setActiveTab('sessions');
        return;
      }
      if (!isTeacherConnected) void retryTeacherConnection();
    }
    setActiveTab('chat');
  };

  const interactionBusy = isSending || isSendingToTeacher;
  const bottomInset =
    respectBottomSafeArea && Platform.OS === 'ios'
      ? Math.max(8, insets.bottom)
      : 10;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'chat' && styles.tabActive,
          ]}
          onPress={openConversationTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'chat' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'chat' && styles.tabTextActive,
            ]}
          >
            {chatCategory === 'teacher' ? '老师答疑' : 'AI问答'}
          </Text>
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
        {activeTab === 'chat' &&
        chatCategory === 'teacher' &&
        currentTeacherSession ? (
          <TeacherConversationView
            session={currentTeacherSession}
            messages={teacherMessages}
            inputText={teacherInputText}
            loading={isLoadingTeacherHistory}
            sending={isSendingToTeacher}
            connected={isTeacherConnected}
            bottomInset={bottomInset}
            onInputChange={setTeacherInputText}
            onSend={() => void sendToTeacher()}
            onRetry={() => void retryTeacherConnection()}
          />
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
            onInputChange={setInputText}
            onSend={(prompt) => void handleSend(prompt)}
            onStop={handleStop}
            onPickImage={showImageSource}
            onCreateConversation={createNewConversation}
            onRemoveAttachment={() => setPendingAttachment(null)}
            onReselect={onReselect}
            onRoleChange={setRole}
            onToggleWebSearch={() =>
              setEnableWebSearch((current) => !current)
            }
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
                  老师答疑
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
                onSelect={(session) => void selectSession(session)}
                onTogglePin={(session) => void togglePin(session)}
                onDelete={(session) => void deleteSession(session)}
                onCreate={createNewConversation}
              />
            ) : (
              <TeacherSessionList
                sessions={teacherSessions}
                currentSessionId={currentTeacherSession?.id}
                unreadSessionIds={teacherUnreadIds}
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
  tabs: {
    minHeight: 52,
    paddingLeft: 12,
    paddingRight: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#DFE1EA',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    minWidth: 96,
    minHeight: 48,
    marginRight: 8,
    paddingHorizontal: 13,
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

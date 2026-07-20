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
import type {
  AiChatAttachment,
  AiChatContext,
  AiChatRole,
  AiChatSession,
  AiChatWorkspaceTab,
} from '../types';
import { AiConversationView } from './AiConversationView';
import { AiSessionList } from './AiSessionList';

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
  const loadedAttachmentKeyRef = useRef('');
  const [activeTab, setActiveTab] =
    useState<AiChatWorkspaceTab>('chat');
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
      if (disposed) return;
      setUserId(nextUserId);
      setSessions(nextSessions);

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
    };
  }, [context.scopeKey, context.scene, initialAttachmentKey]);

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
    let accumulated = '';

    cancelRequestRef.current =
      AiChatService.sendConversationMessage(
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
        (chunk) => {
          accumulated += chunk;
          setMessages((current) =>
            current.map((message) =>
              message.id === aiMessageId
                ? { ...message, content: accumulated }
                : message
            )
          );
        },
        (fullText) => {
          const finalMessages = requestMessages.map((message) =>
            message.id === aiMessageId
              ? {
                  ...message,
                  content:
                    fullText ||
                    accumulated ||
                    '暂时没有返回有效内容',
                  isStreaming: false,
                }
              : message
          );
          setMessages(finalMessages);
          cancelRequestRef.current = null;
          void persistConversation(targetSession, finalMessages)
            .catch((error) => {
              console.warn('[AiChatWorkspace] 保存会话失败:', error);
            })
            .finally(() => setIsSending(false));
        },
        (error) => {
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
          void persistConversation(targetSession, finalMessages)
            .catch((saveError) => {
              console.warn('[AiChatWorkspace] 保存失败消息失败:', saveError);
            })
            .finally(() => setIsSending(false));
        }
      );
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
    cancelRequestRef.current?.();
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{context.title}</Text>
          <View style={styles.subtitleRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.subtitle} numberOfLines={1}>
              {context.subtitle || 'AI 助手在线'}
            </Text>
          </View>
        </View>
        {context.scene === 'textbook' && onReselect ? (
          <TouchableOpacity
            style={styles.headerAction}
            onPress={onReselect}
            disabled={isSending}
          >
            <Text style={styles.headerActionText}>重新框选</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={createNewConversation}
          disabled={isSending}
          accessibilityRole="button"
          accessibilityLabel="新建会话"
        >
          <Text style={styles.newIcon}>＋</Text>
        </TouchableOpacity>
        {onClose ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="关闭 AI 对话"
          >
            <Text style={styles.closeIcon}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'chat' && styles.tabActive,
          ]}
          onPress={() => setActiveTab('chat')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'chat' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'chat' && styles.tabTextActive,
            ]}
          >
            AI问答
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'sessions' && styles.tabActive,
            isSending && styles.tabDisabled,
          ]}
          onPress={() => setActiveTab('sessions')}
          disabled={isSending}
          accessibilityRole="tab"
          accessibilityState={{
            selected: activeTab === 'sessions',
            disabled: isSending,
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
          {sessions.length > 0 ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {Math.min(99, sessions.length)}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'chat' ? (
          <AiConversationView
            context={context}
            messages={messages}
            inputText={inputText}
            attachment={pendingAttachment}
            isSending={isSending}
            role={role}
            enableWebSearch={enableWebSearch}
            bottomInset={
              respectBottomSafeArea && Platform.OS === 'ios'
                ? Math.max(8, insets.bottom)
                : 10
            }
            onInputChange={setInputText}
            onSend={(prompt) => void handleSend(prompt)}
            onPickImage={showImageSource}
            onRemoveAttachment={() => setPendingAttachment(null)}
            onReselect={onReselect}
            onRoleChange={setRole}
            onToggleWebSearch={() =>
              setEnableWebSearch((current) => !current)
            }
          />
        ) : (
          <AiSessionList
            sessions={sessions}
            currentSessionId={currentSession?.id}
            loading={isLoadingSessions}
            onSelect={(session) => void selectSession(session)}
            onTogglePin={(session) => void togglePin(session)}
            onDelete={(session) => void deleteSession(session)}
            onCreate={createNewConversation}
          />
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
  header: {
    minHeight: 62,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#DFE1EA',
    backgroundColor: '#FFFFFF',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#20243D',
  },
  subtitleRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 6,
    height: 6,
    marginRight: 5,
    borderRadius: 3,
    backgroundColor: '#27B77A',
  },
  subtitle: {
    flex: 1,
    fontSize: 10,
    color: '#74798F',
  },
  headerAction: {
    minHeight: 44,
    marginLeft: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6256D9',
  },
  iconButton: {
    width: 44,
    height: 44,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  newIcon: {
    fontSize: 26,
    color: '#6256D9',
  },
  closeIcon: {
    marginTop: -2,
    fontSize: 28,
    color: '#5E6378',
  },
  tabs: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#DFE1EA',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    minWidth: 104,
    minHeight: 48,
    marginRight: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderColor: 'transparent',
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
});

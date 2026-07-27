import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AppScreenSafeArea,
  useAppSafeAreaInsets,
} from '@/components/AppSafeArea';
import { getUserId, getUserInfo } from '@/services/auth-service';
import {
  CustomerSupportMessage,
  CustomerSupportService,
} from '@/services/customer-support-service';

const mergeMessage = (
  messages: CustomerSupportMessage[],
  nextMessage: CustomerSupportMessage
): CustomerSupportMessage[] => {
  const index = messages.findIndex((message) => message.id === nextMessage.id);
  if (index < 0) return [...messages, nextMessage];
  const nextMessages = messages.slice();
  nextMessages[index] = nextMessage;
  return nextMessages;
};

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
};

export function CustomerSupportScreen() {
  const navigation = useNavigation<any>();
  const insets = useAppSafeAreaInsets();
  const serviceRef = useRef(new CustomerSupportService());
  const listRef = useRef<FlatList<CustomerSupportMessage>>(null);
  const [messages, setMessages] = useState<CustomerSupportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  const initialize = useCallback(async () => {
    setIsLoading(true);
    setIsConnected(false);
    setConnectionError('');
    try {
      const userId = (await getUserId()) || (await getUserInfo())?.id;
      if (!userId) {
        throw new Error('未获取到当前用户信息，请重新登录后重试');
      }

      try {
        setMessages(await serviceRef.current.loadHistory(userId));
      } catch (error) {
        console.warn('[CustomerSupport] 加载历史记录失败:', error);
      }

      await serviceRef.current.connect(userId, {
        onMessage: (message) =>
          setMessages((current) => mergeMessage(current, message)),
        onConnectionChange: setIsConnected,
        onError: setConnectionError,
      });
    } catch (error) {
      setIsConnected(false);
      setConnectionError(
        error instanceof Error ? error.message : '客服连接失败，请稍后重试'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void initialize();
    return () => serviceRef.current.disconnect();
  }, [initialize]);

  const handleSend = () => {
    if (!inputText.trim() || !isConnected) return;
    try {
      const message = serviceRef.current.send(inputText);
      setMessages((current) => mergeMessage(current, message));
      setInputText('');
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : '消息发送失败，请重试'
      );
    }
  };

  return (
    <AppScreenSafeArea style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="返回我的页面"
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleArea}>
            <Text style={styles.headerTitle}>在线客服</Text>
            <View style={styles.connectionRow}>
              <View
                style={[
                  styles.connectionDot,
                  isConnected && styles.connectionDotOnline,
                ]}
              />
              <Text style={styles.connectionText}>
                {isConnected ? '客服已连接' : '客服未连接'}
              </Text>
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {connectionError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{connectionError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void initialize()}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>重新连接</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          style={styles.messageList}
          contentContainerStyle={[
            styles.messageContent,
            messages.length === 0 && styles.emptyMessageContent,
          ]}
          data={messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) => {
            const isUser = item.sender === 'user';
            if (item.sender === 'system') {
              return <Text style={styles.systemMessage}>{item.content}</Text>;
            }
            return (
              <View
                style={[
                  styles.messageRow,
                  isUser ? styles.userMessageRow : styles.agentMessageRow,
                ]}
              >
                {!isUser ? (
                  <View style={styles.agentAvatar}>
                    <Text style={styles.agentAvatarText}>客</Text>
                  </View>
                ) : null}
                <View>
                  <View
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : styles.agentBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isUser && styles.userMessageText,
                      ]}
                    >
                      {item.content}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.messageTime,
                      isUser && styles.userMessageTime,
                    ]}
                  >
                    {formatTime(item.timestamp)}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator size="large" color="#4F46E5" />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🎧</Text>
                <Text style={styles.emptyTitle}>欢迎使用在线客服</Text>
                <Text style={styles.emptyDescription}>
                  请描述你遇到的问题，我们会尽快回复。
                </Text>
              </View>
            )
          }
        />

        <View
          style={[
            styles.composer,
            { paddingBottom: Math.max(12, insets.bottom) },
          ]}
        >
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={isConnected ? '请输入你的问题…' : '正在连接客服…'}
            placeholderTextColor="#94A3B8"
            multiline
            editable={isConnected}
            accessibilityLabel="客服消息输入框"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!isConnected || !inputText.trim()) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!isConnected || !inputText.trim()}
            accessibilityRole="button"
            accessibilityLabel="发送客服消息"
          >
            <Text style={styles.sendButtonText}>发送</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </AppScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F7F7FC',
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    marginTop: -4,
    fontSize: 38,
    color: '#334155',
  },
  headerTitleArea: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  connectionRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  connectionDotOnline: {
    backgroundColor: '#10B981',
  },
  connectionText: {
    fontSize: 11,
    color: '#64748B',
  },
  headerSpacer: {
    width: 44,
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
  },
  retryButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 16,
    gap: 16,
  },
  emptyMessageContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: '#64748B',
  },
  messageRow: {
    maxWidth: '86%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  userMessageRow: {
    alignSelf: 'flex-end',
  },
  agentMessageRow: {
    alignSelf: 'flex-start',
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  agentAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
  },
  messageBubble: {
    maxWidth: 280,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    borderBottomRightRadius: 5,
    backgroundColor: '#4F46E5',
  },
  agentBubble: {
    borderBottomLeftRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1E293B',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    marginTop: 4,
    fontSize: 10,
    color: '#94A3B8',
  },
  userMessageTime: {
    textAlign: 'right',
  },
  systemMessage: {
    alignSelf: 'center',
    fontSize: 12,
    color: '#94A3B8',
  },
  composer: {
    paddingTop: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    fontSize: 15,
    lineHeight: 20,
    color: '#0F172A',
  },
  sendButton: {
    minWidth: 64,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

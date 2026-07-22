import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ChatMessage } from '@/services/ai-chat-service';
import { MathRenderer } from '@/components/MathRenderer';
import type { TeacherChatSession } from '../services/teacher-chat-service';
import { ImagePreviewModal } from './ImagePreviewModal';

interface TeacherConversationViewProps {
  session: TeacherChatSession;
  messages: ChatMessage[];
  inputText: string;
  loading: boolean;
  sending: boolean;
  connected: boolean;
  bottomInset: number;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onRetry: () => void;
}

const TeacherMessageItem = memo(function TeacherMessageItem({
  message,
  onPreviewImage,
}: {
  message: ChatMessage;
  onPreviewImage: (uri: string, title: string) => void;
}) {
  const user = message.sender === 'user';
  return (
    <View
      style={[
        styles.messageRow,
        user ? styles.userRow : styles.teacherRow,
      ]}
    >
      {!user ? (
        <View style={styles.teacherAvatar}>
          <Text style={styles.teacherAvatarText}>师</Text>
        </View>
      ) : null}
      <View
        style={[
          styles.bubble,
          user ? styles.userBubble : styles.teacherBubble,
        ]}
      >
        {message.imageUri ? (
          <TouchableOpacity
            onPress={() =>
              onPreviewImage(
                message.imageUri!,
                user ? '我的图片' : '老师图片'
              )
            }
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="查看消息图片"
          >
            <Image
              source={{ uri: message.imageUri }}
              style={styles.messageImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : user ? (
          <Text style={styles.userText}>{message.content}</Text>
        ) : (
          <MathRenderer content={message.content} textColor="#20243D" />
        )}
      </View>
    </View>
  );
});

function TeacherConversationViewComponent({
  session,
  messages,
  inputText,
  loading,
  sending,
  connected,
  bottomInset,
  onInputChange,
  onSend,
  onRetry,
}: TeacherConversationViewProps) {
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const shouldStickToBottomRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    uri: string;
    title: string;
  } | null>(null);
  const openImagePreview = useCallback((uri: string, title: string) => {
    setPreviewImage({ uri, title });
  }, []);

  const scheduleScrollToEnd = useCallback((animated: boolean) => {
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
    }
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    if (messages[messages.length - 1]?.sender === 'user') {
      shouldStickToBottomRef.current = true;
      scheduleScrollToEnd(true);
    }
  }, [messages[messages.length - 1]?.id, scheduleScrollToEnd]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    []
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      shouldStickToBottomRef.current =
        contentSize.height - (contentOffset.y + layoutMeasurement.height) < 96;
    },
    []
  );

  const handleContentSizeChange = useCallback(() => {
    if (shouldStickToBottomRef.current) scheduleScrollToEnd(false);
  }, [scheduleScrollToEnd]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <TeacherMessageItem
        message={item}
        onPreviewImage={openImagePreview}
      />
    ),
    [openImagePreview]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        scrollEventThrottle={32}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        contentContainerStyle={[
          styles.messageContent,
          messages.length === 0 && styles.emptyContent,
        ]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#6256D9" />
              <Text style={styles.stateText}>正在加载答疑记录…</Text>
            </View>
          ) : (
            <View style={styles.welcome}>
              <View style={styles.welcomeMark}>
                <Text style={styles.welcomeMarkText}>师</Text>
              </View>
              <Text style={styles.welcomeTitle}>
                向{session.title}老师提问
              </Text>
              <Text style={styles.stateText}>
                老师回复后会实时显示在这里
              </Text>
              {!connected ? (
                <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                  <Text style={styles.retryText}>重新连接</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        }
      />

      <View
        style={[
          styles.composerArea,
          { paddingBottom: Math.max(10, bottomInset) },
        ]}
      >
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              !connected && styles.statusDotOffline,
            ]}
          />
          <Text style={styles.statusText}>
            {connected ? '老师答疑已连接' : '连接已断开，可点击重试'}
          </Text>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            value={inputText}
            onChangeText={onInputChange}
            style={styles.input}
            placeholder={`向${session.title}老师描述你的问题…`}
            placeholderTextColor="#9499AC"
            multiline
            maxLength={2000}
            editable={!sending}
            accessibilityLabel="老师答疑输入框"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={onSend}
            disabled={!inputText.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="发送给老师"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendText}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <ImagePreviewModal
        visible={!!previewImage}
        uri={previewImage?.uri || null}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />
    </KeyboardAvoidingView>
  );
}

export const TeacherConversationView = memo(TeacherConversationViewComponent);

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  emptyContent: { flexGrow: 1 },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userRow: { justifyContent: 'flex-end' },
  teacherRow: { justifyContent: 'flex-start' },
  teacherAvatar: {
    width: 32,
    height: 32,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#E7F7F0',
  },
  teacherAvatarText: { fontSize: 14, fontWeight: '900', color: '#16885D' },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 16 },
  userBubble: { backgroundColor: '#6256D9', borderBottomRightRadius: 5 },
  teacherBubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E2EB',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 5,
  },
  userText: { fontSize: 15, lineHeight: 22, color: '#FFFFFF' },
  messageImage: { width: 220, height: 180, borderRadius: 10 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  welcomeMark: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#E7F7F0',
  },
  welcomeMarkText: { fontSize: 22, fontWeight: '900', color: '#16885D' },
  welcomeTitle: {
    marginTop: 16,
    fontSize: 19,
    fontWeight: '900',
    color: '#20243D',
  },
  stateText: { marginTop: 8, fontSize: 13, color: '#858A9D' },
  retryButton: {
    minHeight: 44,
    marginTop: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#EEEAFE',
  },
  retryText: { fontSize: 14, fontWeight: '800', color: '#6256D9' },
  composerArea: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#DFE1EA',
    backgroundColor: '#FFFFFF',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  statusDot: {
    width: 6,
    height: 6,
    marginRight: 6,
    borderRadius: 3,
    backgroundColor: '#27B77A',
  },
  statusDotOffline: { backgroundColor: '#D18A45' },
  statusText: { fontSize: 10, color: '#7C8194' },
  inputRow: {
    minHeight: 50,
    paddingLeft: 13,
    paddingRight: 5,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#DADCE7',
    borderRadius: 17,
    backgroundColor: '#F9F9FD',
  },
  input: {
    flex: 1,
    maxHeight: 112,
    minHeight: 48,
    paddingTop: 13,
    paddingBottom: 12,
    fontSize: 15,
    color: '#20243D',
  },
  sendButton: {
    width: 42,
    height: 42,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#6256D9',
  },
  sendButtonDisabled: { backgroundColor: '#C8C5E5' },
  sendText: { marginTop: -2, fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
});

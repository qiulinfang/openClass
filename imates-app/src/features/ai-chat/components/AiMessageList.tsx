import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MathRenderer } from '@/components/MathRenderer';
import type { ChatMessage } from '@/services/ai-chat-service';
import type { AiChatContext } from '../types';
import { ExerciseSuggestedQuestions } from './ExerciseSuggestedQuestions';
import { ImagePreviewModal } from './ImagePreviewModal';

const copyIcon = require('../../../../assets/ai-copy.png');
const editIcon = require('../../../../assets/ai-edit.png');
const retryIcon = require('../../../../assets/ai-retry.png');
const aiChatAvatar = require('../../../../assets/ai-chat-avatar.png');
const FORMULA_PATTERN = /\$\$?[\s\S]+?\$\$?|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/;
const GENERAL_SUGGESTIONS = [
  '帮我制定本周复习计划',
  '解释一个我不理解的知识点',
  '帮我梳理一道题的解题思路',
  '检查并优化我的作文',
];
const TEXTBOOK_SUGGESTIONS = [
  '讲解这部分内容',
  '提炼核心知识点',
  '分析图中的例题',
  '给我出一道类似练习',
];

interface AiMessageListProps {
  context: AiChatContext;
  messages: ChatMessage[];
  isInitializing: boolean;
  isSending: boolean;
  isForwardSelecting: boolean;
  selectedMessageIds: Set<string>;
  onSend: (prompt?: string) => void;
  onToggleForwardMessage: (messageId: string) => void;
  onEditMessage: (message: ChatMessage) => void;
  onRetryMessage: (message: ChatMessage) => void;
}

interface AiMessageItemProps {
  message: ChatMessage;
  selected: boolean;
  selectable: boolean;
  copied: boolean;
  canEdit: boolean;
  canRetry: boolean;
  isSending: boolean;
  onCopy: (message: ChatMessage) => void;
  onToggle: (messageId: string) => void;
  onEdit: (message: ChatMessage) => void;
  onRetry: (message: ChatMessage) => void;
  onPreviewImage: (uri: string, title: string) => void;
}

const AiMessageItem = memo(function AiMessageItem({
  message,
  selected,
  selectable,
  copied,
  canEdit,
  canRetry,
  isSending,
  onCopy,
  onToggle,
  onEdit,
  onRetry,
  onPreviewImage,
}: AiMessageItemProps) {
  const user = message.sender === 'user';
  const containsFormula = FORMULA_PATTERN.test(message.content);
  return (
    <TouchableOpacity
      style={[
        styles.messageRow,
        user ? styles.userMessageRow : styles.aiMessageRow,
        selectable && styles.selectableMessageRow,
        selected && styles.selectedMessageRow,
      ]}
      activeOpacity={selectable ? 0.72 : 1}
      onPress={() => onToggle(message.id)}
      disabled={!selectable}
      accessibilityRole={selectable ? 'checkbox' : undefined}
      accessibilityState={selectable ? { checked: selected } : undefined}
    >
      {selectable ? (
        <View
          style={[
            styles.selectionMark,
            selected && styles.selectionMarkSelected,
          ]}
        >
          <Text style={styles.selectionMarkText}>{selected ? '✓' : ''}</Text>
        </View>
      ) : null}
      {!user ? (
        <Image
          source={aiChatAvatar}
          style={styles.aiAvatar}
          resizeMode="cover"
          accessible
          accessibilityLabel="AI 助手头像"
        />
      ) : null}
      <View
        style={[
          styles.messageColumn,
          user && styles.userMessageColumn,
          selectable && styles.messageColumnSelecting,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            user ? styles.userBubble : styles.aiBubble,
          ]}
        >
          {message.imageUri ? (
            <TouchableOpacity
              onPress={() =>
                onPreviewImage(
                  message.imageUri!,
                  user ? '我的图片' : 'AI 图片'
                )
              }
              disabled={selectable}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="查看消息图片"
            >
              <Image
                source={{ uri: message.imageUri }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : null}
          {user && containsFormula ? (
            <MathRenderer content={message.content} textColor="#FFFFFF" />
          ) : user ? (
            <Text style={styles.userMessageText}>{message.content}</Text>
          ) : message.isStreaming && !message.content ? (
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color="#6256D9" />
              <Text style={styles.typingText}>正在思考…</Text>
            </View>
          ) : (
            <>
              <MathRenderer content={message.content} textColor="#20243D" />
              {message.isStopped ? (
                <Text style={styles.stoppedText}>已停止生成</Text>
              ) : null}
            </>
          )}
        </View>
        {!selectable && !message.isStreaming ? (
          <View
            style={[
              styles.messageActions,
              user && styles.userMessageActions,
            ]}
          >
            <TouchableOpacity
              style={[
                styles.messageAction,
                copied && styles.messageActionCopied,
              ]}
              onPress={() => void onCopy(message)}
              accessibilityRole="button"
              accessibilityLabel="复制消息"
            >
              <Image source={copyIcon} style={styles.messageActionIcon} />
            </TouchableOpacity>
            {canEdit ? (
              <TouchableOpacity
                style={styles.messageAction}
                onPress={() => onEdit(message)}
                disabled={isSending}
                accessibilityRole="button"
                accessibilityLabel="编辑这条提问"
              >
                <Image source={editIcon} style={styles.messageActionIcon} />
              </TouchableOpacity>
            ) : null}
            {canRetry ? (
              <TouchableOpacity
                style={styles.messageAction}
                onPress={() => onRetry(message)}
                disabled={isSending}
                accessibilityRole="button"
                accessibilityLabel="重新生成回答"
              >
                <Image source={retryIcon} style={styles.messageActionIcon} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

function AiMessageListComponent({
  context,
  messages,
  isInitializing,
  isSending,
  isForwardSelecting,
  selectedMessageIds,
  onSend,
  onToggleForwardMessage,
  onEditMessage,
  onRetryMessage,
}: AiMessageListProps) {
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const shouldStickToBottomRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    uri: string;
    title: string;
  } | null>(null);
  const openImagePreview = useCallback((uri: string, title: string) => {
    setPreviewImage({ uri, title });
  }, []);

  const { lastUserMessageId, retryableAiMessageId } = useMemo(() => {
    let lastUserId: string | null = null;
    let retryableAiId: string | null = null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!lastUserId && message.sender === 'user') lastUserId = message.id;
      if (
        !retryableAiId &&
        message.sender === 'ai' &&
        !message.isStreaming &&
        message.content.trim()
      ) {
        retryableAiId = message.id;
      }
      if (lastUserId && retryableAiId) break;
    }
    return {
      lastUserMessageId: lastUserId,
      retryableAiMessageId: retryableAiId,
    };
  }, [messages]);

  const lastMessage = messages[messages.length - 1];
  const shouldForceScroll =
    lastMessage?.sender === 'user' ||
    (!!lastMessage?.isStreaming && !lastMessage.content);

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
    if (!lastMessage) {
      shouldStickToBottomRef.current = true;
      return;
    }
    if (shouldForceScroll) {
      shouldStickToBottomRef.current = true;
      scheduleScrollToEnd(true);
    }
  }, [
    lastMessage?.id,
    scheduleScrollToEnd,
    shouldForceScroll,
  ]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
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

  const copyMessage = useCallback(async (message: ChatMessage) => {
    await Clipboard.setStringAsync(message.content);
    setCopiedMessageId(message.id);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopiedMessageId((current) =>
        current === message.id ? null : current
      );
    }, 1400);
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <AiMessageItem
        message={item}
        selected={selectedMessageIds.has(item.id)}
        selectable={isForwardSelecting}
        copied={copiedMessageId === item.id}
        canEdit={item.id === lastUserMessageId}
        canRetry={
          item.id === retryableAiMessageId && (item.retryCount || 0) < 3
        }
        isSending={isSending}
        onCopy={copyMessage}
        onToggle={onToggleForwardMessage}
        onEdit={onEditMessage}
        onRetry={onRetryMessage}
        onPreviewImage={openImagePreview}
      />
    ),
    [
      copiedMessageId,
      isForwardSelecting,
      isSending,
      lastUserMessageId,
      onEditMessage,
      openImagePreview,
      onRetryMessage,
      onToggleForwardMessage,
      retryableAiMessageId,
      selectedMessageIds,
      copyMessage,
    ]
  );

  const suggestions =
    context.scene === 'textbook'
      ? TEXTBOOK_SUGGESTIONS
      : GENERAL_SUGGESTIONS;

  return (
    <>
      <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={renderMessage}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={32}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={7}
      onScroll={handleScroll}
      onContentSizeChange={handleContentSizeChange}
      contentContainerStyle={[
        styles.messageContent,
        messages.length === 0 && styles.emptyMessageContent,
      ]}
      ListEmptyComponent={
        isInitializing ? (
          <View style={styles.initializingState}>
            <ActivityIndicator color="#6256D9" />
            <Text style={styles.initializingText}>正在加载会话…</Text>
          </View>
        ) : context.scene === 'exercise' ? (
          <ExerciseSuggestedQuestions disabled={isSending} onSelect={onSend} />
        ) : (
          <View style={styles.welcome}>
            <Image
              source={aiChatAvatar}
              style={styles.welcomeAvatar}
              resizeMode="cover"
              accessible
              accessibilityLabel="AI 助手头像"
            />
            <Text style={styles.welcomeTitle}>
              {context.scene === 'textbook'
                ? '围绕教材内容深入探索'
                : '今天想一起解决什么问题？'}
            </Text>
            <Text style={styles.welcomeText}>
              {context.scene === 'textbook'
                ? '可以讲解框选内容、提炼知识点、分析例题并继续追问。'
                : '支持全科问答、学习规划、题目分析和图片提问。'}
            </Text>
            <View style={styles.suggestionGrid}>
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionCard}
                  onPress={() => onSend(suggestion)}
                  disabled={isSending}
                  accessibilityRole="button"
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                  <Text style={styles.suggestionArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )
      }
      />
      <ImagePreviewModal
        visible={!!previewImage}
        uri={previewImage?.uri || null}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}

export const AiMessageList = memo(AiMessageListComponent);

const styles = StyleSheet.create({
  messageContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  emptyMessageContent: { flexGrow: 1 },
  initializingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initializingText: { marginTop: 10, fontSize: 13, color: '#858A9D' },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userMessageRow: { justifyContent: 'flex-end' },
  aiMessageRow: { justifyContent: 'flex-start' },
  selectableMessageRow: {
    minHeight: 54,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 18,
  },
  selectedMessageRow: { backgroundColor: '#F0EDFF' },
  selectionMark: {
    width: 24,
    height: 24,
    marginTop: 5,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#B8B9C5',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  selectionMarkSelected: {
    borderColor: '#6256D9',
    backgroundColor: '#6256D9',
  },
  selectionMarkText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  aiAvatar: {
    width: 32,
    height: 32,
    marginRight: 8,
    borderRadius: 16,
  },
  messageColumn: { maxWidth: '84%', alignItems: 'flex-start' },
  userMessageColumn: { alignItems: 'flex-end' },
  messageColumnSelecting: { maxWidth: '70%' },
  messageBubble: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 17,
  },
  userBubble: {
    borderBottomRightRadius: 5,
    backgroundColor: '#6256D9',
  },
  aiBubble: {
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: '#E1E2EB',
    backgroundColor: '#FFFFFF',
  },
  messageImage: {
    width: 190,
    height: 116,
    marginBottom: 8,
    borderRadius: 11,
    backgroundColor: '#ECEEF5',
  },
  userMessageText: { fontSize: 15, lineHeight: 22, color: '#FFFFFF' },
  typingRow: { minHeight: 26, flexDirection: 'row', alignItems: 'center' },
  typingText: { marginLeft: 8, fontSize: 12, color: '#74798F' },
  stoppedText: { marginTop: 8, fontSize: 11, color: '#8A8FA2' },
  messageActions: {
    minHeight: 34,
    marginTop: 2,
    marginLeft: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userMessageActions: {
    marginLeft: 0,
    marginRight: 3,
    justifyContent: 'flex-end',
  },
  messageAction: {
    minWidth: 38,
    minHeight: 38,
    marginRight: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  messageActionCopied: { backgroundColor: '#EEEAFE' },
  messageActionIcon: { width: 16, height: 16, resizeMode: 'contain' },
  welcome: {
    flex: 1,
    minHeight: 410,
    paddingVertical: 30,
    justifyContent: 'center',
  },
  welcomeAvatar: {
    width: 62,
    height: 62,
    marginBottom: 18,
    alignSelf: 'center',
    borderRadius: 31,
  },
  welcomeTitle: {
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
    color: '#20243D',
  },
  welcomeText: {
    marginTop: 8,
    paddingHorizontal: 16,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#6C7187',
  },
  suggestionGrid: { marginTop: 24 },
  suggestionCard: {
    minHeight: 48,
    marginBottom: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E1E2EB',
    backgroundColor: '#FFFFFF',
  },
  suggestionText: { flex: 1, fontSize: 14, color: '#353A53' },
  suggestionArrow: { marginLeft: 8, fontSize: 22, color: '#7770DE' },
});

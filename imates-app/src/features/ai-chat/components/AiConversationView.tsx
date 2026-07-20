import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MathRenderer } from '@/components/MathRenderer';
import type { ChatMessage } from '@/services/ai-chat-service';
import type {
  AiChatAttachment,
  AiChatContext,
  AiChatRole,
} from '../types';
import { AiRoleSelector } from './AiRoleSelector';
import { ExerciseSuggestedQuestions } from './ExerciseSuggestedQuestions';

interface AiConversationViewProps {
  context: AiChatContext;
  messages: ChatMessage[];
  inputText: string;
  attachment: AiChatAttachment | null;
  isInitializing: boolean;
  isSending: boolean;
  role: AiChatRole;
  enableWebSearch: boolean;
  bottomInset: number;
  onInputChange: (value: string) => void;
  onSend: (prompt?: string) => void;
  onStop: () => void;
  onPickImage?: () => void;
  onCreateConversation: () => void;
  onRemoveAttachment: () => void;
  onReselect?: () => void;
  onRoleChange: (role: AiChatRole) => void;
  onToggleWebSearch: () => void;
}

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

export function AiConversationView({
  context,
  messages,
  inputText,
  attachment,
  isInitializing,
  isSending,
  role,
  enableWebSearch,
  bottomInset,
  onInputChange,
  onSend,
  onStop,
  onPickImage,
  onCreateConversation,
  onRemoveAttachment,
  onReselect,
  onRoleChange,
  onToggleWebSearch,
}: AiConversationViewProps) {
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    const timer = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      80
    );
    return () => clearTimeout(timer);
  }, [messages]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const user = item.sender === 'user';
    return (
      <View
        style={[
          styles.messageRow,
          user ? styles.userMessageRow : styles.aiMessageRow,
        ]}
      >
        {!user ? (
          <View style={styles.aiAvatar}>
            <View style={styles.avatarDot} />
            <View style={styles.avatarLine} />
          </View>
        ) : null}
        <View
          style={[
            styles.messageBubble,
            user ? styles.userBubble : styles.aiBubble,
          ]}
        >
          {item.imageUri ? (
            <Image
              source={{ uri: item.imageUri }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          ) : null}
          {user ? (
            <Text style={styles.userMessageText}>{item.content}</Text>
          ) : item.isStreaming && !item.content ? (
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color="#6256D9" />
              <Text style={styles.typingText}>正在思考…</Text>
            </View>
          ) : (
            <>
              <MathRenderer content={item.content} textColor="#20243D" />
              {item.isStopped ? (
                <Text style={styles.stoppedText}>已停止生成</Text>
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  };

  const suggestions =
    context.scene === 'textbook'
      ? TEXTBOOK_SUGGESTIONS
      : GENERAL_SUGGESTIONS;

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
            <ExerciseSuggestedQuestions
              disabled={isSending}
              onSelect={onSend}
            />
          ) : (
          <View style={styles.welcome}>
            <View style={styles.welcomeMark}>
              <View style={styles.welcomeMarkDot} />
              <View style={styles.welcomeMarkLine} />
              <View style={styles.welcomeMarkLineShort} />
            </View>
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

      <View
        style={[
          styles.composerArea,
          { paddingBottom: Math.max(10, bottomInset) },
        ]}
      >
        {attachment ? (
          <View style={styles.attachmentBar}>
            <Image
              source={{ uri: attachment.uri }}
              style={styles.attachmentImage}
              resizeMode="cover"
            />
            <View style={styles.attachmentCopy}>
              <Text style={styles.attachmentTitle} numberOfLines={1}>
                {attachment.label}
              </Text>
              <Text style={styles.attachmentHint}>
                将随下一条问题发送
              </Text>
            </View>
            {context.scene === 'textbook' && onReselect ? (
              <TouchableOpacity
                style={styles.attachmentAction}
                onPress={onReselect}
              >
                <Text style={styles.attachmentActionText}>重新框选</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.removeAttachment}
              onPress={onRemoveAttachment}
              accessibilityRole="button"
              accessibilityLabel="移除图片"
            >
              <Text style={styles.removeAttachmentText}>×</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.toolRow}>
          <ScrollView
            horizontal
            style={styles.toolScroll}
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tools}
          >
            <AiRoleSelector
              value={role}
              disabled={isSending}
              onChange={onRoleChange}
            />
            <TouchableOpacity
              style={[
                styles.toolChip,
                enableWebSearch && styles.toolChipActive,
              ]}
              onPress={onToggleWebSearch}
              accessibilityRole="switch"
              accessibilityState={{ checked: enableWebSearch }}
            >
              <Text
                style={[
                  styles.toolChipText,
                  enableWebSearch && styles.toolChipTextActive,
                ]}
              >
                联网搜索
              </Text>
            </TouchableOpacity>
            {context.scene === 'general' && onPickImage ? (
              <TouchableOpacity
                style={styles.toolChip}
                onPress={onPickImage}
                disabled={isSending}
              >
                <Text style={styles.toolChipText}>添加图片</Text>
              </TouchableOpacity>
            ) : context.scene === 'textbook' && onReselect ? (
              <TouchableOpacity
                style={styles.toolChip}
                onPress={onReselect}
                disabled={isSending}
              >
                <Text style={styles.toolChipText}>框选内容</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
          <TouchableOpacity
            style={styles.newConversationButton}
            onPress={onCreateConversation}
            disabled={isSending}
            accessibilityRole="button"
            accessibilityLabel="新建会话"
          >
            <Text style={styles.newConversationIcon}>＋</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={inputText}
            onChangeText={onInputChange}
            style={styles.input}
            placeholder={
              isSending ? 'AI 正在回复中…' : '向 iMates 提问…'
            }
            placeholderTextColor="#9499AC"
            multiline
            maxLength={2000}
            editable={!isSending}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => onSend()}
            accessibilityLabel="AI 问题输入框"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !isSending &&
                !inputText.trim() &&
                !attachment &&
                styles.sendButtonDisabled,
              isSending && styles.stopButton,
            ]}
            onPress={isSending ? onStop : () => onSend()}
            disabled={
              !isSending && !inputText.trim() && !attachment
            }
            accessibilityRole="button"
            accessibilityLabel={isSending ? '停止生成' : '发送消息'}
          >
            {isSending ? (
              <View style={styles.stopIcon} />
            ) : (
              <Text style={styles.sendText}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.footerText}>
          与学伴共学，敢质疑、会判断，思维不设限
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  emptyMessageContent: {
    flexGrow: 1,
  },
  initializingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initializingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#858A9D',
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  aiMessageRow: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    marginRight: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#EDEAFE',
  },
  avatarDot: {
    width: 5,
    height: 5,
    marginBottom: 4,
    borderRadius: 3,
    backgroundColor: '#6256D9',
  },
  avatarLine: {
    height: 3,
    marginBottom: 3,
    borderRadius: 2,
    backgroundColor: '#8B83E5',
  },
  messageBubble: {
    maxWidth: '84%',
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
  userMessageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFFFFF',
  },
  typingRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#74798F',
  },
  stoppedText: {
    marginTop: 8,
    fontSize: 11,
    color: '#8A8FA2',
  },
  welcome: {
    flex: 1,
    minHeight: 410,
    paddingVertical: 30,
    justifyContent: 'center',
  },
  welcomeMark: {
    width: 62,
    height: 62,
    marginBottom: 18,
    paddingHorizontal: 15,
    alignSelf: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#6256D9',
  },
  welcomeMarkDot: {
    width: 7,
    height: 7,
    marginBottom: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  welcomeMarkLine: {
    height: 4,
    marginBottom: 5,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  welcomeMarkLineShort: {
    width: '68%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CFCBFA',
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
  suggestionGrid: {
    marginTop: 24,
  },
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
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#353A53',
  },
  suggestionArrow: {
    marginLeft: 8,
    fontSize: 22,
    color: '#7770DE',
  },
  composerArea: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#DADCE7',
    backgroundColor: '#FFFFFF',
  },
  attachmentBar: {
    minHeight: 70,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 7,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DED9FA',
    backgroundColor: '#F5F3FF',
  },
  attachmentImage: {
    width: 58,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#E8E9F0',
  },
  attachmentCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  attachmentTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2C3049',
  },
  attachmentHint: {
    marginTop: 4,
    fontSize: 10,
    color: '#777C90',
  },
  attachmentAction: {
    minHeight: 44,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6256D9',
  },
  removeAttachment: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAttachmentText: {
    fontSize: 24,
    color: '#74798F',
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  toolScroll: {
    flex: 1,
  },
  tools: {
    paddingLeft: 12,
    paddingRight: 4,
    paddingBottom: 7,
  },
  toolChip: {
    minHeight: 44,
    marginRight: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DFE1EA',
    backgroundColor: '#F8F8FB',
  },
  toolChipActive: {
    borderColor: '#B9B3F2',
    backgroundColor: '#EEEAFE',
  },
  toolChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666C82',
  },
  toolChipTextActive: {
    color: '#5B50CE',
  },
  newConversationButton: {
    width: 44,
    height: 44,
    marginRight: 12,
    marginBottom: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#EEEAFE',
  },
  newConversationIcon: {
    marginTop: -2,
    fontSize: 25,
    fontWeight: '500',
    color: '#6256D9',
  },
  inputRow: {
    minHeight: 58,
    marginHorizontal: 12,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9DBE7',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    paddingHorizontal: 10,
    paddingTop: 11,
    paddingBottom: 9,
    fontSize: 16,
    lineHeight: 22,
    color: '#20243D',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6256D9',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  stopButton: {
    backgroundColor: '#4E5267',
  },
  stopIcon: {
    width: 13,
    height: 13,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  sendText: {
    marginTop: -2,
    fontSize: 25,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerText: {
    marginTop: 7,
    fontSize: 9,
    textAlign: 'center',
    color: '#A0A4B4',
  },
});

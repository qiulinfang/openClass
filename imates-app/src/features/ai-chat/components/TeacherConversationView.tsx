import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ChatMessage } from '@/services/ai-chat-service';
import { MathRenderer } from '@/components/MathRenderer';
import type { TeacherChatSession } from '../services/teacher-chat-service';

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

export function TeacherConversationView({
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

  useEffect(() => {
    const timer = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      80
    );
    return () => clearTimeout(timer);
  }, [messages]);

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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.messageContent,
          messages.length === 0 && styles.emptyContent,
        ]}
        renderItem={({ item }) => {
          const user = item.sender === 'user';
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
                {item.imageUri ? (
                  <Image
                    source={{ uri: item.imageUri }}
                    style={styles.messageImage}
                    resizeMode="contain"
                  />
                ) : user ? (
                  <Text style={styles.userText}>{item.content}</Text>
                ) : (
                  <MathRenderer content={item.content} textColor="#20243D" />
                )}
              </View>
            </View>
          );
        }}
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
    </KeyboardAvoidingView>
  );
}

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

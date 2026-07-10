import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { ChatMessage, AiChatService } from '@/services/ai-chat-service';
import { storage } from '@/services/storage';
import { MathRenderer } from '@/components/MathRenderer';

interface ChatScreenProps {
  onBack?: () => void;
}

const SUGGESTIONS = [
  '帮我做个复习计划 📅',
  '解答一道数学几何题 📐',
  '英语作文润色翻译 📝',
  '解释一下什么是万有引力 🍎',
];

// 白天明亮风格颜色系统
const LightColors = {
  background: '#F8FAFC',       // 浅灰蓝背景 (slate-50)
  headerBackground: '#FFFFFF',   // 纯白标题栏背景
  border: '#E2E8F0',           // 灰描边 (slate-200)
  textPrimary: '#0F172A',      // 深炭黑主文本 (slate-900)
  textSecondary: '#475569',    // 次要灰文本 (slate-700)
  textMuted: '#94A3B8',        // 占位/微弱提示 (slate-400)
  primary: '#3B82F6',          // 品牌蓝
  inputBg: '#F1F5F9',          // 输入框浅背景 (slate-100)
  aiBubbleBg: '#FFFFFF',       // AI气泡背景（纯白）
  userBubbleBg: '#3B82F6',     // 用户气泡背景
};

export function ChatScreen({ onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      content: '你好！我是你的 iMates 智能学习伴侣。你可以随时向我提问，不管是难题解答、英语翻译，还是制定学习计划，我都非常乐意协助你！',
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [sessionId, setSessionId] = useState('');

  const flatListRef = useRef<FlatList>(null);
  const cancelActiveRequest = useRef<(() => void) | null>(null);

  // 初始化会话 ID 和检查来自其他页面的 Prefill 文本
  useEffect(() => {
    const initSession = async () => {
      const userId = await storage.getItem('xuebanuserid') || 'user';
      setSessionId(`${userId}-general-session-${Date.now()}`);

      const prefill = await storage.getItem('CHAT_PREFILL');
      if (prefill) {
        setInputText(prefill);
        await storage.removeItem('CHAT_PREFILL');
      }
    };
    initSession();

    // 组件卸载时清理未完成的请求
    return () => {
      if (cancelActiveRequest.current) {
        cancelActiveRequest.current();
      }
    };
  }, []);

  // 每次消息变更自动滚到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSend = (textToSend: string) => {
    const trimmedText = textToSend.trim();
    if (!trimmedText || isAiTyping) return;

    // 1. 添加用户消息
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: trimmedText,
      timestamp: Date.now(),
    };

    // 2. 添加 AI 占位消息（用于流式接收）
    const aiMsgId = `ai-${Date.now()}`;
    const aiMsgPlaceholder: ChatMessage = {
      id: aiMsgId,
      sender: 'ai',
      content: '',
      timestamp: Date.now() + 10,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, aiMsgPlaceholder]);
    setInputText('');
    setIsAiTyping(true);

    // 3. 启动接口流式请求并保存取消函数
    let accumulatedText = '';
    const cancel = AiChatService.sendStreamMessage(
      trimmedText,
      sessionId,
      (chunk) => {
        accumulatedText += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? { ...msg, content: accumulatedText }
              : msg
          )
        );
      },
      (fullText) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? { ...msg, content: fullText || '没有返回有效数据', isStreaming: false }
              : msg
          )
        );
        setIsAiTyping(false);
        cancelActiveRequest.current = null;
      },
      (err) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? { ...msg, content: `发送失败: ${err.message || '请检查您的网络连接'}`, isStreaming: false }
              : msg
          )
        );
        setIsAiTyping(false);
        cancelActiveRequest.current = null;
      }
    );

    cancelActiveRequest.current = cancel;
  };

  const handleBack = () => {
    if (cancelActiveRequest.current) {
      cancelActiveRequest.current();
    }
    if (onBack) {
      onBack();
    }
  };

  // 渲染单条消息
  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.bubbleContainer, isUser ? styles.userBubbleContainer : styles.aiBubbleContainer]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>🤖</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          {isUser ? (
            <Text style={[styles.bubbleText, styles.userBubbleText]}>
              {item.content}
            </Text>
          ) : (
            <MathRenderer
              content={item.content}
              markdownStyle={markdownStyles}
            />
          )}
          {item.isStreaming && item.content === '' && (
            <ActivityIndicator size="small" color={LightColors.textSecondary} style={styles.typingLoader} />
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部标题栏 */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>iMates 智能伴侣</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.headerSubtitle}>AI 助手在线</Text>
          </View>
        </View>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* 聊天区 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToBottom}
      />

      {/* 输入与快捷提示词 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* 快捷推荐提问 */}
        {!isAiTyping && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              horizontal
              data={SUGGESTIONS}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionChip}
                  onPress={() => handleSend(item.replace(/[\u2300-\u27BF]/g, ''))} // 移除非文字的 emoji
                >
                  <Text style={styles.suggestionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* 底部输入框区域 */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder={isAiTyping ? 'AI 正在回复中...' : '向 iMates 提问...'}
            placeholderTextColor={LightColors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            editable={!isAiTyping}
            onSubmitEditing={() => handleSend(inputText)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isAiTyping) ? styles.sendButtonDisabled : null]}
            onPress={() => handleSend(inputText)}
            disabled={!inputText.trim() || isAiTyping}
          >
            <Text style={styles.sendButtonText}>发送</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LightColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: LightColors.border,
    backgroundColor: LightColors.headerBackground,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: LightColors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: LightColors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  headerSubtitle: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '500',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  backButtonPlaceholder: {
    width: 40,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  bubbleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  userBubbleContainer: {
    alignSelf: 'flex-end',
  },
  aiBubbleContainer: {
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: LightColors.border,
  },
  avatarText: {
    fontSize: 18,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: LightColors.userBubbleBg,
    borderTopRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: LightColors.aiBubbleBg,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: LightColors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userBubbleText: {
    color: '#FFFFFF',
  },
  aiBubbleText: {
    color: LightColors.textPrimary,
  },
  typingLoader: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  suggestionsContainer: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
  },
  suggestionsList: {
    paddingHorizontal: 16,
  },
  suggestionChip: {
    backgroundColor: LightColors.headerBackground,
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  suggestionText: {
    color: LightColors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  inputArea: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: LightColors.border,
    backgroundColor: LightColors.headerBackground,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: LightColors.inputBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LightColors.border,
    height: 40,
    paddingHorizontal: 16,
    color: LightColors.textPrimary,
    fontSize: 15,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: LightColors.primary,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    color: LightColors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  strong: {
    fontWeight: 'bold',
    color: LightColors.textPrimary,
  },
  bullet_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
    lineHeight: 22,
  },
  link: {
    color: LightColors.primary,
    textDecorationLine: 'underline',
  },
  paragraph: {
    marginVertical: 4,
    lineHeight: 22,
    color: LightColors.textPrimary,
  },
});

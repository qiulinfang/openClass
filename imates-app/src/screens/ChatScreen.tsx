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
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ChatMessage, AiChatService } from '@/services/ai-chat-service';
import { storage } from '@/services/storage';
import { MathRenderer } from '@/components/MathRenderer';
import { SyncService } from '@/services/sync-service';

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
  success: '#10B981',
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
  
  // 图片上传状态
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const cancelActiveRequest = useRef<(() => void) | null>(null);

  // 初始化或从本地恢复会话 ID
  useEffect(() => {
    const initSession = async () => {
      const userId = await storage.getItem('xuebanuserid') || 'user';
      const lastSessionId = await storage.getItem(`IMATES_LAST_SESSION_ID_${userId}`);
      if (lastSessionId) {
        setSessionId(lastSessionId);
      } else {
        const newSessionId = `${userId}-general-session-${Date.now()}`;
        await storage.setItem(`IMATES_LAST_SESSION_ID_${userId}`, newSessionId);
        setSessionId(newSessionId);
      }
    };
    initSession();

    return () => {
      if (cancelActiveRequest.current) {
        cancelActiveRequest.current();
      }
    };
  }, []);

  // 当 sessionId 准备就绪时，从本地存储加载历史聊天气泡
  useEffect(() => {
    if (!sessionId) return;
    const loadSavedMessages = async () => {
      const saved = await storage.getItem(`IMATES_CHAT_SESSION_${sessionId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (e) {
          console.warn('[ChatScreen] 从 AsyncStorage 加载历史消息失败:', e);
        }
      }
      
      // 触发增量拉取同步并合并
      SyncService.syncChatHistory().then(async () => {
        const updated = await storage.getItem(`IMATES_CHAT_SESSION_${sessionId}`);
        if (updated) {
          try {
            setMessages(JSON.parse(updated));
          } catch {}
        }
      });
    };
    loadSavedMessages();
  }, [sessionId]);

  // 当 messages 产生变更（且不在流式输入中）时，自动保存气泡至本地，并触发上报同步
  useEffect(() => {
    if (!sessionId || messages.length <= 1) return;
    const hasStreaming = messages.some(msg => msg.isStreaming);
    if (hasStreaming) return; // 避免在 AI 打字流式吐出时高频写入

    const saveMessages = async () => {
      try {
        await storage.setItem(`IMATES_CHAT_SESSION_${sessionId}`, JSON.stringify(messages));
        // 保存完成后，异步上报此会话数据
        SyncService.syncChatHistory();
      } catch (e) {
        console.warn('[ChatScreen] 缓存聊天记录失败:', e);
      }
    };
    saveMessages();
  }, [messages, sessionId]);

  // 监听 sessionId 就绪，如果存在挂载的预填提问则自动触发发送
  useEffect(() => {
    if (!sessionId) return;
    const triggerAutoSend = async () => {
      const prefill = await storage.getItem('CHAT_PREFILL');
      if (prefill) {
        await storage.removeItem('CHAT_PREFILL');
        // 延时一会触发，确保 UI 和 List 加载完成
        setTimeout(() => {
          handleSend(prefill);
        }, 300);
      }
    };
    triggerAutoSend();
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // 处理拍照上传
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('授权失败', '我们需要相机权限来拍摄照片！');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('[ChatScreen] 调用相机异常:', e);
    }
  };

  // 从相册选取
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('授权失败', '我们需要相册访问权限来上传图片！');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('[ChatScreen] 打开相册异常:', e);
    }
  };

  // 触发图片上传源选择
  const triggerImageUpload = () => {
    Alert.alert(
      '上传题目图片 📸',
      '选择上传方式：',
      [
        { text: '拍照拍摄', onPress: handleTakePhoto },
        { text: '从相册选取', onPress: handlePickImage },
        { text: '取消', style: 'cancel' }
      ]
    );
  };

  const handleSend = (textToSend: string, imageUriToSend?: string) => {
    const trimmedText = textToSend.trim();
    const hasImage = !!imageUriToSend;
    if (!trimmedText && !hasImage) return;
    if (isAiTyping) return;

    // 1. 添加用户消息
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: trimmedText || '📸 [已上传图片问题]',
      timestamp: Date.now(),
      imageUri: imageUriToSend || undefined,
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
    setSelectedImage(null);
    setIsAiTyping(true);

    // 3. 构建发送内容：如果包含图片，则在 prompt 附加标记，便于模拟分析
    const finalPrompt = hasImage
      ? `${trimmedText}\n\n[图片问题分析请求 - 图片URI: ${imageUriToSend}]`
      : trimmedText;

    // 4. 启动接口流式请求并保存取消函数
    let accumulatedText = '';
    const cancel = AiChatService.sendStreamMessage(
      finalPrompt,
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
        // 如果是图片分析请求，在此处微调回答以表现出读图成功，更显逼真
        let finalReply = fullText;
        if (hasImage && !fullText.includes('图片')) {
          finalReply = `收到您拍摄上传的题目照片！📸 正在为您做深度图文解析：\n\n${fullText}`;
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? { ...msg, content: finalReply || '没有返回有效数据', isStreaming: false }
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
          {/* 用户上传的图片气泡回显 */}
          {item.imageUri && (
            <Image
              source={{ uri: item.imageUri }}
              style={styles.bubbleImage}
              resizeMode="cover"
            />
          )}
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

  // 渲染首屏欢迎卡片及 4 大核心功能入口点 (所有能力从这里展开)
  const renderWelcomeHeader = () => {
    if (messages.length > 1) return null;
    return (
      <View style={styles.welcomeSection}>
        <View style={styles.appPromo}>
          <Text style={styles.promoEmoji}>🎯</Text>
          <Text style={styles.promoTitle}>iMates 智能学习伴侣</Text>
          <Text style={styles.promoDesc}>支持多模态拍题、知识追问、学案理解与错题复盘，所有能力从这里展开。</Text>
        </View>

        <Text style={styles.gridSectionTitle}>🛠️ 核心学习功能入口：</Text>
        
        {/* 2x2 扁平化学功能卡片 */}
        <View style={styles.capabilitiesGrid}>
          <TouchableOpacity
            style={styles.capabilityCard}
            onPress={() => handleSend('我想要系统梳理并学习今天的重难点知识')}
          >
            <Text style={styles.cardIcon}>📖</Text>
            <Text style={styles.cardTitle}>AI 学习</Text>
            <Text style={styles.cardSub}>掌握章节知识网络</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.capabilityCard}
            onPress={() => handleSend('请解答一下我的这道疑问：')}
          >
            <Text style={styles.cardIcon}>❓</Text>
            <Text style={styles.cardTitle}>AI 问答</Text>
            <Text style={styles.cardSub}>全科疑难解惑答疑</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.capabilityCard}
            onPress={triggerImageUpload}
          >
            <Text style={styles.cardIcon}>📸</Text>
            <Text style={styles.cardTitle}>图片上传</Text>
            <Text style={styles.cardSub}>拍题自动识别解析</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.capabilityCard}
            onPress={() => handleSend('分析一下我的错题本里有哪些我没完全掌握的知识点？')}
          >
            <Text style={styles.cardIcon}>📚</Text>
            <Text style={styles.cardTitle}>错题讨论</Text>
            <Text style={styles.cardSub}>巩固弱项温故知新</Text>
          </TouchableOpacity>
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

      {/* 聊天与欢迎页 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        ListHeaderComponent={renderWelcomeHeader}
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
        {!isAiTyping && messages.length > 1 && (
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
                  onPress={() => handleSend(item.replace(/[\u2300-\u27BF]/g, ''))}
                >
                  <Text style={styles.suggestionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* 待发送的图片预览缩略图 */}
        {selectedImage && (
          <View style={styles.imagePreviewBar}>
            <Image source={{ uri: selectedImage }} style={styles.previewThumbnail} />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setSelectedImage(null)}
            >
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 底部输入框区域 */}
        <View style={styles.inputArea}>
          {/* 照片选取/拍照按钮 */}
          <TouchableOpacity
            style={styles.cameraIconBtn}
            onPress={triggerImageUpload}
            disabled={isAiTyping}
          >
            <Text style={styles.cameraEmoji}>📸</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder={isAiTyping ? 'AI 正在回复中...' : '向 iMates 提问...'}
            placeholderTextColor={LightColors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            editable={!isAiTyping}
            onSubmitEditing={() => handleSend(inputText, selectedImage || undefined)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              ((!inputText.trim() && !selectedImage) || isAiTyping) ? styles.sendButtonDisabled : null
            ]}
            onPress={() => handleSend(inputText, selectedImage || undefined)}
            disabled={(!inputText.trim() && !selectedImage) || isAiTyping}
          >
            <Text style={styles.sendButtonText}>发送</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// LaTeX Markdown 渲染排版样式
const markdownStyles = {
  body: {
    color: LightColors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  paragraph: {
    marginVertical: 4,
  },
  strong: {
    fontWeight: 'bold',
    color: '#1E293B',
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
};

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
    fontSize: 20,
    color: LightColors.textPrimary,
    fontWeight: '600',
  },
  backButtonPlaceholder: {
    width: 36,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: LightColors.textPrimary,
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
    backgroundColor: LightColors.success,
    marginRight: 4,
  },
  headerSubtitle: {
    fontSize: 9,
    color: LightColors.textSecondary,
    fontWeight: '600',
  },
  headerRightPlaceholder: {
    width: 36,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  welcomeSection: {
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LightColors.border,
  },
  appPromo: {
    alignItems: 'center',
    marginBottom: 18,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 14,
  },
  promoEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: LightColors.textPrimary,
    marginBottom: 6,
  },
  promoDesc: {
    fontSize: 12,
    color: LightColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  gridSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: LightColors.textPrimary,
    marginBottom: 12,
  },
  capabilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  capabilityCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: LightColors.textPrimary,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 9,
    color: LightColors.textMuted,
  },
  bubbleContainer: {
    flexDirection: 'row',
    marginVertical: 8,
    alignItems: 'flex-start',
    width: '100%',
  },
  userBubbleContainer: {
    justifyContent: 'flex-end',
  },
  aiBubbleContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  userBubble: {
    backgroundColor: LightColors.userBubbleBg,
    borderTopRightRadius: 2,
  },
  aiBubble: {
    backgroundColor: LightColors.aiBubbleBg,
    borderTopLeftRadius: 2,
    borderWidth: 1,
    borderColor: LightColors.border,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userBubbleText: {
    color: '#FFFFFF',
  },
  bubbleImage: {
    width: 160,
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  typingLoader: {
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LightColors.border,
    paddingVertical: 8,
  },
  suggestionsList: {
    paddingHorizontal: 12,
  },
  suggestionChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionText: {
    fontSize: 11,
    color: LightColors.textSecondary,
    fontWeight: '600',
  },
  imagePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: LightColors.border,
  },
  previewThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  removeImageBtn: {
    position: 'absolute',
    left: 54,
    top: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: LightColors.border,
    backgroundColor: '#FFFFFF',
  },
  cameraIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cameraEmoji: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    height: 38,
    backgroundColor: LightColors.inputBg,
    borderRadius: 19,
    paddingHorizontal: 16,
    fontSize: 14,
    color: LightColors.textPrimary,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: LightColors.primary,
    borderRadius: 19,
    paddingHorizontal: 16,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

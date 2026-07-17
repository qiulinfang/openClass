import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Card } from '@/components/Card';
import { MathRenderer } from '@/components/MathRenderer';
import { ExerciseService, ExerciseItem } from '@/services/exercise-service';
import { AiChatService, ChatMessage } from '@/services/ai-chat-service';
import { SUBJECT_ID_TO_NAME } from '@/services/homework-service';

interface ExerciseSolveScreenProps {
  onLogout: () => void;
}

const LightColors = {
  background: '#F8FAFC',
  cardBackground: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#3B82F6',
  warning: '#F59E0B',
  success: '#10B981',
  selectedBg: 'rgba(59, 130, 246, 0.08)',
};

const DRAFT_BOARD_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #F8FAFC; }
    canvas { display: block; background: #FFFFFF; box-shadow: inset 0 0 10px rgba(0,0,0,0.02); }
    .toolbar { position: absolute; bottom: 10px; left: 10px; right: 10px; display: flex; gap: 8px; justify-content: center; z-index: 10; }
    button { background: #3B82F6; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2); }
    button.clear { background: #EF4444; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2); }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div class="toolbar">
    <button class="clear" onclick="clearCanvas()">清空草稿</button>
    <button onclick="undo()">撤回一步</button>
  </div>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let history = [];
    
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      saveState();
    }
    window.addEventListener('resize', resize);
    window.addEventListener('load', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      saveState();
    });

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function startDraw(e) {
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1E293B';
    }

    function draw(e) {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    function stopDraw() {
      if (drawing) {
        drawing = false;
        saveState();
      }
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);

    function clearCanvas() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveState();
    }

    function saveState() {
      history.push(canvas.toDataURL());
      if (history.length > 15) history.shift();
    }

    function undo() {
      if (history.length > 1) {
        history.pop(); // 移除当前状态
        const img = new Image();
        img.src = history[history.length - 1];
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
      } else if (history.length === 1) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  </script>
</body>
</html>
`;

// 系统预置的刷题库题目
const PRESET_QUESTIONS: ExerciseItem[] = [
  {
    id: 'preset-math-1',
    title: '二次函数的顶点坐标计算',
    subject: '2',
    content: '已知二次函数 $f(x) = x^2 - 4x + 7$。\\n(1) 求二次函数图象的对称轴与顶点坐标；\\n(2) 当 $x \\in [1, 5]$ 时，求函数 $f(x)$ 的最大值与最小值。',
    answer: '对称轴: x=2, 顶点: (2, 3), 最小值: 3, 最大值: 12',
    timestamp: Date.now()
  },
  {
    id: 'preset-physics-1',
    title: '物体的斜面滑块滑行计算',
    subject: '4',
    content: '一个质量为 $m = 2\\text{kg}$ 的滑块以初速度 $v_0 = 10\\text{m/s}$ 沿倾角为 $\\theta = 37^\\circ$ 的斜面向上滑行。已知滑块与斜面间的动摩擦因数 $\\mu = 0.5$（重力加速度 $g = 10\\text{m/s}^2$）。\\n(1) 求滑块向上滑行时的加速度大小；\\n(2) 求滑块在斜面上滑行的最大位移 $s$。',
    answer: '加速度: 10m/s^2, 最大位移: 5m',
    timestamp: Date.now()
  },
  {
    id: 'preset-chemistry-1',
    title: '化学电池的电极反应',
    subject: '5',
    content: '以稀硫酸为电解质溶液的铜锌原电池中，锌片作为负极，铜片作为正极。\\n(1) 写出正极与负极的电极反应式；\\n(2) 计算当电路中转移 $0.2\\text{mol}$ 电子时，正极生成的氢气在标准状况下的体积。',
    answer: '负极: Zn - 2e- = Zn2+; 正极: 2H+ + 2e- = H2; 体积: 2.24L',
    timestamp: Date.now()
  },
  {
    id: 'preset-biology-1',
    title: '孟德尔豌豆遗传实验分析',
    subject: '6',
    content: '已知豌豆的黄色子叶对绿色子叶为显性。现有杂合的黄色子叶豌豆进行自交，求：\\n(1) 子一代中黄色子叶与绿色子叶的表型比例；\\n(2) 子一代黄色子叶豌豆中，杂合子所占的比例。',
    answer: '(1) 黄色:绿色 = 3:1; (2) 杂合子比例为 2/3',
    timestamp: Date.now()
  }
];

export function ExerciseSolveScreen({ onLogout }: ExerciseSolveScreenProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'draft' | 'ai'>('library');
  
  // 习题数据
  const [localExercises, setLocalExercises] = useState<ExerciseItem[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<ExerciseItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // AI 导学对话状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [chatSessionId, setChatSessionId] = useState('');
  
  const chatFlatListRef = useRef<FlatList>(null);
  const webViewRef = useRef<WebView>(null);

  // 加载本地收藏习题
  const loadLocalExercises = useCallback(async () => {
    try {
      const data = await ExerciseService.getExercises();
      setLocalExercises(data);
      console.log(`[ExerciseSolveScreen] 📥 自选习题库拉取成功！共载入云端收藏习题数: ${data.length} 个`);
    } catch (e) {
      console.warn('[ExerciseSolveScreen] 获取收藏习题失败:', e);
    }
  }, []);

  useEffect(() => {
    loadLocalExercises();
    // 初始化一个 AI 导学 Session ID
    setChatSessionId(`solve-session-${Date.now()}`);
  }, [loadLocalExercises]);

  // 融合“本地收藏”与“系统预置”题目的完整列表
  const allQuestions = [...PRESET_QUESTIONS, ...localExercises];

  // 搜索过滤
  const filteredQuestions = allQuestions.filter(q => {
    const matchSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        q.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  // 处理选中题目
  const handleSelectQuestion = (q: ExerciseItem) => {
    console.log(`[ExerciseSolveScreen Click] 🖱️ 用户选择题目作答: "${q.title}" (ID: ${q.id}, 学科代码: ${q.subject})`);
    setActiveQuestion(q);
    // 重置对应的 AI 导学对话内容
    setChatMessages([
      {
        id: 'guidance-welcome',
        sender: 'ai',
        content: `你好！我已为你准备好题目 **【${q.title}】** 的AI导学答疑服务。\\n\\n**题目详情：**\\n${q.content}\\n\\n你可以先在 **“草稿作答”** 板块动手做一下，如果有不明白的推导步骤或者需要答案提示，随时可以在这里向我提问哦！🤖`,
        timestamp: Date.now()
      }
    ]);
    // 切换至作答草稿本
    setActiveTab('draft');
  };

  // 发送 AI 导学问题
  const handleSendGuidance = async () => {
    if (!chatInputText.trim() || isAiTyping || !activeQuestion) return;

    const userMsgText = chatInputText.trim();
    console.log(`[ExerciseSolveScreen AI] 🤖 针对当前题目 [${activeQuestion.title}] 发起 AI 导学提问: "${userMsgText}"`);
    setChatInputText('');

    // 新增用户消息
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      content: userMsgText,
      timestamp: Date.now()
    };
    
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setIsAiTyping(true);

    // 滚动到底部
    setTimeout(() => chatFlatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // 携带当前题目上下文发送给 AI
      const promptContext = `当前习题题干：\n${activeQuestion.content}\n\n学生的问题：\n${userMsgText}`;
      
      let aiResponseText = '';
      const responsePlaceholderId = `msg-${Date.now()}-ai-placeholder`;

      // 在消息列表中先插入一个空白的 AI 回复占位符
      setChatMessages(prev => [
        ...prev,
        {
          id: responsePlaceholderId,
          sender: 'ai',
          content: '',
          timestamp: Date.now()
        }
      ]);

      await AiChatService.streamChat(
        chatSessionId,
        promptContext,
        (token) => {
          aiResponseText += token;
          setChatMessages(prev => prev.map(msg => 
            msg.id === responsePlaceholderId ? { ...msg, content: aiResponseText } : msg
          ));
        }
      );
    } catch (e) {
      console.warn('[ExerciseSolveScreen] AI导学请求失败:', e);
      setChatMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}-error`,
          sender: 'ai',
          content: '❌ 抱歉，学伴服务器连接超时，请稍后重试。',
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsAiTyping(false);
      setTimeout(() => chatFlatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // 拍照搜题模拟
  const handlePhotoSearchSimulate = () => {
    Alert.prompt(
      '智能搜题 (模拟)',
      '请输入你要搜索的题目关键词或题干文本：',
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '搜索并导入',
          onPress: (text) => {
            if (!text || !text.trim()) return;
            console.log(`[ExerciseSolveScreen PhotoSearch] 📸 拍照搜题模拟成功！提取识别文本: "${text.trim()}"`);
            const newQ: ExerciseItem = {
              id: `custom-search-${Date.now()}`,
              title: `搜题导入: ${text.substring(0, 10)}...`,
              subject: '2',
              content: text.trim(),
              timestamp: Date.now()
            };
            // 选定为当前作答题目
            handleSelectQuestion(newQ);
            Alert.alert('导入成功', '已为你自动识别题目并载入草稿纸！');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 顶部 Header */}
      <View style={styles.header}>
        <View style={styles.userProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>练</Text>
          </View>
          <View>
            <Text style={styles.welcomeText}>您好，</Text>
            <Text style={styles.userName}>自主刷题 & AI导学 ✍️</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutIconButton} onPress={onLogout}>
          <Text style={styles.logoutIconText}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* 顶部三段式选项卡 */}
      <View style={styles.tabHeader}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'library' && styles.tabBtnActive]}
          onPress={() => {
            loadLocalExercises();
            setActiveTab('library');
          }}
        >
          <Text style={[styles.tabBtnText, activeTab === 'library' && styles.tabBtnTextActive]}>
            📁 选题库
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'draft' && styles.tabBtnActive]}
          onPress={() => setActiveTab('draft')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'draft' && styles.tabBtnTextActive]}>
            ✍️ 草稿作答
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ai' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ai')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'ai' && styles.tabBtnTextActive]}>
            🤖 AI 导学
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* ==================== 1. 选题库视图 ==================== */}
        {activeTab === 'library' && (
          <View style={styles.libraryContainer}>
            <View style={styles.searchBarRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="搜索预置题目或已收藏习题..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity style={styles.photoBtn} onPress={handlePhotoSearchSimulate}>
                <Text style={styles.photoBtnText}>📸 拍照搜题</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredQuestions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isPreset = item.id.startsWith('preset');
                const subjectName = SUBJECT_ID_TO_NAME[item.subject] || '学科';
                return (
                  <TouchableOpacity onPress={() => handleSelectQuestion(item)} activeOpacity={0.85}>
                    <Card style={styles.questionCard}>
                      <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.badgeLabel}>{isPreset ? '💡 推荐习题' : '⭐ 我的收藏'}</Text>
                          <Text style={styles.subjectText}> • {subjectName}</Text>
                        </View>
                        <Text style={styles.goBtnText}>去作答 ➔</Text>
                      </View>
                      <Text style={styles.questionTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={styles.questionPreview}>
                        <MathRenderer content={item.content.substring(0, 80) + '...'} textColor="#475569" />
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>没有找到符合条件的题目 📭</Text>
                </View>
              }
            />
          </View>
        )}

        {/* ==================== 2. 草稿作答视图 ==================== */}
        {activeTab === 'draft' && (
          <View style={styles.draftContainer}>
            {activeQuestion ? (
              <>
                {/* 题干展示区 */}
                <Card style={styles.stemCard}>
                  <Text style={styles.stemLabel}>当前题目：{activeQuestion.title}</Text>
                  <ScrollView style={styles.stemScroll} showsVerticalScrollIndicator={false}>
                    <MathRenderer content={activeQuestion.content} textColor="#0F172A" />
                  </ScrollView>
                </Card>

                {/* 嵌入的 HTML5 Canvas 草稿本 */}
                <View style={styles.canvasWrapper}>
                  <View style={styles.canvasHeader}>
                    <Text style={styles.canvasTitle}>📝 电子草稿演算本 (支持手写)：</Text>
                  </View>
                  <WebView
                    ref={webViewRef}
                    originWhitelist={['*']}
                    source={{ html: DRAFT_BOARD_HTML }}
                    style={styles.webView}
                    scrollEnabled={false}
                  />
                </View>

                {/* 前往 AI 导学按钮 */}
                <TouchableOpacity
                  style={styles.startAiBtn}
                  onPress={() => setActiveTab('ai')}
                >
                  <Text style={styles.startAiBtnText}>🤖 遇到难题？开启 AI 智能导学 ➔</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>💡 请先去“选题库”挑选一道题目，才能使用草稿作答功能哦</Text>
                <TouchableOpacity style={styles.goLibBtn} onPress={() => setActiveTab('library')}>
                  <Text style={styles.goLibBtnText}>前往选题库</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ==================== 3. AI 导学视图 ==================== */}
        {activeTab === 'ai' && (
          <View style={styles.aiContainer}>
            {activeQuestion ? (
              <>
                {/* AI 导学聊天气泡区 */}
                <FlatList
                  ref={chatFlatListRef}
                  data={chatMessages}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.chatListContent}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isUser = item.sender === 'user';
                    return (
                      <View style={[styles.chatBubbleRow, isUser ? styles.userRow : styles.aiRow]}>
                        {!isUser && (
                          <View style={styles.aiAvatar}>
                            <Text style={styles.aiAvatarText}>🤖</Text>
                          </View>
                        )}
                        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                          <MathRenderer
                            content={item.content}
                            textColor={isUser ? '#FFFFFF' : '#0F172A'}
                          />
                        </View>
                      </View>
                    );
                  }}
                />

                {/* 正在思考 Indicator */}
                {isAiTyping && (
                  <View style={styles.typingBox}>
                    <ActivityIndicator size="small" color={LightColors.primary} />
                    <Text style={styles.typingText}> 学伴正在拆解题目，思考中...</Text>
                  </View>
                )}

                {/* 底部输入框区域 */}
                <View style={styles.inputArea}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="输入你在解答此题时遇到的疑问..."
                    placeholderTextColor="#94A3B8"
                    value={chatInputText}
                    onChangeText={setChatInputText}
                    onSubmitEditing={handleSendGuidance}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, !chatInputText.trim() && styles.sendBtnDisabled]}
                    onPress={handleSendGuidance}
                    disabled={!chatInputText.trim() || isAiTyping}
                  >
                    <Text style={styles.sendBtnText}>发送</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>💡 请先去“选题库”选择题目，再开启 AI 专属导学服务</Text>
                <TouchableOpacity style={styles.goLibBtn} onPress={() => setActiveTab('library')}>
                  <Text style={styles.goLibBtnText}>前往选题库</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LightColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: LightColors.border,
    backgroundColor: '#FFFFFF',
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: LightColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  welcomeText: {
    fontSize: 11,
    color: LightColors.textSecondary,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: LightColors.textPrimary,
  },
  logoutIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoutIconText: {
    fontSize: 14,
  },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: LightColors.border,
    paddingHorizontal: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: LightColors.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: LightColors.textSecondary,
  },
  tabBtnTextActive: {
    color: LightColors.primary,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },

  // 选题库样式
  libraryContainer: {
    flex: 1,
  },
  searchBarRow: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: LightColors.border,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: LightColors.textPrimary,
    marginRight: 10,
  },
  photoBtn: {
    backgroundColor: LightColors.primary,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
  },
  questionCard: {
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: LightColors.primary,
    backgroundColor: LightColors.selectedBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subjectText: {
    fontSize: 11,
    color: LightColors.textSecondary,
  },
  goBtnText: {
    fontSize: 11,
    color: LightColors.primary,
    fontWeight: '700',
  },
  questionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: LightColors.textPrimary,
    marginBottom: 6,
  },
  questionPreview: {
    maxHeight: 60,
    overflow: 'hidden',
  },

  // 草稿作答样式
  draftContainer: {
    flex: 1,
    padding: 16,
  },
  stemCard: {
    flex: 2,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 12,
    marginBottom: 12,
  },
  stemLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: LightColors.textSecondary,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 4,
  },
  stemScroll: {
    flex: 1,
  },
  canvasWrapper: {
    flex: 4,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LightColors.border,
    backgroundColor: '#FFFFFF',
  },
  canvasHeader: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderColor: LightColors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  canvasTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: LightColors.textSecondary,
  },
  webView: {
    flex: 1,
  },
  startAiBtn: {
    backgroundColor: LightColors.primary,
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  startAiBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // AI 导学对话样式
  aiContainer: {
    flex: 1,
  },
  chatListContent: {
    padding: 16,
  },
  chatBubbleRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-start',
    width: '100%',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LightColors.selectedBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  aiAvatarText: {
    fontSize: 15,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 12,
    padding: 12,
  },
  userBubble: {
    backgroundColor: LightColors.primary,
    borderBottomRightRadius: 2,
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: LightColors.border,
  },
  typingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: LightColors.background,
  },
  typingText: {
    fontSize: 11,
    color: LightColors.textSecondary,
    fontStyle: 'italic',
  },
  inputArea: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: LightColors.border,
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: LightColors.textPrimary,
    marginRight: 10,
  },
  sendBtn: {
    backgroundColor: LightColors.primary,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // 通用占位框
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 12,
    color: LightColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  goLibBtn: {
    marginTop: 16,
    backgroundColor: LightColors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  goLibBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

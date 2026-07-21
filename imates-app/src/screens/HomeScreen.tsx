import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeworkScreen } from './HomeworkScreen';
import { ChatScreen } from './ChatScreen';
import { ProfileScreen } from './ProfileScreen';
import { QuestionBankScreen } from './QuestionBankScreen';
import {
  TextbookCenterScreen,
  TextbookDetailScreen,
  type PracticeQuestion,
  type UserTextbookInfo,
} from '@/features/textbook';
import { storage } from '@/services/storage';
import { SyncService } from '@/services/sync-service';
import { GlobalAiAssistant } from '@/features/ai-chat';
import { HomeworkQuestionDetail } from '@/services/homework-service';
import { useNavigation } from '@react-navigation/native';

interface HomeScreenProps {
  onLogout: () => void;
  route?: any;
}

type TabType = 'resources' | 'homework' | 'ai' | 'question_bank' | 'profile';

const LightColors = {
  background: '#F8FAFC',
  primary: '#4F46E5', // 现代靛蓝色
  textSecondary: '#475569',
};

export function HomeScreen({ onLogout, route }: HomeScreenProps) {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const centerTabProgress = React.useRef(
    new Animated.Value(activeTab === 'ai' ? 1 : 0)
  ).current;
  const [learningTextbook, setLearningTextbook] =
    useState<UserTextbookInfo | null>(null);

  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled
    );

    return () => subscription.remove();
  }, []);

  React.useEffect(() => {
    const nextValue = activeTab === 'ai' ? 1 : 0;

    if (reduceMotionEnabled) {
      centerTabProgress.setValue(nextValue);
      return;
    }

    const animation = Animated.spring(centerTabProgress, {
      toValue: nextValue,
      stiffness: 240,
      damping: 22,
      mass: 0.8,
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [activeTab, centerTabProgress, reduceMotionEnabled]);

  // 监听路由参数以切换 Tab
  React.useEffect(() => {
    if (route?.params?.activeTab) {
      setActiveTab(route.params.activeTab);
    }
  }, [route?.params?.activeTab]);

  // 当 App 进入主界面挂载时，异步触发错题本与聊天历史的云端增量同步
  React.useEffect(() => {
    SyncService.syncMistakes();
    SyncService.syncChatHistory();
  }, []);


  const handleGoAnswerQuestions = (list: HomeworkQuestionDetail[], title: string, subject: string) => {
    navigation.navigate('PracticeReview', {
      questionsList: list,
      homeworkTitle: title,
      homeworkSubject: subject,
    });
  };

  const handleAskAI = async (questionContent: string) => {
    // 写入预填输入并跳到 AI 对话 Tab
    await storage.setItem(
      'CHAT_PREFILL',
      `老师，请问这道题该怎么做？\n\n【题目内容】：\n${questionContent}`
    );
    setActiveTab('ai');
  };

  const handleLearnTextbook = (textbook: UserTextbookInfo) => {
    setLearningTextbook(textbook);
    setActiveTab('resources');
  };

  const handleStartTextbookPractice = (questions: PracticeQuestion[]) => {
    if (questions.length === 0) return;

    handleGoAnswerQuestions(
      questions.map((question) => ({
        id: question.id,
        questionId: question.id,
        questionContent: question.content,
        questionAnswer: question.answer,
        questionAnalysis:
          question.analysis || question.explanation || question.analysisData,
      })),
      '教材练习',
      questions[0].subject
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 主选项卡视口 */}
      <View style={styles.tabContentContainer}>
        {activeTab === 'resources' && (
          learningTextbook ? (
            <TextbookDetailScreen
              textbook={learningTextbook}
              onBackToTextbookCenter={() => setLearningTextbook(null)}
              onStartPractice={handleStartTextbookPractice}
            />
          ) : (
            <TextbookCenterScreen onLearn={handleLearnTextbook} />
          )
        )}

        {activeTab === 'homework' && (
          <HomeworkScreen />
        )}

        {activeTab === 'ai' && (
          <ChatScreen />
        )}

        {activeTab === 'question_bank' && (
          <QuestionBankScreen
            onAskAI={handleAskAI}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen onLogout={onLogout} />
        )}
      </View>

      {/* 底部 Tab 导航栏 */}
      <View style={styles.tabBar}>
        {/* Tab 1: 资源 */}
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'resources' && styles.activeTabItem]}
          onPress={() => {
            setLearningTextbook(null);
            setActiveTab('resources');
          }}
        >
          <Text style={[styles.tabIcon, activeTab === 'resources' && styles.activeTabIcon]}>📖</Text>
          <Text style={[styles.tabLabel, activeTab === 'resources' && styles.activeTabLabel]}>资源</Text>
        </TouchableOpacity>

        {/* Tab 2: 作业 */}
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'homework' && styles.activeTabItem]}
          onPress={() => setActiveTab('homework')}
        >
          <Text style={[styles.tabIcon, activeTab === 'homework' && styles.activeTabIcon]}>📝</Text>
          <Text style={[styles.tabLabel, activeTab === 'homework' && styles.activeTabLabel]}>作业</Text>
        </TouchableOpacity>

        {/* Tab 3 (中央突出): AI 对话 */}
        <TouchableOpacity
          style={styles.centerTabItem}
          activeOpacity={0.85}
          onPress={() => setActiveTab('ai')}
          accessibilityRole="tab"
          accessibilityLabel="AI 对话"
          accessibilityState={{ selected: activeTab === 'ai' }}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.centerFloatingTab,
              {
                opacity: centerTabProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    translateY: centerTabProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 20],
                    }),
                  },
                  {
                    scale: centerTabProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.82],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.centerTabIcon}>🤖</Text>
            <Text style={styles.centerTabLabel}>AI 对话</Text>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.centerStandardTab,
              {
                opacity: centerTabProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Text style={[styles.tabIcon, styles.activeTabIcon]}>🤖</Text>
            <Text style={[styles.tabLabel, styles.activeTabLabel]}>AI 对话</Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Tab 4: 题库 */}
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'question_bank' && styles.activeTabItem]}
          onPress={() => setActiveTab('question_bank')}
        >
          <Text style={[styles.tabIcon, activeTab === 'question_bank' && styles.activeTabIcon]}>📚</Text>
          <Text style={[styles.tabLabel, activeTab === 'question_bank' && styles.activeTabLabel]}>题库</Text>
        </TouchableOpacity>

        {/* Tab 5: 我的 */}
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'profile' && styles.activeTabItem]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabIcon, activeTab === 'profile' && styles.activeTabIcon]}>👤</Text>
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.activeTabLabel]}>我的</Text>
        </TouchableOpacity>
      </View>

      <GlobalAiAssistant
        hidden={activeTab === 'ai'}
      />

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LightColors.background,
  },
  tabContentContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 60 + (Platform.OS === 'ios' ? 8 : 0),
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 8 : 0,
    overflow: 'visible', // 允许中央的圆形突出来
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
  },
  activeTabItem: {
    opacity: 1,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  activeTabIcon: {
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontSize: 10,
    color: LightColors.textSecondary,
    fontWeight: '600',
  },
  activeTabLabel: {
    color: LightColors.primary,
    fontWeight: '700',
  },

  // 中央 Tab：未选中时圆形上浮，选中后回归普通 Tab
  centerTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerFloatingTab: {
    position: 'absolute',
    top: -20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  centerStandardTab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTabIcon: {
    fontSize: 22,
  },
  centerTabLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 1,
  },
});

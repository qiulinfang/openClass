import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeworkScreen } from './HomeworkScreen';
import { ChatScreen } from './ChatScreen';
import { HomeworkAnswerScreen } from './HomeworkAnswerScreen';
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

interface HomeScreenProps {
  onLogout: () => void;
  onNavigateToChat: () => void;
}

type TabType = 'resources' | 'homework' | 'ai' | 'question_bank' | 'profile';

const LightColors = {
  background: '#F8FAFC',
  primary: '#4F46E5', // 现代靛蓝色
  textSecondary: '#475569',
};

export function HomeScreen({ onLogout }: HomeScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [answeringHomeworkId, setAnsweringHomeworkId] = useState<string | null>(null);
  const [answeringHomeworkTitle, setAnsweringHomeworkTitle] = useState<string>('');
  const [answeringHomeworkSubject, setAnsweringHomeworkSubject] = useState<string>('6');
  const [learningTextbook, setLearningTextbook] =
    useState<UserTextbookInfo | null>(null);
  const [answeringQuestionsList, setAnsweringQuestionsList] = useState<HomeworkQuestionDetail[] | null>(null);

  // 当 App 进入主界面挂载时，异步触发错题本与聊天历史的云端增量同步
  React.useEffect(() => {
    SyncService.syncMistakes();
    SyncService.syncChatHistory();
  }, []);

  const handleGoAnswer = (id: string, title: string, subject: string) => {
    setAnsweringHomeworkId(id);
    setAnsweringHomeworkTitle(title);
    setAnsweringHomeworkSubject(subject);
  };

  const handleGoAnswerQuestions = (list: HomeworkQuestionDetail[], title: string, subject: string) => {
    setAnsweringQuestionsList(list);
    setAnsweringHomeworkTitle(title);
    setAnsweringHomeworkSubject(subject);
  };

  const handleAskAI = async (questionContent: string) => {
    // 写入预填输入并跳到 AI 对话 Tab
    await storage.setItem(
      'CHAT_PREFILL',
      `老师，请问这道题该怎么做？\n\n【题目内容】：\n${questionContent}`
    );
    setAnsweringHomeworkId(null);
    setAnsweringQuestionsList(null);
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
        {answeringHomeworkId || answeringQuestionsList ? (
          <HomeworkAnswerScreen
            homeworkId={answeringHomeworkId || undefined}
            homeworkTitle={answeringHomeworkTitle}
            homeworkSubject={answeringHomeworkSubject}
            questionsList={answeringQuestionsList || undefined}
            isReviewMode={!!answeringQuestionsList}
            onBack={() => {
              setAnsweringHomeworkId(null);
              setAnsweringQuestionsList(null);
            }}
            onAskAI={handleAskAI}
          />
        ) : (
          <>
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
              <HomeworkScreen onLogout={onLogout} onGoAnswer={handleGoAnswer} />
            )}

            {activeTab === 'ai' && (
              <ChatScreen />
            )}

            {activeTab === 'question_bank' && (
              <QuestionBankScreen
                onLogout={onLogout}
                onAskAI={handleAskAI}
                onGoAnswer={handleGoAnswerQuestions}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileScreen onLogout={onLogout} />
            )}
          </>
        )}
      </View>

      {/* 底部 Tab 导航栏 - 仅在非答题状态下渲染 */}
      {!answeringHomeworkId && !answeringQuestionsList && (
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
            style={[
              styles.centerTabItem,
              activeTab === 'ai' && styles.activeCenterTabItem
            ]}
            activeOpacity={0.85}
            onPress={() => setActiveTab('ai')}
          >
            <View style={styles.centerTabInner}>
              <Text style={styles.centerTabIcon}>🤖</Text>
              <Text style={[
                styles.centerTabLabel,
                activeTab === 'ai' && { color: '#FFFFFF' }
              ]}>AI 对话</Text>
            </View>
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
      )}

      <GlobalAiAssistant
        hidden={
          activeTab === 'ai' ||
          !!answeringHomeworkId ||
          !!answeringQuestionsList
        }
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

  // 中央突出 Tab 样式
  centerTabItem: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20, // 向上拉出 TabBar
    marginHorizontal: 4,
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
  activeCenterTabItem: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  centerTabInner: {
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

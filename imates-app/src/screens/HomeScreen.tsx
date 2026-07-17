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
import { MicroClassScreen } from './MicroClassScreen';
import { HomeworkScreen } from './HomeworkScreen';
import { ChatScreen } from './ChatScreen';
import { HomeworkAnswerScreen } from './HomeworkAnswerScreen';
import { MistakeBookScreen } from './MistakeBookScreen';
import { ExerciseSolveScreen } from './ExerciseSolveScreen';
import { storage } from '@/services/storage';
import { SyncService } from '@/services/sync-service';

interface HomeScreenProps {
  onLogout: () => void;
  onNavigateToChat: () => void;
}

type TabType = 'microclass' | 'homework' | 'exercise_solve' | 'mistake' | 'ai';

const LightColors = {
  background: '#F8FAFC',
  primary: '#3B82F6',
  textSecondary: '#475569',
};

export function HomeScreen({ onLogout }: HomeScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [answeringHomeworkId, setAnsweringHomeworkId] = useState<string | null>(null);
  const [answeringHomeworkTitle, setAnsweringHomeworkTitle] = useState<string>('');
  const [answeringHomeworkSubject, setAnsweringHomeworkSubject] = useState<string>('6');

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

  const handleAskAI = async (questionContent: string) => {
    // 写入预填输入并跳到 AI 对话 Tab
    await storage.setItem(
      'CHAT_PREFILL',
      `老师，请问这道题该怎么做？\n\n【题目内容】：\n${questionContent}`
    );
    setAnsweringHomeworkId(null);
    setActiveTab('ai');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 主选项卡视口 */}
      <View style={styles.tabContentContainer}>
        {answeringHomeworkId ? (
          <HomeworkAnswerScreen
            homeworkId={answeringHomeworkId}
            homeworkTitle={answeringHomeworkTitle}
            homeworkSubject={answeringHomeworkSubject}
            onBack={() => setAnsweringHomeworkId(null)}
            onAskAI={handleAskAI}
          />
        ) : (
          <>
            {activeTab === 'microclass' && (
              <MicroClassScreen onLogout={onLogout} />
            )}

            {activeTab === 'homework' && (
              <HomeworkScreen onLogout={onLogout} onGoAnswer={handleGoAnswer} />
            )}

            {activeTab === 'exercise_solve' && (
              <ExerciseSolveScreen onLogout={onLogout} />
            )}

            {activeTab === 'ai' && (
              <ChatScreen />
            )}

            {activeTab === 'mistake' && (
              <MistakeBookScreen onLogout={onLogout} onAskAI={handleAskAI} />
            )}
          </>
        )}
      </View>

      {/* 底部 Tab 导航栏 - 仅在非答题状态下渲染 */}
      {!answeringHomeworkId && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'microclass' && styles.activeTabItem]}
            onPress={() => setActiveTab('microclass')}
          >
            <Text style={[styles.tabIcon, activeTab === 'microclass' && styles.activeTabIcon]}>🗺️</Text>
            <Text style={[styles.tabLabel, activeTab === 'microclass' && styles.activeTabLabel]}>知识图谱</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'homework' && styles.activeTabItem]}
            onPress={() => setActiveTab('homework')}
          >
            <Text style={[styles.tabIcon, activeTab === 'homework' && styles.activeTabIcon]}>📝</Text>
            <Text style={[styles.tabLabel, activeTab === 'homework' && styles.activeTabLabel]}>作业</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'exercise_solve' && styles.activeTabItem]}
            onPress={() => setActiveTab('exercise_solve')}
          >
            <Text style={[styles.tabIcon, activeTab === 'exercise_solve' && styles.activeTabIcon]}>✍️</Text>
            <Text style={[styles.tabLabel, activeTab === 'exercise_solve' && styles.activeTabLabel]}>自主刷题</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'mistake' && styles.activeTabItem]}
            onPress={() => setActiveTab('mistake')}
          >
            <Text style={[styles.tabIcon, activeTab === 'mistake' && styles.activeTabIcon]}>📚</Text>
            <Text style={[styles.tabLabel, activeTab === 'mistake' && styles.activeTabLabel]}>错题本</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'ai' && styles.activeTabItem]}
            onPress={() => setActiveTab('ai')}
          >
            <Text style={[styles.tabIcon, activeTab === 'ai' && styles.activeTabIcon]}>🤖</Text>
            <Text style={[styles.tabLabel, activeTab === 'ai' && styles.activeTabLabel]}>AI 对话</Text>
          </TouchableOpacity>
        </View>
      )}

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
});

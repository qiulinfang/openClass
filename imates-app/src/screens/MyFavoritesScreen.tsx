import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { AppScreenSafeArea } from '@/components/AppSafeArea';
import {
  AiChatSessionService,
} from '@/features/ai-chat';
import type { AiChatSession } from '@/features/ai-chat/types';
import { getUserId } from '@/services/auth-service';
import {
  ExerciseService,
  type ExerciseItem,
} from '@/services/exercise-service';
import {
  SUBJECT_ID_TO_NAME,
  type HomeworkQuestionDetail,
} from '@/services/homework-service';

type FavoriteTab = 'session' | 'exercise';

const formatDateTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const compactText = (value: string): string =>
  String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function MyFavoritesScreen() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] =
    useState<FavoriteTab>('session');
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFavorites = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const userId = (await getUserId()) || 'user';
      const [favoriteSessions, favoriteExercises] = await Promise.all([
        AiChatSessionService.loadFavoriteSessions(userId),
        ExerciseService.getExercises(),
      ]);
      setSessions(favoriteSessions);
      setExercises(
        [...favoriteExercises].sort(
          (first, second) => second.timestamp - first.timestamp
        )
      );
    } catch (error) {
      console.warn('[MyFavoritesScreen] 加载收藏失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
    }, [loadFavorites])
  );

  const openSession = (session: AiChatSession) => {
    navigation.navigate('Home', {
      activeTab: 'ai',
      chatLaunchTarget: {
        tab: 'chat',
        category: 'companion',
        sessionId: session.id,
      },
      chatLaunchId: Date.now(),
    });
  };

  const openExercise = (exercise: ExerciseItem) => {
    const questionsList: HomeworkQuestionDetail[] = exercises.map(
      (item) => ({
        id: item.id,
        bmNo: item.bmNo || item.id,
        questionId: item.bmNo || item.id,
        questionContent: item.content,
        questionAnswer: item.answer,
        questionAnalysis: item.analysis || '',
      })
    );
    navigation.navigate('PracticeReview', {
      questionsList,
      homeworkTitle: exercise.title,
      homeworkSubject: exercise.subject,
      initialIndex: Math.max(
        0,
        exercises.findIndex((item) => item.id === exercise.id)
      ),
    });
  };

  const emptyState = (tab: FavoriteTab) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyMark}>
        <View style={styles.emptyMarkLine} />
        <View style={styles.emptyMarkLineShort} />
      </View>
      <Text style={styles.emptyTitle}>
        {tab === 'session' ? '暂无会话收藏' : '暂无练习收藏'}
      </Text>
      <Text style={styles.emptyHint}>
        {tab === 'session'
          ? '在 AI 会话记录中收藏的会话将显示在这里'
          : '收藏的练习题目将显示在这里'}
      </Text>
    </View>
  );

  return (
    <AppScreenSafeArea style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="返回"
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>我的收藏</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View
        style={styles.tabs}
        accessibilityRole="tablist"
      >
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'session' && styles.tabActive,
          ]}
          onPress={() => setActiveTab('session')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'session' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'session' && styles.tabTextActive,
            ]}
          >
            会话收藏
          </Text>
          <View
            style={[
              styles.countBadge,
              activeTab === 'session' && styles.countBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.countText,
                activeTab === 'session' && styles.countTextActive,
              ]}
            >
              {sessions.length}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'exercise' && styles.tabActive,
          ]}
          onPress={() => setActiveTab('exercise')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'exercise' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'exercise' && styles.tabTextActive,
            ]}
          >
            练习收藏
          </Text>
          <View
            style={[
              styles.countBadge,
              activeTab === 'exercise' && styles.countBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.countText,
                activeTab === 'exercise' && styles.countTextActive,
              ]}
            >
              {exercises.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#564BD7" />
          <Text style={styles.loadingText}>正在加载收藏…</Text>
        </View>
      ) : activeTab === 'session' ? (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            sessions.length === 0 && styles.emptyList,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadFavorites(true)}
              tintColor="#564BD7"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openSession(item)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`打开收藏会话：${item.title}`}
            >
              <View style={[styles.cardMark, styles.sessionMark]}>
                <View style={styles.sessionDot} />
                <View style={styles.sessionLine} />
                <View style={styles.sessionLineShort} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title || '未命名会话'}
                </Text>
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {item.summary || '点击继续对话'}
                </Text>
                <View style={styles.metaRow}>
                  <Text
                    style={[styles.metaText, styles.metaTextInline]}
                  >
                    {item.messageCount} 条消息
                  </Text>
                  <View style={styles.metaDot} />
                  <Text
                    style={[styles.metaText, styles.metaTextInline]}
                  >
                    {formatDateTime(item.favoritedAt || item.updatedAt)}
                  </Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={emptyState('session')}
        />
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            exercises.length === 0 && styles.emptyList,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadFavorites(true)}
              tintColor="#564BD7"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openExercise(item)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`打开收藏练习：${item.title}`}
            >
              <View style={[styles.cardMark, styles.exerciseMark]}>
                <Text style={styles.exerciseMarkText}>练</Text>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.exerciseTitleRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title || '收藏练习'}
                  </Text>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectText}>
                      {SUBJECT_ID_TO_NAME[item.subject] ||
                        `学科 ${item.subject}`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {compactText(item.content) || '点击查看题目详情'}
                </Text>
                <Text style={styles.metaText}>
                  收藏于 {formatDateTime(item.timestamp)}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={emptyState('exercise')}
        />
      )}
    </AppScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5FC',
  },
  header: {
    height: 58,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EE',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1EFFF',
  },
  backIcon: {
    marginTop: -3,
    fontSize: 38,
    lineHeight: 40,
    color: '#4D43C9',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '900',
    color: '#1E2238',
  },
  headerSpacer: {
    width: 44,
  },
  tabs: {
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
    padding: 4,
    flexDirection: 'row',
    borderRadius: 18,
    backgroundColor: '#E9E8F5',
  },
  tab: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#3D347A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#71758A',
  },
  tabTextActive: {
    color: '#4D43C9',
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    marginLeft: 7,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9D8E7',
  },
  countBadgeActive: {
    backgroundColor: '#EEEAFE',
  },
  countText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#74788C',
  },
  countTextActive: {
    color: '#564BD7',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  emptyList: {
    flexGrow: 1,
  },
  card: {
    minHeight: 116,
    marginBottom: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E3E4ED',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#322B72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardMark: {
    width: 54,
    height: 54,
    marginRight: 13,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionMark: {
    paddingHorizontal: 13,
    alignItems: 'flex-start',
    backgroundColor: '#EEEAFE',
  },
  sessionDot: {
    width: 7,
    height: 7,
    marginBottom: 6,
    borderRadius: 4,
    backgroundColor: '#6256D9',
  },
  sessionLine: {
    width: '100%',
    height: 4,
    marginBottom: 5,
    borderRadius: 2,
    backgroundColor: '#8B83E5',
  },
  sessionLineShort: {
    width: '65%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#B7B1F0',
  },
  exerciseMark: {
    backgroundColor: '#FFF0C7',
  },
  exerciseMarkText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#B76700',
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: '#20243D',
  },
  cardDescription: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: '#62687D',
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: '#EEF2FF',
  },
  subjectText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaDot: {
    width: 3,
    height: 3,
    marginHorizontal: 7,
    borderRadius: 2,
    backgroundColor: '#B6BAC8',
  },
  metaText: {
    marginTop: 7,
    fontSize: 11,
    color: '#9296A8',
  },
  metaTextInline: {
    marginTop: 0,
  },
  chevron: {
    width: 28,
    marginLeft: 5,
    textAlign: 'center',
    fontSize: 28,
    color: '#A0A5B6',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#7A7F92',
  },
  emptyState: {
    flex: 1,
    minHeight: 320,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMark: {
    width: 66,
    height: 66,
    marginBottom: 18,
    paddingHorizontal: 17,
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#EDEBFB',
  },
  emptyMarkLine: {
    height: 5,
    marginBottom: 8,
    borderRadius: 3,
    backgroundColor: '#7E75DE',
  },
  emptyMarkLineShort: {
    width: '62%',
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ADA7EA',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#282C43',
  },
  emptyHint: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#85899C',
  },
});

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { MathRenderer } from '@/components/MathRenderer';
import { MistakeService, MistakeItem } from '@/services/mistake-service';
import { ExerciseService, ExerciseItem } from '@/services/exercise-service';
import { SUBJECT_ID_TO_NAME, HomeworkQuestionDetail } from '@/services/homework-service';
import { SyncService } from '@/services/sync-service';
import { useNavigation } from '@react-navigation/native';

interface MistakeBookScreenProps {
  onAskAI: (questionContent: string) => void;
  mode?: 'mistake' | 'exercise';
  searchQuery?: string;
}

const LightColors = {
  background: '#F8FAFC',
  cardBackground: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#3B82F6',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  selectedBg: 'rgba(59, 130, 246, 0.08)',
};

const SUBJECT_OPTIONS = [
  { label: '全部', value: '' },
  { label: '语文', value: '1' },
  { label: '数学', value: '2' },
  { label: '英语', value: '3' },
  { label: '物理', value: '4' },
  { label: '化学', value: '5' },
  { label: '生物', value: '6' },
  { label: '政治', value: '7' },
  { label: '历史', value: '8' },
  { label: '地理', value: '9' },
];

export function MistakeBookScreen({ onAskAI, mode, searchQuery = '' }: MistakeBookScreenProps) {
  const navigation = useNavigation<any>();
  const [activeMode, setActiveMode] = useState<'mistake' | 'exercise'>('mistake');

  useEffect(() => {
    if (mode) {
      setActiveMode(mode);
    }
  }, [mode]);
  
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [savedExerciseIds, setSavedExerciseIds] = useState<Record<string, boolean>>({});

  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedAnalyses, setExpandedAnalyses] = useState<Record<string, boolean>>({});

  // Subject Badge style mapping helper
  const getSubjectStyle = (subjId: string) => {
    if (subjId === '1') return { bg: '#EEF2FF', text: '#4F46E5' }; // Chinese (语文)
    if (subjId === '2') return { bg: '#E0F2FE', text: '#0284C7' }; // Math (数学)
    if (subjId === '3') return { bg: '#ECFDF5', text: '#059669' }; // English (英语)
    if (subjId === '4') return { bg: '#F5F3FF', text: '#7C3AED' }; // Physics (物理)
    if (subjId === '5') return { bg: '#FDF2F8', text: '#DB2777' }; // Chemistry (化学)
    if (subjId === '6') return { bg: '#FEF3C7', text: '#D97706' }; // Biology (生物)
    return { bg: '#F3F4F6', text: '#4B5563' };
  };

  // 动态提取当前错题/习题列表中存在的所有学科 ID
  const availableSubjectIds = useMemo(() => {
    const ids = new Set<string>();
    const list = activeMode === 'mistake' ? mistakes : exercises;
    list.forEach(q => {
      if (q.subject) {
        ids.add(q.subject);
      }
    });
    return Array.from(ids).sort();
  }, [mistakes, exercises, activeMode]);

  // 加载错题列表
  const loadMistakes = useCallback(async () => {
    try {
      const data = await MistakeService.getMistakes();
      setMistakes(data);
    } catch (e) {
      console.warn('[MistakeBookScreen] 获取错题失败:', e);
    }
  }, []);

  // 加载收藏习题列表
  const loadExercises = useCallback(async () => {
    try {
      const data = await ExerciseService.getExercises();
      setExercises(data);

      const idsMap: Record<string, boolean> = {};
      data.forEach(ex => {
        idsMap[ex.id] = true;
      });
      setSavedExerciseIds(idsMap);
    } catch (e) {
      console.warn('[MistakeBookScreen] 获取收藏习题失败:', e);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await SyncService.syncMistakes();
    await Promise.all([loadMistakes(), loadExercises()]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadMistakes();
    loadExercises();
    // 异步执行云端增量错题同步
    SyncService.syncMistakes().then(() => {
      loadMistakes();
    });
  }, [loadMistakes, loadExercises]);

  // 从错题本移除错题
  const handleRemoveMistake = async (id: string) => {
    try {
      await MistakeService.removeMistake(id);
      setMistakes(prev => prev.filter(m => m.id !== id && m.bmNo !== id));
      // 异步推送删除指令至云端
      SyncService.syncMistakes();
    } catch (e) {
      console.warn('[MistakeBookScreen] 移除错题失败:', e);
    }
  };

  // 取消收藏习题
  const handleRemoveExercise = async (id: string) => {
    try {
      await ExerciseService.toggleExercise({ id } as any);
      setExercises(prev => prev.filter(ex => ex.id !== id));
      setSavedExerciseIds(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      Alert.alert('提示', '已取消收藏该习题');
    } catch (e) {
      console.warn('[MistakeBookScreen] 移除习题失败:', e);
    }
  };

  // 将错题收藏为习题 / 取消收藏
  const handleToggleExercise = async (mistake: MistakeItem) => {
    try {
      const titleText = mistake.questionData.title || mistake.questionData.content || '错题习题';
      const saved = await ExerciseService.toggleExercise({
        id: mistake.bmNo,
        title: titleText.substring(0, 20).replace(/<[^>]+>/g, '').trim() + '...',
        subject: mistake.subject,
        content: mistake.questionData.content || mistake.questionData.title || '',
        answer: mistake.questionData.answer || '',
        analysis: mistake.questionData.analysis || '暂无解析',
      });
      
      setSavedExerciseIds(prev => ({
        ...prev,
        [mistake.bmNo]: saved
      }));

      // 重新加载习题列表以同步
      await loadExercises();
      Alert.alert('提示', saved ? '★ 成功加入我的习题本' : '☆ 已从我的习题本移除');
    } catch (e) {
      console.warn('[MistakeBookScreen] 收藏习题操作失败:', e);
    }
  };

  const toggleAnalysis = (id: string) => {
    setExpandedAnalyses(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 数据过滤
  const filteredMistakes = mistakes.filter(m => {
    const matchesSubject = !selectedSubject || m.subject === selectedSubject;
    const matchesSearch = !searchQuery || 
      (m.questionData?.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.questionData?.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  const filteredExercises = exercises.filter(ex => {
    const matchesSubject = !selectedSubject || ex.subject === selectedSubject;
    const matchesSearch = !searchQuery || 
      ex.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  // 渲染错题卡片
  const renderMistakeItem = ({ item }: { item: MistakeItem }) => {
    const isExpanded = !!expandedAnalyses[item.id];
    const isSavedAsExercise = !!savedExerciseIds[item.id];
    const subjectName = SUBJECT_ID_TO_NAME[item.subject] || '学科';
    const subStyle = getSubjectStyle(item.subject);

    // 适配嵌套结构的取值
    const homeworkName = item.practiceHistory?.[0]?.homeworkName || '课后作业';
    const questionText = item.questionData?.content || item.questionData?.title || '未命名错题';
    const userAnswerText = String(item.practiceHistory?.[0]?.originalAnswer || '未作答');
    const correctAnswerText = String(item.questionData?.answer || '暂无答案');
    const analysisText = item.questionData?.analysis || '暂无解析';

    return (
      <View style={styles.questionCard}>
        {/* 右上角精致小闪电背景角 */}
        <View style={styles.cardCornerBadge}>
          <Text style={styles.cardCornerBadgeText}>⚡</Text>
        </View>

        {/* 题干 LaTeX 渲染 */}
        <View style={styles.questionPreview} pointerEvents="none">
          <MathRenderer content={questionText} textColor="#4B5563" />
        </View>

        {/* 作答与标准答案对比 */}
        <View style={styles.answerCompareContainer}>
          <View style={styles.answerRow}>
            <Text style={styles.answerLabel}>❌ 您的解答：</Text>
            <Text style={styles.wrongAnswerText}>{userAnswerText}</Text>
          </View>
          <View style={styles.answerRow}>
            <Text style={styles.answerLabel}>✅ 正确答案：</Text>
            <Text style={styles.correctAnswerText}>{correctAnswerText}</Text>
          </View>
        </View>

        {/* 可折叠的解析 */}
        {isExpanded && (
          <View style={styles.analysisContainer}>
            <Text style={styles.analysisTitle}>💡 答案解析：</Text>
            <MathRenderer content={analysisText} textColor="#475569" />
          </View>
        )}

        {/* 卡片主底栏：左侧学科/来源，右侧开始答题 */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeftBadges}>
            <View style={[styles.subjectBadge, { backgroundColor: subStyle.bg }]}>
              <Text style={[styles.subjectBadgeText, { color: subStyle.text }]}>{subjectName}</Text>
            </View>
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText} numberOfLines={1}>📌 {homeworkName}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.goActionBtn}
            onPress={() => {
              const detail: HomeworkQuestionDetail = {
                id: item.bmNo,
                questionId: item.bmNo,
                questionContent: questionText,
                questionAnswer: correctAnswerText,
                questionAnalysis: analysisText,
              };
              navigation.navigate('PracticeReview', {
                questionsList: [detail],
                homeworkTitle: item.questionData?.title || '错题重练',
                homeworkSubject: item.subject,
              });
            }}
          >
            <Text style={styles.goActionText}>再次练习</Text>
            <Text style={styles.goActionArrow}>➔</Text>
          </TouchableOpacity>
        </View>

        {/* 快速辅助操作栏 */}
        <View style={styles.quickActionBar}>
          <TouchableOpacity onPress={() => toggleAnalysis(item.id)} style={styles.quickActionBtn}>
            <Text style={styles.quickActionText}>{isExpanded ? '收起解析 ▲' : '展开解析 ▼'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => onAskAI(`老师，我想针对这道作业错题发起讨论：\n\n${questionText}`)}
            style={styles.quickActionBtn}
          >
            <Text style={styles.quickActionText}>🤖 问学伴</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleToggleExercise(item)} style={styles.quickActionBtn}>
            <Text style={[styles.quickActionText, isSavedAsExercise && { color: '#F59E0B' }]}>
              {isSavedAsExercise ? '★ 已加入习题' : '☆ 收藏此题'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleRemoveMistake(item.id)} style={styles.quickActionBtn}>
            <Text style={[styles.quickActionText, { color: '#EF4444' }]}>🗑️ 移除</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // 渲染我的习题卡片
  const renderExerciseItem = ({ item }: { item: ExerciseItem }) => {
    const subjectName = SUBJECT_ID_TO_NAME[item.subject] || '学科';
    const subStyle = getSubjectStyle(item.subject);
    const isPreset = item.id.startsWith('preset');

    return (
      <View style={styles.questionCard}>
        {/* 右上角精致小闪电背景角 */}
        <View style={styles.cardCornerBadge}>
          <Text style={styles.cardCornerBadgeText}>⚡</Text>
        </View>

        {/* 题干 LaTeX 渲染 */}
        <View style={styles.questionPreview} pointerEvents="none">
          <MathRenderer content={item.content} textColor="#4B5563" />
        </View>

        {/* 答案与解析显示 */}
        {item.answer ? (
          <View style={styles.answerCompareContainer}>
            <View style={styles.answerRow}>
              <Text style={styles.answerLabel}>✅ 参考答案：</Text>
              <Text style={styles.correctAnswerText}>{item.answer}</Text>
            </View>
          </View>
        ) : null}

        {/* 卡片主底栏：左侧学科/来源，右侧开始答题 */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeftBadges}>
            <View style={[styles.subjectBadge, { backgroundColor: subStyle.bg }]}>
              <Text style={[styles.subjectBadgeText, { color: subStyle.text }]}>{subjectName}</Text>
            </View>
            <View style={[styles.sourceBadge, { backgroundColor: isPreset ? '#EFF6FF' : '#FEF3C7' }]}>
              <Text style={[styles.sourceBadgeText, { color: isPreset ? '#3B82F6' : '#D97706' }]}>
                {isPreset ? '💡 推荐' : '⭐ 收藏'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.goActionBtn}
            onPress={() => {
              const detail: HomeworkQuestionDetail = {
                id: item.id,
                bmNo: item.bmNo || item.id,
                questionId: item.bmNo || item.id,
                questionContent: item.content,
                questionAnswer: item.answer || '',
                questionAnalysis: item.analysis || '',
              };
              navigation.navigate('PracticeReview', {
                questionsList: [detail],
                homeworkTitle: item.title || '收藏练习',
                homeworkSubject: item.subject,
              });
            }}
          >
            <Text style={styles.goActionText}>开始作答</Text>
            <Text style={styles.goActionArrow}>➔</Text>
          </TouchableOpacity>
        </View>

        {/* 快速辅助操作栏 */}
        <View style={styles.quickActionBar}>
          <TouchableOpacity
            onPress={() => onAskAI(`老师，我想针对这道收藏的习题发起讨论，请为我讲解一下它的解题思路和知识点：\n\n${item.content}`)}
            style={styles.quickActionBtn}
          >
            <Text style={styles.quickActionText}>🤖 问学伴</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleRemoveExercise(item.id)} style={styles.quickActionBtn}>
            <Text style={[styles.quickActionText, { color: '#EF4444' }]}>💔 取消收藏</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>


      {/* 模块切换 Tab Segmented Control */}
      {!mode && (
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeMode === 'mistake' && styles.segmentBtnActive]}
            onPress={() => setActiveMode('mistake')}
          >
            <Text style={[styles.segmentText, activeMode === 'mistake' && styles.segmentTextActive]}>
              我的错题本 (📚)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeMode === 'exercise' && styles.segmentBtnActive]}
            onPress={() => setActiveMode('exercise')}
          >
            <Text style={[styles.segmentText, activeMode === 'exercise' && styles.segmentTextActive]}>
              我的习题本 (⭐)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.container}>
        {/* 筛选 Chip 徽章组 */}
        <View style={styles.filterChipsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollContent}>
            <TouchableOpacity
              style={[styles.filterChip, !selectedSubject && styles.activeFilterChip]}
              onPress={() => setSelectedSubject('')}
            >
              <Text style={[styles.filterChipText, !selectedSubject && styles.activeFilterChipText]}>全部学科</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.filterChip}>
              <Text style={styles.filterChipText}>本周</Text>
            </TouchableOpacity>

            {availableSubjectIds.map(id => {
              const label = SUBJECT_ID_TO_NAME[id] || `学科 ${id}`;
              const isActive = selectedSubject === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.filterChip, isActive && styles.activeFilterChip]}
                  onPress={() => setSelectedSubject(isActive ? '' : id)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.activeFilterChipText]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.filterBtn}>
            <Text style={styles.filterBtnText}>▼ 筛选</Text>
          </TouchableOpacity>
        </View>

        {/* 错题列表 vs 习题列表 */}
        <FlatList
          data={
            (activeMode === 'mistake'
              ? filteredMistakes
              : filteredExercises) as Array<MistakeItem | ExerciseItem>
          }
          renderItem={({ item }) =>
            activeMode === 'mistake'
              ? renderMistakeItem({ item: item as MistakeItem })
              : renderExerciseItem({ item: item as ExerciseItem })
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeMode === 'mistake'
                  ? mistakes.length === 0
                    ? '暂无收藏的错题，做错的作业会自动加入哦 🌟'
                    : '该学科下暂无错题 💡'
                  : exercises.length === 0
                    ? '暂无收藏的习题。可以在答题页或错题本上点击“收藏此题”加入这里 🌟'
                    : '该学科下暂无收藏习题 💡'}
              </Text>
            </View>
          }
        />
      </View>
    </View>
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: LightColors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentBtnActive: {
    borderBottomColor: LightColors.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: LightColors.textSecondary,
  },
  segmentTextActive: {
    color: LightColors.primary,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: '#f1f3ff', // Web content background
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipsScrollContent: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  activeFilterChip: {
    backgroundColor: '#EEF2FF',
  },
  filterChipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterBtnText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  questionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardCornerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 24,
    height: 24,
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCornerBadgeText: {
    fontSize: 10,
    color: '#D97706',
  },
  questionPreview: {
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
    paddingTop: 12,
    paddingBottom: 10,
  },
  footerLeftBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 12,
  },
  subjectBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subjectBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sourceBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 150,
  },
  sourceBadgeText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
  },
  goActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goActionText: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '600',
  },
  goActionArrow: {
    fontSize: 8,
    color: '#4F46E5',
  },
  quickActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
    paddingTop: 10,
    gap: 8,
  },
  quickActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  quickActionText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  analysisToggleBtn: {
    paddingVertical: 6,
  },
  analysisToggleText: {
    fontSize: 11,
    color: LightColors.textSecondary,
    fontWeight: '600',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  favBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: '#F59E0B',
  },
  favBtnText: {
    fontSize: 11,
    color: LightColors.textSecondary,
    fontWeight: '600',
  },
  favBtnTextActive: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  aiBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  aiBtnText: {
    fontSize: 11,
    color: LightColors.primary,
    fontWeight: '700',
  },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  removeBtnText: {
    fontSize: 11,
    color: LightColors.error,
    fontWeight: '700',
  },
  discussBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: LightColors.primary,
  },
  discussBtnText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  practiceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
  },
  practiceBtnText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  answerCompareContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  answerLabel: {
    fontSize: 12,
    color: LightColors.textSecondary,
    fontWeight: '600',
  },
  wrongAnswerText: {
    fontSize: 12,
    color: LightColors.error,
    fontWeight: '700',
  },
  correctAnswerText: {
    fontSize: 12,
    color: LightColors.success,
    fontWeight: '700',
  },
  analysisContainer: {
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
    paddingTop: 12,
    marginBottom: 14,
  },
  analysisTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: LightColors.textPrimary,
    marginBottom: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 12,
    color: LightColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { MathRenderer } from '@/components/MathRenderer';
import { ExerciseService, ExerciseItem } from '@/services/exercise-service';
import { SUBJECT_ID_TO_NAME, HomeworkQuestionDetail } from '@/services/homework-service';
import { useNavigation } from '@react-navigation/native';

interface ExerciseSolveScreenProps {
  onAskAI?: (questionContent: string) => void;
  searchQuery?: string;
}

const LightColors = {
  background: '#f1f3ff', // Web content background
  cardBackground: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  primary: '#4F46E5', // Indigo-600
  primaryLight: '#EEF2FF',
  success: '#10B981',
};

export function ExerciseSolveScreen({ onAskAI, searchQuery = '' }: ExerciseSolveScreenProps) {
  const navigation = useNavigation<any>();
  // 习题数据
  const [localExercises, setLocalExercises] = useState<ExerciseItem[]>([]);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');

  // 加载本地收藏习题
  const loadLocalExercises = useCallback(async () => {
    try {
      const data = await ExerciseService.getExercises();
      setLocalExercises(data);
      console.log(`[ExerciseSolveScreen] 📥 自选习题库加载成功！共载入本地收藏习题数: ${data.length}`);
    } catch (e) {
      console.warn('[ExerciseSolveScreen] 获取收藏习题失败:', e);
    }
  }, []);

  useEffect(() => {
    loadLocalExercises();
  }, [loadLocalExercises]);

  // 全部习题来自于 ExerciseService.getExercises()
  const allQuestions = localExercises;

  // 动态提取当前习题列表中存在的所有学科 ID
  const availableSubjectIds = useMemo(() => {
    const ids = new Set<string>();
    allQuestions.forEach(q => {
      if (q.subject) {
        ids.add(q.subject);
      }
    });
    return Array.from(ids).sort();
  }, [allQuestions]);

  // 搜索和学科筛选过滤
  const filteredQuestions = allQuestions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          q.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = !selectedSubjectFilter || q.subject === selectedSubjectFilter;
    return matchesSearch && matchesSubject;
  });

  const handleSelectQuestion = (q: ExerciseItem) => {
    const list: HomeworkQuestionDetail[] = filteredQuestions.map(item => ({
      id: item.id,
      bmNo: item.bmNo || item.id,
      questionId: item.bmNo || item.id,
      questionContent: item.content,
      questionAnswer: item.answer,
      questionAnalysis: item.analysis || '',
    }));
    
    const clickedIndex = filteredQuestions.findIndex(item => item.id === q.id);

    navigation.navigate('PracticeReview', {
      questionsList: list,
      homeworkTitle: q.title,
      homeworkSubject: q.subject,
      initialIndex: clickedIndex >= 0 ? clickedIndex : 0,
    });
  };

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

  return (
    <View style={styles.container}>
      {/* 筛选 Chip 徽章组 */}
      <View style={styles.filterChipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollContent}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedSubjectFilter && styles.activeFilterChip]}
            onPress={() => setSelectedSubjectFilter('')}
          >
            <Text style={[styles.filterChipText, !selectedSubjectFilter && styles.activeFilterChipText]}>全部学科</Text>
          </TouchableOpacity>

          {/* 动态渲染有习题数据的学科筛选 */}
          {availableSubjectIds.map(id => {
            const label = SUBJECT_ID_TO_NAME[id] || `学科 ${id}`;
            const isActive = selectedSubjectFilter === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.filterChip, isActive && styles.activeFilterChip]}
                onPress={() => setSelectedSubjectFilter(isActive ? '' : id)}
              >
                <Text style={[styles.filterChipText, isActive && styles.activeFilterChipText]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredQuestions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={11}
        removeClippedSubviews={false}
        updateCellsBatchingPeriod={100}
        renderItem={({ item, index }) => {
          const subjectName = SUBJECT_ID_TO_NAME[item.subject] || '学科';
          const subStyle = getSubjectStyle(item.subject);

          return (
            <TouchableOpacity onPress={() => handleSelectQuestion(item)} activeOpacity={0.85}>
              <View style={styles.questionCard}>
                {/* 题目卡片头部：题目序号与右上角闪电标记 */}
                <View style={styles.cardHeader}>
                  <Text style={styles.questionIndexText}>题目 {index + 1}</Text>
                  <View style={styles.cardCornerBadge}>
                    <Text style={styles.cardCornerBadgeText}>⚡</Text>
                  </View>
                </View>

                {/* 题目内容 LaTeX 渲染区 (固定最大高度，溢出隐藏) */}
                <View style={styles.questionPreview} pointerEvents="none">
                  <MathRenderer content={item.content} textColor="#334155" />
                </View>

                {/* 跳转行动及学科、来源标签 */}
                <View style={styles.cardFooter}>
                  <View style={styles.footerLeftBadges}>
                    <View style={[styles.subjectBadge, { backgroundColor: subStyle.bg }]}>
                      <Text style={[styles.subjectBadgeText, { color: subStyle.text }]}>{subjectName}</Text>
                    </View>
                    <View style={[styles.sourceBadge, { backgroundColor: item.id.startsWith('preset') ? '#EFF6FF' : '#FEF3C7' }]}>
                      <Text style={[styles.sourceBadgeText, { color: item.id.startsWith('preset') ? '#3B82F6' : '#D97706' }]}>
                        {item.id.startsWith('preset') ? '💡 推荐' : '⭐ 收藏'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.goActionBtn}>
                    <Text style={styles.goActionText}>去答题</Text>
                    <Text style={styles.goActionArrow}>➔</Text>
                  </View>
                </View>
              </View>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f3ff', // Soft background matching Web
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipsScrollContent: {
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 6,
  },
  activeFilterChip: {
    borderColor: '#4F46E5',
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  questionCard: {
    height: 180,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardCornerBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCornerBadgeText: {
    fontSize: 10,
    color: '#4F46E5',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  questionIndexText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
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
  footerLeftBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  questionPreview: {
    flex: 1,
    maxHeight: 84,
    overflow: 'hidden',
    justifyContent: 'flex-start',
    marginTop: 2,
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 10,
  },
  progressArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarBg: {
    width: 90,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  progressFraction: {
    fontSize: 12,
    color: '#9CA3AF',
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
  emptyBox: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});

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
import { ExerciseComponentRouter } from '@/components/exercise/ExerciseComponentRouter';
import { normalizeQuestion, normalizeSubject } from '@/utils/exercise-parser';
import { SyncService } from '@/services/sync-service';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMistakes } from '@/hooks/useMistakes';
import { useExercises } from '@/hooks/useExercises';

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

const ALL_SUBJECT_OPTIONS = [
  '全部学科',
  '数学',
  '语文',
  '英语',
  '物理',
  '化学',
  '生物',
  '地理',
  '历史',
  '政治',
];

const ALL_SOURCE_OPTIONS = [
  '全部来源',
  '随堂练习',
  '课后作业',
];

export function MistakeBookScreen({ onAskAI, mode, searchQuery = '' }: MistakeBookScreenProps) {
  const navigation = useNavigation<any>();
  const [activeMode, setActiveMode] = useState<'mistake' | 'exercise'>('mistake');

  useEffect(() => {
    if (mode) {
      setActiveMode(mode);
    }
  }, [mode]);

  // 消费独立解耦的领域的 Custom Hooks
  const {
    mistakes,
    isRefreshing: isMistakesRefreshing,
    removeMistake: handleRemoveMistake,
    loadMistakes,
    refreshMistakes,
  } = useMistakes({ active: activeMode === 'mistake', searchQuery });

  const {
    exercises,
    savedExerciseIds,
    isRefreshing: isExercisesRefreshing,
    toggleExercise,
    loadExercises,
    refreshExercises,
  } = useExercises({ active: activeMode === 'exercise' });

  const isRefreshing = activeMode === 'exercise' ? isExercisesRefreshing : isMistakesRefreshing;

  const [selectedSubject, setSelectedSubject] = useState<string>('全部学科');
  const [selectedSource, setSelectedSource] = useState<string>('全部来源');
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

  const handleRefresh = async () => {
    if (activeMode === 'exercise') {
      await refreshExercises();
    } else {
      await refreshMistakes();
    }
  };

  // 每次页面获得焦点 (Focus) 或切回时，重新载入当前模式下的数据
  useFocusEffect(
    useCallback(() => {
      if (activeMode === 'exercise') {
        loadExercises();
      } else {
        loadMistakes();
      }
    }, [loadMistakes, loadExercises, activeMode])
  );

  // 取消收藏习题
  const handleRemoveExercise = async (id: string) => {
    try {
      await toggleExercise({ id } as any);
      Alert.alert('提示', '已取消收藏该习题');
    } catch (e) {
      console.warn('[MistakeBookScreen] 移除习题失败:', e);
    }
  };

  // 将错题收藏为习题 / 取消收藏
  const handleToggleExercise = async (mistake: MistakeItem) => {
    try {
      const titleText = mistake.questionData.title || mistake.questionData.content || '错题习题';
      const saved = await toggleExercise({
        id: mistake.bmNo,
        title: titleText.substring(0, 20).replace(/<[^>]+>/g, '').trim() + '...',
        subject: mistake.subject,
        content: mistake.questionData.content || mistake.questionData.title || '',
        answer: mistake.questionData.answer || '',
        analysis: mistake.questionData.analysis || '暂无解析',
      });

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

  const filteredMistakes = useMemo(() => {
    return mistakes.filter((m) => {
      // 1. 学科过滤 (与 imates-web 保持一致: 使用 normalizeSubject)
      if (selectedSubject && selectedSubject !== '全部学科') {
        const itemSubject = normalizeSubject(m.subject || m.questionData?.subject);
        const filterSubject = normalizeSubject(selectedSubject);
        if (itemSubject !== filterSubject) return false;
      }

      // 2. 来源过滤 (与 imates-web 保持一致: hasHomework)
      if (selectedSource && selectedSource !== '全部来源') {
        const hasHomework = (m.practiceHistory || []).some((h) => !!h.homeworkId);
        if (selectedSource === '随堂练习' && hasHomework) return false;
        if (selectedSource === '课后作业' && !hasHomework) return false;
      }

      // 3. 关键词搜索
      if (searchQuery && searchQuery.trim()) {
        const qContent = (
          m.questionData?.content ||
          m.questionData?.title ||
          (m.questionData as any)?.question ||
          ''
        ).toLowerCase();
        if (!qContent.includes(searchQuery.toLowerCase().trim())) return false;
      }

      return true;
    });
  }, [mistakes, selectedSubject, selectedSource, searchQuery]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      if (selectedSubject && selectedSubject !== '全部学科') {
        const itemSubject = normalizeSubject(ex.subject);
        const filterSubject = normalizeSubject(selectedSubject);
        if (itemSubject !== filterSubject) return false;
      }
      if (searchQuery && searchQuery.trim()) {
        const qContent = (ex.content || ex.title || '').toLowerCase();
        if (!qContent.includes(searchQuery.toLowerCase().trim())) return false;
      }
      return true;
    });
  }, [exercises, selectedSubject, searchQuery]);

  // 渲染错题卡片 (Header=题目信息, Body=原生题目组件+学生作答内容+答案解析)
  const renderMistakeItem = ({ item }: { item: MistakeItem }) => {
    const isExpanded = !!expandedAnalyses[item.id];
    const subjectName = SUBJECT_ID_TO_NAME[item.subject] || '学科';
    const subStyle = getSubjectStyle(item.subject);

    const homeworkName = item.practiceHistory?.[0]?.homeworkName || '课后作业';
    const rawData = item.questionData || item;
    const questionObj = normalizeQuestion(rawData);

    // 全量提取学生历史作答 (兼容复合题/填空题/主观题的手写照片与子题图片字典)
    const rawOriginalAns = item.practiceHistory?.[0]?.originalAnswer;
    let studentTextValue = '';
    let studentImageValue = '';
    let answersImageMap: Record<string, string> = {};
    let answersValueMap: Record<string, any> = {};

    if (rawOriginalAns && typeof rawOriginalAns === 'object') {
      const objAns = rawOriginalAns as any;
      if (typeof objAns.studentAnswer === 'string') {
        studentTextValue = objAns.studentAnswer;
      } else if (typeof objAns.studentAnswer === 'object' && objAns.studentAnswer !== null) {
        answersValueMap = objAns.studentAnswer;
      }

      if (typeof objAns.studentImage === 'string' && objAns.studentImage) {
        studentImageValue = objAns.studentImage;
      }

      if (objAns.answersImageMap && typeof objAns.answersImageMap === 'object') {
        answersImageMap = { ...answersImageMap, ...objAns.answersImageMap };
      }
      if (objAns.answersImage && typeof objAns.answersImage === 'object') {
        answersImageMap = { ...answersImageMap, ...objAns.answersImage };
      }
      if (objAns.answersMap && typeof objAns.answersMap === 'object') {
        answersValueMap = { ...answersValueMap, ...objAns.answersMap };
      }
      if (objAns.answers && typeof objAns.answers === 'object') {
        answersValueMap = { ...answersValueMap, ...objAns.answers };
      }
    } else if (typeof rawOriginalAns === 'string') {
      if (
        rawOriginalAns.startsWith('http://') ||
        rawOriginalAns.startsWith('https://') ||
        rawOriginalAns.startsWith('file:') ||
        rawOriginalAns.startsWith('data:image') ||
        rawOriginalAns.startsWith('blob:')
      ) {
        studentImageValue = rawOriginalAns;
      } else {
        studentTextValue = rawOriginalAns;
      }
    }

    // 兜底提取：若题目原数据自带作答图片 (studentAnswerImage / rearrange_students_answer / answerData)
    const qAny = rawData as any;
    if (!studentImageValue) {
      if (typeof qAny.studentAnswerImage === 'string' && qAny.studentAnswerImage) {
        studentImageValue = qAny.studentAnswerImage;
      } else if (typeof qAny.rearrange_students_answer === 'string' && qAny.rearrange_students_answer) {
        studentImageValue = qAny.rearrange_students_answer;
      } else if (typeof qAny.student_answer_image === 'string' && qAny.student_answer_image) {
        studentImageValue = qAny.student_answer_image;
      } else if (Array.isArray(qAny.answerData) && qAny.answerData.length > 0) {
        studentImageValue = qAny.answerData[0];
      }
    }

    // 将父级题目 ID 与图片填入图片字典
    const qIdKey = String(questionObj?.id || questionObj?.questionId || questionObj?.bmNo || item.id || item.bmNo || '');
    if (qIdKey && studentImageValue) {
      answersImageMap[qIdKey] = studentImageValue;
    }

    // 复合题子题图片提取填入 answersImageMap
    if (Array.isArray(questionObj.subQuestions)) {
      questionObj.subQuestions.forEach((sub: any, idx: number) => {
        const subImg =
          sub.studentAnswerImage ||
          sub.rearrange_students_answer ||
          sub.student_answer_image ||
          (Array.isArray(sub.answerData) && sub.answerData[0]) ||
          '';

        if (subImg) {
          const subKeys = [
            sub.id,
            sub.questionId,
            sub.bmNo,
            String(idx),
            `${qIdKey}_${sub.id}`,
            `${qIdKey}_${idx}`,
          ].filter(Boolean);

          subKeys.forEach((k) => {
            if (!answersImageMap[k]) answersImageMap[k] = subImg;
          });
        }
      });
    }

    const routerValue = Object.keys(answersValueMap).length > 0 ? answersValueMap : (studentTextValue || studentImageValue);

    return (
      <View style={styles.webQuestionCard}>
        {/* 1. Header: 展示题目信息 (学科 Badge + 来源信息 + 题目 ID) */}
        <View style={styles.webCardHeader}>
          <View style={styles.sourceTagWrapper}>
            <View style={[styles.subjectBadge, { backgroundColor: subStyle.bg }]}>
              <Text style={[styles.subjectBadgeText, { color: subStyle.text }]}>{subjectName}</Text>
            </View>
            <View style={styles.sourceTagChip}>
              <Text style={styles.sourceTagText} numberOfLines={1}>
                {item.practiceHistory?.[0]?.homeworkId ? `来源于 ${homeworkName}` : '来源于独立练习'}
              </Text>
            </View>
          </View>
          <Text style={styles.questionIdText}>ID: {item.bmNo || item.id}</Text>
        </View>

        {/* 2. Body (中间): 原生题目组件渲染 (单选/多选/判断/填空/主观/复合大题 1:1 动态感知与渲染) */}
        <View style={styles.webCardBody}>
          <ExerciseComponentRouter
            question={questionObj}
            value={routerValue}
            textValue={studentTextValue}
            imageValue={studentImageValue}
            answersImage={answersImageMap}
            showTitle={true}
            showId={false}
            showAnalysis={isExpanded}
            disabled={true}
          />
        </View>

        {/* 3. 中间细分隔线 */}
        <View style={styles.webSectionDivider} />

        {/* 4. Footer (底部): 答案与解析折叠切换按钮 */}
        <View style={styles.webCardFooter}>
          <TouchableOpacity
            style={styles.tabItemAction}
            onPress={() => toggleAnalysis(item.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabItemText, isExpanded && styles.tabItemTextActive]}>
              {isExpanded ? '收起答案与解析 ▲' : '查看答案与解析 ▼'}
            </Text>
            {isExpanded && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // 渲染我的习题卡片 ( Header=题目信息, Body=原生题目组件, Footer=答案与解析折叠控件 )
  const renderExerciseItem = ({ item }: { item: ExerciseItem }) => {
    const isExpanded = !!expandedAnalyses[item.id];
    const subjectName = SUBJECT_ID_TO_NAME[item.subject] || '学科';
    const subStyle = getSubjectStyle(item.subject);

    const exerciseObj = normalizeQuestion(item);

    return (
      <View style={styles.webQuestionCard}>
        {/* 1. Header: 展示题目信息 */}
        <View style={styles.webCardHeader}>
          <View style={styles.sourceTagWrapper}>
            <View style={[styles.subjectBadge, { backgroundColor: subStyle.bg }]}>
              <Text style={[styles.subjectBadgeText, { color: subStyle.text }]}>{subjectName}</Text>
            </View>
            <View style={styles.sourceTagChip}>
              <Text style={styles.sourceTagText} numberOfLines={1}>自选习题本</Text>
            </View>
          </View>
          <Text style={styles.questionIdText}>ID: {item.bmNo || item.id}</Text>
        </View>

        {/* 2. Body (中间): 原生题目组件渲染 */}
        <View style={styles.webCardBody}>
          <ExerciseComponentRouter
            question={exerciseObj}
            showTitle={true}
            showId={false}
            showAnalysis={isExpanded}
            disabled={true}
          />
        </View>

        {/* 3. 中间细分隔线 */}
        <View style={styles.webSectionDivider} />

        {/* 4. Footer (底部): 答案与解析折叠切换按钮 */}
        <View style={styles.webCardFooter}>
          <TouchableOpacity
            style={styles.tabItemAction}
            onPress={() => toggleAnalysis(item.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabItemText, isExpanded && styles.tabItemTextActive]}>
              {isExpanded ? '收起答案与解析 ▲' : '查看答案与解析 ▼'}
            </Text>
            {isExpanded && <View style={styles.tabIndicator} />}
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
              我的错题本
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
        {/* 筛选区域：学科筛选 + 来源筛选（去除本周和下拉按钮，与 imates-web 保持统一） */}
        <View style={styles.filterSectionContainer}>
          {/* 学科筛选 */}
          <View style={styles.filterRow}>
            <Text style={styles.filterRowLabel}>学科：</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={styles.chipsScrollContent}
            >
              {ALL_SUBJECT_OPTIONS.map((subj) => {
                const isActive = (selectedSubject || '全部学科') === subj;
                return (
                  <TouchableOpacity
                    key={subj}
                    style={[styles.filterChip, isActive && styles.activeFilterChip]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedSubject(subj)}
                  >
                    <Text
                      style={[styles.filterChipText, isActive && styles.activeFilterChipText]}
                      numberOfLines={1}
                    >
                      {subj}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 来源筛选 (仅错题模式生效) */}
          {activeMode === 'mistake' && (
            <View style={[styles.filterRow, { marginTop: 6 }]}>
              <Text style={styles.filterRowLabel}>来源：</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={styles.chipsScrollContent}
              >
                {ALL_SOURCE_OPTIONS.map((src) => {
                  const isActive = (selectedSource || '全部来源') === src;
                  return (
                    <TouchableOpacity
                      key={src}
                      style={[styles.filterChip, isActive && styles.activeSourceFilterChip]}
                      activeOpacity={0.8}
                      onPress={() => setSelectedSource(src)}
                    >
                      <Text
                        style={[styles.filterChipText, isActive && styles.activeSourceFilterChipText]}
                        numberOfLines={1}
                      >
                        {src}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
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
                    ? '暂无收藏的错题，做错的作业会自动加入哦'
                    : '该学科下暂无错题'
                  : exercises.length === 0
                    ? '暂无收藏的习题。可以在答题页或错题本上点击“收藏此题”加入这里'
                    : '该学科下暂无收藏习题'}
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
  filterSectionContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterRowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 6,
  },
  chipsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  activeFilterChip: {
    backgroundColor: '#EEF2FF',
  },
  activeSourceFilterChip: {
    backgroundColor: '#F0FDF4',
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
  activeSourceFilterChipText: {
    color: '#16A34A',
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
  // 1:1 imates-web MistakeBookView 卡片样式
  webQuestionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  webCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sourceTagWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 10,
  },
  sourceTagChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 160,
  },
  sourceTagText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  questionIdText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtnGhost: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  headerBtnGhostText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  headerBtnPrimary: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#4F46E5',
  },
  headerBtnPrimaryText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerBtnSaved: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  headerBtnSavedText: {
    color: '#D97706',
  },
  webCardBody: {
    marginBottom: 12,
  },
  webSectionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  webCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  tabItemAction: {
    position: 'relative',
    paddingVertical: 6,
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabItemTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#4F46E5',
    borderRadius: 1,
  },
  footerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  footerActionText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
  },
  primaryPracticeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
  },
  primaryPracticeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  expandedAnswerSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  standardAnswerSection: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  analysisSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
});

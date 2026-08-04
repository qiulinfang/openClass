import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { CalendarModal } from '@/components/CalendarModal';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { storage } from '@/services/storage';
import {
  HomeworkService,
  HomeworkUndoItem,
  SUBJECT_ID_TO_NAME,
  getHomeworkStatusText,
} from '@/services/homework-service';
import { useHomeworkStore, homeworkStore } from '@/stores/homework-store';

const LightColors = {
  background: '#f1f3ff', // Web content background
  cardBackground: '#FFFFFF',
  cardBorder: '#E2E8F0',
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  textMuted: '#696675',
  primary: '#4F46E5', // Indigo color matching design tokens
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

// 全量统一学科选项
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

const SUBJECT_NAME_TO_ID: Record<string, string> = {
  '语文': '1',
  '数学': '2',
  '英语': '3',
  '物理': '4',
  '化学': '5',
  '生物': '6',
  '政治': '7',
  '历史': '8',
  '地理': '9',
};

export function HomeworkScreen() {
  const navigation = useNavigation<any>();
  const store = useHomeworkStore();
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  // 筛选条件状态 (日期默认为今天，学科默认为全部学科)
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().slice(0, 10));
  const [selectedSubject, setSelectedSubject] = useState<string>('全部学科');

  // 悬浮日历组件显隐状态
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // 防抖定时器 (300ms，100% 对标 imates-web MyHomeworkView.vue watch 防抖)
  const debounceTimerRef = React.useRef<any>(null);

  const loadHomeworkList = useCallback(async () => {
    const subjectId = selectedSubject && selectedSubject !== '全部学科' ? SUBJECT_NAME_TO_ID[selectedSubject] : undefined;
    await homeworkStore.fetchHomeworkList({
      pageNumber: 1,
      pageSize: 50,
      subject: subjectId,
      date: selectedDate || undefined,
    });
  }, [selectedDate, selectedSubject]);

  // 100% 对标 imates-web：监听筛选条件变化，添加 300ms 防抖
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      loadHomeworkList();
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [loadHomeworkList]);

  // 监听页面获得焦点 (包含从答题页返回) 自动刷新
  useFocusEffect(
    useCallback(() => {
      loadHomeworkList();
    }, [loadHomeworkList])
  );

  // 100% 对标 imates-web goAnswer: 并行前置预加载题目详情与判罚明细后再跳转
  const goAnswer = async (item: HomeworkUndoItem) => {
    setLoadingItemId(item.id);
    try {
      const [questionDetails, judgeDetailRes] = await Promise.all([
        HomeworkService.getHomeworkDetailList(item.id).catch(() => null),
        HomeworkService.getHomeworkSubmitJudgeDetail(item.id).catch(() => null),
      ]);

      // 验证云端返回的判罚数据是否真正包含数据且未提示 "未提交"
      const judgeMsg = String((judgeDetailRes as any)?.message || (judgeDetailRes as any)?.msg || '');
      const hasValidJudgeData = judgeDetailRes && judgeDetailRes.data && !judgeMsg.includes('未提交') && !judgeMsg.includes('尚未提交');

      // 本地当前账号专属提交状态
      const localSubmitted = await storage.getUserItem(`HOMEWORK_SUBMITTED_${item.id}`);
      const isSubmittedReal = Boolean(hasValidJudgeData || localSubmitted === 'true');

      navigation.navigate('HomeworkSolve', {
        homeworkId: item.id,
        homeworkTitle: item.title,
        homeworkSubject: item.subject,
        isSubmitted: isSubmittedReal,
        preloadedQuestions: questionDetails,
        preloadedJudgeDetail: hasValidJudgeData ? judgeDetailRes : null,
      });
    } catch (e) {
      const localSubmitted = await storage.getUserItem(`HOMEWORK_SUBMITTED_${item.id}`);
      navigation.navigate('HomeworkSolve', {
        homeworkId: item.id,
        homeworkTitle: item.title,
        homeworkSubject: item.subject,
        isSubmitted: localSubmitted === 'true',
      });
    } finally {
      setLoadingItemId(null);
    }
  };

  // 生成顶部日期显示文本
  const getDateDisplay = () => {
    if (!selectedDate) return '全部日期';
    const todayStr = new Date().toISOString().slice(0, 10);
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const formatted = selectedDate.replace(/-/g, '/');
    if (selectedDate === todayStr) return `${formatted} (今天)`;
    if (selectedDate === yesterdayStr) return `${formatted} (昨天)`;
    if (selectedDate === tomorrowStr) return `${formatted} (明天)`;
    return formatted;
  };

  // 100% 对标 imates-web displayHomeworkList 计算派生属性逻辑
  const renderHomeworkItem = ({ item }: { item: HomeworkUndoItem }) => {
    const subjectName = SUBJECT_ID_TO_NAME[item.subject] || item.subject;
    const isSubmittedLocally = Boolean(store.localSubmittedMap[item.id]);
    
    const statusText = isSubmittedLocally ? '已提交' : getHomeworkStatusText(item.status, item.deadline);

    const deadlineMs = item.deadline ? new Date(item.deadline).getTime() : NaN;
    const isExpired = Number.isFinite(deadlineMs) ? deadlineMs <= Date.now() : false;
    const isCompleted = isExpired && item.lateSubmit !== '1';

    const scoreText = item.totalScore ? `总分：${item.totalScore}分` : '总分：--';
    
    // 计算剩余时间
    const timeLeftText = (() => {
      if (isSubmittedLocally) return '';
      if (!item.deadline) return '';
      const dlMs = new Date(item.deadline).getTime();
      if (!Number.isFinite(dlMs)) return '';
      const diff = dlMs - Date.now();
      if (diff <= 0) return '已截止';
      const totalMinutes = Math.floor(diff / 60000);
      const days = Math.floor(totalMinutes / (60 * 24));
      const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
      const minutes = totalMinutes % 60;
      const parts: string[] = [];
      if (days > 0) parts.push(`${days}天`);
      if (hours > 0) parts.push(`${hours}小时`);
      if (parts.length === 0) parts.push(`${Math.max(1, minutes)}分钟`);
      return `还剩${parts.join('')}截止`;
    })();

    // Status tag color (对标 imates-web statusTagType: green | purple | gray)
    const statusTagType = (() => {
      if (isSubmittedLocally) return 'success';
      if (isExpired && item.lateSubmit !== '1') return 'gray';
      return 'warning';
    })();

    const dotColor = (() => {
      if (statusTagType === 'success') return LightColors.success;
      if (statusTagType === 'warning') return LightColors.warning;
      return LightColors.textMuted;
    })();

    // Button label and style (已截止作业也允许点击【去查看】进入阅读与复习)
    const buttonText = isSubmittedLocally ? '去查看' : isExpired && item.lateSubmit !== '1' ? '去查看' : '去作答';
    const isButtonDisabled = false;
    const isPreloadingThisItem = loadingItemId === item.id;
    
    const tags = [subjectName];
    if (item.fullSubmit === '1') tags.push('一次性提交');
    if (item.lateSubmit === '1') tags.push('允许补交');
    if (item.resubmit === '1') tags.push('允许重交');

    return (
      <View style={styles.contentCard}>
        {/* Left and Right Split Row */}
        <View style={styles.cardContent}>
          {/* Card Left */}
          <View style={styles.cardLeft}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>

            {/* Tags Row */}
            <View style={styles.cardTags}>
              {tags.map((tag, idx) => (
                <View key={idx} style={styles.tagBadge}>
                  <Text style={styles.tagBadgeText}>{tag}</Text>
                </View>
              ))}
            </View>

            {/* Meta score/deadline Row */}
            <View style={styles.cardMeta}>
              <Text style={styles.metaScore}>{scoreText}</Text>
              {timeLeftText ? (
                <Text style={[styles.metaDeadline, isExpired && styles.isExpired]}>
                  {timeLeftText}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Card Right */}
          <View style={styles.cardRight}>
            {/* Status Tag with Dot */}
            <View style={styles.statusTag}>
              <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              <Text style={[styles.statusTagText, { color: dotColor }]}>{statusText}</Text>
            </View>

            {/* Action Button (支持 100% 对标 Web 前置预加载 inline loading 效果) */}
            <TouchableOpacity
              disabled={isButtonDisabled || isPreloadingThisItem}
              onPress={() => goAnswer(item)}
              style={[
                styles.actionBtn,
                isButtonDisabled
                  ? styles.disabledActionBtn
                  : isSubmittedLocally
                  ? styles.secondaryActionBtn
                  : styles.primaryActionBtn
              ]}
            >
              {isPreloadingThisItem ? (
                <ActivityIndicator size="small" color={isSubmittedLocally ? LightColors.primary : '#FFFFFF'} />
              ) : (
                <Text
                  style={[
                    styles.actionBtnText,
                    isButtonDisabled
                      ? styles.disabledActionBtnText
                      : isSubmittedLocally
                      ? styles.secondaryActionBtnText
                      : styles.primaryActionBtnText
                  ]}
                >
                  {buttonText}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Card Footer (Remark) */}
        {item.remark ? (
          <View style={styles.cardFooter}>
            <Text style={styles.homeworkRemark} numberOfLines={1}>
              说明: {item.remark}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>

        {/* 筛选区域：学科筛选 + 日期选择（格式与错题本保持完全统一） */}
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

          {/* 日期筛选与日历按钮 */}
          <View style={styles.dateSelectorRow}>
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => setShowCalendarModal(true)}
            >
              <Text style={styles.calendarBtnText}>日历</Text>
            </TouchableOpacity>

            <View style={styles.dateTextContainer}>
              <Text style={styles.dateDisplayLabel}>{getDateDisplay()}</Text>
            </View>
          </View>
        </View>

        {store.isLoading && store.homeworkList.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={LightColors.primary} />
            <Text style={styles.loadingText}>正在获取筛选作业...</Text>
          </View>
        ) : (
          <FlatList
            data={store.homeworkList}
            renderItem={renderHomeworkItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={store.isLoading}
            onRefresh={loadHomeworkList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>当前筛选下暂无课后作业任务</Text>
              </View>
            }
          />
        )}

        <CalendarModal
          visible={showCalendarModal}
          onClose={() => setShowCalendarModal(false)}
          selectedDate={selectedDate}
          onSelectDate={(date) => setSelectedDate(date)}
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
  container: {
    flex: 1,
  },
  viewHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
    alignItems: 'center',
  },
  viewTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
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
  filterChipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  calendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  calendarBtnText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  dateTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dateDisplayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flex: 1,
    marginRight: 16,
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tagBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagBadgeText: {
    fontSize: 11,
    color: '#6B7280',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metaScore: {
    fontSize: 12,
    color: '#6B7280',
  },
  metaDeadline: {
    fontSize: 12,
    color: '#EF4444',
  },
  isExpired: {
    color: '#6B7280',
  },
  cardRight: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  primaryActionBtn: {
    backgroundColor: LightColors.primary,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryActionBtnText: {
    color: '#4B5563',
  },
  disabledActionBtn: {
    backgroundColor: '#E5E7EB',
  },
  disabledActionBtnText: {
    color: '#9CA3AF',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
    paddingTop: 10,
    marginTop: 10,
  },
  homeworkRemark: {
    fontSize: 12,
    color: '#696675',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});

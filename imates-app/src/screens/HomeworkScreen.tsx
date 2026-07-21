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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import {
  HomeworkService,
  HomeworkUndoItem,
  SUBJECT_ID_TO_NAME,
  getHomeworkStatusText,
  getHomeworkStatusTagColor,
} from '@/services/homework-service';

interface HomeworkScreenProps {
  onLogout: () => void;
  onGoAnswer: (id: string, title: string, subject: string) => void;
}

const LightColors = {
  background: '#f1f3ff', // Web content background
  cardBackground: '#FFFFFF',
  cardBorder: '#E2E8F0',
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  textMuted: '#696675',
  primary: '#4F46E5', // Indigo-600 matching Web button
  primaryLight: '#EEF2FF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

// 学科筛选项配置
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

export function HomeworkScreen({ onLogout, onGoAnswer }: HomeworkScreenProps) {
  const [homeworkList, setHomeworkList] = useState<HomeworkUndoItem[]>([]);
  const [isHomeworkLoading, setIsHomeworkLoading] = useState(false);
  
  // 筛选条件状态 (日期默认为今天，学科默认为空即全部)
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().slice(0, 10));
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  const loadHomeworkList = useCallback(async () => {
    setIsHomeworkLoading(true);
    try {
      const data = await HomeworkService.fetchHomeworkList({
        pageNumber: 1,
        pageSize: 50,
        subject: selectedSubject || undefined,
        date: selectedDate || undefined,
      });
      setHomeworkList(data);
    } catch (e) {
      console.warn('[HomeworkScreen] 获取作业列表失败:', e);
    } finally {
      setIsHomeworkLoading(false);
    }
  }, [selectedDate, selectedSubject]);

  // 监听筛选条件变化自动加载
  useEffect(() => {
    loadHomeworkList();
  }, [loadHomeworkList]);

  // 日期递增/递减调整
  const adjustDate = (days: number) => {
    const baseDate = selectedDate ? new Date(selectedDate) : new Date();
    if (isNaN(baseDate.getTime())) return;
    baseDate.setDate(baseDate.getDate() + days);
    setSelectedDate(baseDate.toISOString().slice(0, 10));
  };

  // 生成顶部日期显示文本
  const getDateDisplay = () => {
    if (!selectedDate) return '全部日期 📅';
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

  // 渲染作业卡片
  const renderHomeworkItem = ({ item }: { item: HomeworkUndoItem }) => {
    const subjectName = SUBJECT_ID_TO_NAME[item.subject] || item.subject;
    
    const statusText = getHomeworkStatusText(item.status, item.deadline);
    const statusColor = getHomeworkStatusTagColor(item.status, item.deadline);

    const deadlineMs = item.deadline ? new Date(item.deadline).getTime() : NaN;
    const isExpired = Number.isFinite(deadlineMs) ? deadlineMs <= Date.now() : false;
    const isCompleted = item.status === '3' || (isExpired && item.lateSubmit !== '1');

    const scoreText = item.totalScore ? `总分：${item.totalScore}分` : '总分：--';
    
    // 计算剩余时间
    const timeLeftText = (() => {
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

    // Status dot color
    const statusTagType = (() => {
      if (item.status === '3') return 'success';
      if (isExpired && item.lateSubmit !== '1') return 'gray';
      return 'warning';
    })();

    const dotColor = (() => {
      if (statusTagType === 'success') return LightColors.success;
      if (statusTagType === 'warning') return LightColors.warning;
      return LightColors.textMuted;
    })();

    // Button label and style matching getHomeworkButtonText / getHomeworkButtonVariant
    const buttonText = item.status === '3' ? '查看解析' : isCompleted ? '已截止' : '开始作答';
    const isButtonDisabled = isCompleted && item.status !== '3';
    
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

            {/* Action Button */}
            <TouchableOpacity
              disabled={isButtonDisabled}
              onPress={() => onGoAnswer(item.id, item.title, item.subject)}
              style={[
                styles.actionBtn,
                isButtonDisabled
                  ? styles.disabledActionBtn
                  : item.status === '3'
                  ? styles.secondaryActionBtn
                  : styles.primaryActionBtn
              ]}
            >
              <Text
                style={[
                  styles.actionBtnText,
                  isButtonDisabled
                    ? styles.disabledActionBtnText
                    : item.status === '3'
                    ? styles.secondaryActionBtnText
                    : styles.primaryActionBtnText
                ]}
              >
                {buttonText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Card Footer (Remark) */}
        {item.remark ? (
          <View style={styles.cardFooter}>
            <Text style={styles.homeworkRemark} numberOfLines={1}>
              💡 说明: {item.remark}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>

        {/* 筛选条件控制模块 */}
        <View style={styles.filterWrapper}>
          {/* 学科筛选水平滑动 Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjectScrollContainer}
          >
            {SUBJECT_OPTIONS.map((sub) => {
              const isActive = selectedSubject === sub.value;
              return (
                <TouchableOpacity
                  key={sub.label}
                  style={[styles.subjectChip, isActive && styles.activeSubjectChip]}
                  onPress={() => setSelectedSubject(sub.value)}
                >
                  <Text style={[styles.subjectChipText, isActive && styles.activeSubjectChipText]}>
                    {sub.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 日期单日微调及快速切换 */}
          <View style={styles.dateSelectorRow}>
            <TouchableOpacity style={styles.dateNavBtn} onPress={() => adjustDate(-1)}>
              <Text style={styles.dateNavText}>◀</Text>
            </TouchableOpacity>

            <View style={styles.dateTextContainer}>
              <Text style={styles.dateDisplayLabel}>{getDateDisplay()}</Text>
            </View>

            <TouchableOpacity style={styles.dateNavBtn} onPress={() => adjustDate(1)}>
              <Text style={styles.dateNavText}>▶</Text>
            </TouchableOpacity>

            {selectedDate && (
              <TouchableOpacity
                style={styles.clearDateBtn}
                onPress={() => setSelectedDate(null)}
              >
                <Text style={styles.clearDateText}>全部时间 🕒</Text>
              </TouchableOpacity>
            )}
            
            {!selectedDate && (
              <TouchableOpacity
                style={styles.clearDateBtn}
                onPress={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
              >
                <Text style={styles.clearDateText}>切回今天 📅</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isHomeworkLoading && homeworkList.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={LightColors.primary} />
            <Text style={styles.loadingText}>正在获取筛选作业...</Text>
          </View>
        ) : (
          <FlatList
            data={homeworkList}
            renderItem={renderHomeworkItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={isHomeworkLoading}
            onRefresh={loadHomeworkList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>当前筛选下暂无课后作业任务 🌟</Text>
              </View>
            }
          />
        )}
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
  filterWrapper: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  subjectScrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  subjectChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeSubjectChip: {
    backgroundColor: LightColors.primary,
    borderColor: LightColors.primary,
  },
  subjectChipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  activeSubjectChipText: {
    color: '#FFFFFF',
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  dateNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateNavText: {
    fontSize: 10,
    color: '#4B5563',
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
  clearDateBtn: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  clearDateText: {
    fontSize: 11,
    color: LightColors.primary,
    fontWeight: '600',
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

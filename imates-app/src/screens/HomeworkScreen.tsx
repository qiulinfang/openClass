import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
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
  onGoAnswer: (id: string, title: string) => void;
}

const LightColors = {
  background: '#F8FAFC',
  cardBackground: '#FFFFFF',
  cardBorder: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#3B82F6',
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
    const isMath = subjectName === '数学';
    
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

    const tags = [subjectName];
    if (item.fullSubmit === '1') tags.push('一次性提交');
    if (item.lateSubmit === '1') tags.push('允许补交');
    if (item.resubmit === '1') tags.push('允许重交');

    return (
      <Card style={styles.contentCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.tagsContainer}>
            {tags.map((tag, idx) => (
              <Badge
                key={idx}
                text={tag}
                style={{
                  marginRight: 6,
                  backgroundColor: isMath ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  borderColor: isMath ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                  color: isMath ? '#2563EB' : '#059669',
                }}
              />
            ))}
          </View>
          <Text style={[styles.dueDateText, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>

        {item.remark ? (
          <Text style={styles.remarkText} numberOfLines={2}>
            💡 说明: {item.remark}
          </Text>
        ) : null}

        <View style={styles.cardFooterRow}>
          <View style={styles.metaInfo}>
            <Text style={styles.scoreText}>{scoreText}</Text>
            {timeLeftText ? (
              <Text style={[styles.timeLeftText, isExpired && styles.expiredTimeText]}>
                {timeLeftText}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            disabled={isCompleted}
            onPress={() => onGoAnswer(item.id, item.title)}
            style={[
              styles.actionBtn,
              isCompleted
                ? styles.disabledActionBtn
                : { backgroundColor: LightColors.primary }
            ]}
          >
            <Text style={[styles.actionBtnText, isCompleted && styles.disabledActionBtnText]}>
              {isCompleted ? '已截止' : '去答题'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 顶部标题与用户信息栏 */}
      <View style={styles.header}>
        <View style={styles.userProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>学</Text>
          </View>
          <View>
            <Text style={styles.welcomeText}>您好，</Text>
            <Text style={styles.userName}>智能伴侣学员 🎓</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.logoutIconButton} onPress={onLogout}>
          <Text style={styles.logoutIconText}>🚪</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <View style={styles.viewHeader}>
          <Text style={styles.viewTitle}>我的作业</Text>
          <Text style={styles.viewSub}>同步课后测试与单元诊断练习</Text>
        </View>

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
    borderColor: LightColors.cardBorder,
    backgroundColor: LightColors.cardBackground,
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
  container: {
    flex: 1,
  },
  viewHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  viewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: LightColors.textPrimary,
    marginBottom: 4,
  },
  viewSub: {
    fontSize: 12,
    color: LightColors.textSecondary,
  },
  filterWrapper: {
    backgroundColor: LightColors.cardBackground,
    borderBottomWidth: 1,
    borderColor: LightColors.cardBorder,
    paddingVertical: 10,
    marginBottom: 4,
  },
  subjectScrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  subjectChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeSubjectChip: {
    backgroundColor: LightColors.primary,
    borderColor: LightColors.primary,
  },
  subjectChipText: {
    fontSize: 12,
    color: LightColors.textSecondary,
    fontWeight: '600',
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
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateNavText: {
    fontSize: 10,
    color: LightColors.textSecondary,
  },
  dateTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dateDisplayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: LightColors.textPrimary,
  },
  clearDateBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  clearDateText: {
    fontSize: 11,
    color: LightColors.primary,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  contentCard: {
    marginBottom: 14,
    padding: 16,
    backgroundColor: LightColors.cardBackground,
    borderColor: LightColors.cardBorder,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LightColors.textPrimary,
    lineHeight: 22,
    marginBottom: 12,
  },
  remarkText: {
    fontSize: 12,
    color: '#D97706',
    backgroundColor: 'rgba(217, 119, 6, 0.05)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    lineHeight: 16,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 12,
  },
  metaInfo: {
    flex: 1,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: LightColors.textSecondary,
    marginBottom: 2,
  },
  timeLeftText: {
    fontSize: 11,
    color: '#10B981',
  },
  expiredTimeText: {
    color: '#EF4444',
  },
  dueDateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledActionBtn: {
    backgroundColor: '#E2E8F0',
  },
  disabledActionBtnText: {
    color: LightColors.textMuted,
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
    color: LightColors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: LightColors.textMuted,
  },
});

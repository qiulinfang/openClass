import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Platform,
} from 'react-native';
import { Card } from '@/components/Card';
import { MathRenderer } from '@/components/MathRenderer';
import { MistakeService, MistakeItem } from '@/services/mistake-service';
import { SUBJECT_ID_TO_NAME } from '@/services/homework-service';

interface MistakeBookScreenProps {
  onLogout: () => void;
  onAskAI: (questionContent: string) => void;
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

export function MistakeBookScreen({ onLogout, onAskAI }: MistakeBookScreenProps) {
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedAnalyses, setExpandedAnalyses] = useState<Record<string, boolean>>({});

  const loadMistakes = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await MistakeService.getMistakes();
      setMistakes(data);
    } catch (e) {
      console.warn('[MistakeBookScreen] 获取错题失败:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMistakes();
  }, [loadMistakes]);

  const handleRemove = async (id: string) => {
    try {
      await MistakeService.removeMistake(id);
      setMistakes(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      console.warn('[MistakeBookScreen] 移除错题失败:', e);
    }
  };

  const toggleAnalysis = (id: string) => {
    setExpandedAnalyses(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredMistakes = mistakes.filter(m => {
    if (!selectedSubject) return true;
    return m.subject === selectedSubject;
  });

  const renderMistakeItem = ({ item }: { item: MistakeItem }) => {
    const isExpanded = !!expandedAnalyses[item.id];
    const subjectName = SUBJECT_ID_TO_NAME[item.subject] || '学科';

    return (
      <Card style={styles.contentCard}>
        {/* 来源与学科标签 */}
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sourceText} numberOfLines={1}>
            📌 来源于: {item.homeworkTitle || '课后作业'}
          </Text>
          <View style={styles.subjectBadge}>
            <Text style={styles.subjectBadgeText}>{subjectName}</Text>
          </View>
        </View>

        {/* 题干 LaTeX 渲染 */}
        <View style={styles.mathContainer}>
          <MathRenderer content={item.title} textColor="#0F172A" />
        </View>

        {/* 作答与标准答案对比 */}
        <View style={styles.answerCompareContainer}>
          <View style={styles.answerRow}>
            <Text style={styles.answerLabel}>❌ 您的解答：</Text>
            <Text style={styles.wrongAnswerText}>{item.userAnswer || '未作答'}</Text>
          </View>
          <View style={styles.answerRow}>
            <Text style={styles.answerLabel}>✅ 正确答案：</Text>
            <Text style={styles.correctAnswerText}>{item.correctAnswer || '暂无答案'}</Text>
          </View>
        </View>

        {/* 可折叠的解析 */}
        {isExpanded && (
          <View style={styles.analysisContainer}>
            <Text style={styles.analysisTitle}>💡 答案解析：</Text>
            <MathRenderer content={item.analysis} textColor="#475569" />
          </View>
        )}

        {/* 操作区 */}
        <View style={styles.cardFooterRow}>
          <TouchableOpacity
            style={styles.analysisToggleBtn}
            onPress={() => toggleAnalysis(item.id)}
          >
            <Text style={styles.analysisToggleText}>
              {isExpanded ? '收起解析 ▲' : '展开解析 ▼'}
            </Text>
          </TouchableOpacity>

          <View style={styles.actionGroup}>
            <TouchableOpacity
              style={styles.aiBtn}
              onPress={() => onAskAI(item.title)}
            >
              <Text style={styles.aiBtnText}>🤖 问学伴</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemove(item.id)}
            >
              <Text style={styles.removeBtnText}>🗑️ 移除</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 顶部 Header */}
      <View style={styles.header}>
        <View style={styles.userProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>学</Text>
          </View>
          <View>
            <Text style={styles.welcomeText}>您好，</Text>
            <Text style={styles.userName}>我的错题本 📚</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.logoutIconButton} onPress={onLogout}>
          <Text style={styles.logoutIconText}>🚪</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* 学科筛选 */}
        <View style={styles.filterWrapper}>
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
        </View>

        <FlatList
          data={filteredMistakes}
          renderItem={renderMistakeItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={isRefreshing}
          onRefresh={loadMistakes}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {mistakes.length === 0 ? '暂无收藏的错题，做错的作业会自动加入哦 🌟' : '该学科下暂无错题 💡'}
              </Text>
            </View>
          }
        />
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
  container: {
    flex: 1,
  },
  filterWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: LightColors.border,
    paddingVertical: 10,
  },
  subjectScrollContainer: {
    paddingHorizontal: 16,
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  contentCard: {
    marginBottom: 14,
    padding: 16,
    backgroundColor: LightColors.cardBackground,
    borderColor: LightColors.border,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
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
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 8,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '600',
    color: LightColors.textSecondary,
    flex: 1,
    marginRight: 10,
  },
  subjectBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  subjectBadgeText: {
    fontSize: 10,
    color: LightColors.primary,
    fontWeight: '700',
  },
  mathContainer: {
    marginBottom: 14,
  },
  answerCompareContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: LightColors.textSecondary,
    width: 80,
  },
  wrongAnswerText: {
    fontSize: 13,
    fontWeight: '700',
    color: LightColors.error,
  },
  correctAnswerText: {
    fontSize: 13,
    fontWeight: '700',
    color: LightColors.success,
  },
  analysisContainer: {
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 12,
    marginBottom: 14,
  },
  analysisTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: LightColors.primary,
    marginBottom: 6,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 12,
  },
  analysisToggleBtn: {
    paddingVertical: 6,
  },
  analysisToggleText: {
    fontSize: 12,
    color: LightColors.textSecondary,
    fontWeight: '700',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  aiBtnText: {
    fontSize: 11,
    color: LightColors.primary,
    fontWeight: '700',
  },
  removeBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  removeBtnText: {
    fontSize: 11,
    color: LightColors.error,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 13,
    color: LightColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});

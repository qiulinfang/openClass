import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MathRenderer } from '../MathRenderer';
import { normalizeQuestionContent } from '@/utils/exercise-parser';

export interface BaseQuestionProps {
  question: any;
  showTitle?: boolean;
  showId?: boolean;
  showTypeTag?: boolean;
  showAnalysis?: boolean;
  scorePointList?: any[];
  children?: React.ReactNode;
  headerExtra?: React.ReactNode;
  stemOverride?: React.ReactNode;
}

export function BaseQuestion({
  question,
  showTitle = false,
  showId = false,
  showTypeTag = true,
  children,
  headerExtra,
  stemOverride,
}: BaseQuestionProps) {
  const typeLabelMap: Record<string, string> = {
    single_choice: '单选题',
    multiple_choice: '多选题',
    choice: '选择题',
    fill_in_blank: '填空题',
    blank: '填空题',
    true_false: '判断题',
    judgment: '判断题',
    subjective: '解答题',
    composite: '复合大题',
  };

  const rawType = question?.structuredContent?.type || question?.type || 'subjective';
  const typeLabel = typeLabelMap[rawType] || '题目';
  const rawStem =
    question?.structuredContent?.stem ||
    question?.questionContent ||
    question?.content ||
    question?.question ||
    question?.title ||
    '';
  const stemContent = normalizeQuestionContent(rawStem);

  return (
    <View style={styles.container}>
      {/* 顶栏 Header: 题型徽章 + 题目编号 + 右侧 Extra 按钮 */}
      {showTitle && (
        <View style={styles.header}>
          <View style={styles.headerLeftGroup}>
            {showTypeTag && (
              <View style={styles.typeTagBadge}>
                <Text style={styles.typeTagText}>{typeLabel}</Text>
              </View>
            )}
            {showId && (question?.bmNo || question?.questionId || question?.id) && (
              <Text style={styles.bmNoText}>
                ID: {question.bmNo || question.questionId || question.id}
              </Text>
            )}
          </View>

          <View style={styles.headerRightGroup}>
            {headerExtra}
          </View>
        </View>
      )}

      {/* 题干部分 Stem */}
      <View style={styles.stemContainer}>
        {stemOverride ? (
          stemOverride
        ) : (
          <MathRenderer content={stemContent} textColor="#0F172A" />
        )}
      </View>

      {/* 交互主体 Children (选项卡 / 输入框 / 白板 / OCR) */}
      {children && <View style={styles.contentContainer}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeTagBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  bmNoText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stemContainer: {
    width: '100%',
    marginBottom: 12,
  },
  contentContainer: {
    width: '100%',
  },
});

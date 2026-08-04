import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

export interface AnswerCheckQuestion {
  id?: string;
  questionId?: string;
  [key: string]: any;
}

export interface AnswerCheckModalProps {
  visible: boolean;
  onClose: () => void;
  questions: AnswerCheckQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  answersImage: Record<string, string>;
  onSelectQuestion: (index: number) => void;
}

function safeTrimAnswer(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) return val.join(', ').trim();
  if (typeof val === 'object') return JSON.stringify(val).trim();
  return String(val).trim();
}

export function AnswerCheckModal({
  visible,
  onClose,
  questions,
  currentIndex,
  answers,
  answersImage,
  onSelectQuestion,
}: AnswerCheckModalProps) {
  const checkStats = useMemo(() => {
    let complete = 0;
    let half = 0;
    let none = 0;

    questions.forEach(q => {
      const qId = q.questionId || q.id || '';
      const textAns = safeTrimAnswer(answers[qId]);
      const imgAns = safeTrimAnswer(answersImage[qId]);
      const hasText = textAns !== '';
      const hasImage = imgAns !== '';

      if (hasText && hasImage) {
        complete++;
      } else if (hasText || hasImage) {
        half++;
      } else {
        none++;
      }
    });

    return { complete, half, none };
  }, [questions, answers, answersImage]);

  if (!visible) return null;

  return (
    <View style={styles.modalBackdrop}>
      <TouchableOpacity style={styles.backdropClickArea} activeOpacity={1} onPress={onClose} />
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>题目作答情况</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} activeOpacity={0.7}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* 状态图例说明 */}
        <View style={styles.statusLegendRow}>
          <Text style={styles.modalSummaryText}>
            已完成 {checkStats.complete + checkStats.half} / {questions.length} 题
          </Text>
          <View style={styles.legendBadgeGroup}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#52C41A' }]} />
              <Text style={styles.legendText}>完整答题 ({checkStats.complete})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FFFBE6', borderWidth: 1, borderColor: '#F3EED9' }]} />
              <Text style={styles.legendText}>部分答题 ({checkStats.half})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EAA7A7' }]} />
              <Text style={styles.legendText}>未完成 ({checkStats.none})</Text>
            </View>
          </View>
        </View>

        {/* 题目方块网格 */}
        <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
          {questions.map((q, idx) => {
            const qId = q.questionId || q.id || '';
            const textAns = safeTrimAnswer(answers[qId]);
            const imgAns = safeTrimAnswer(answersImage[qId]);
            const hasText = textAns !== '';
            const hasImage = imgAns !== '';

            let status: 'complete' | 'half' | 'none' = 'none';
            if (hasText && hasImage) {
              status = 'complete';
            } else if (hasText || hasImage) {
              status = 'half';
            } else {
              status = 'none';
            }

            const isCurrent = idx === currentIndex;

            const itemStyle = status === 'complete'
              ? styles.gridItemComplete
              : status === 'half'
              ? styles.gridItemHalf
              : styles.gridItemNone;

            const textStyle = status === 'complete'
              ? styles.gridItemTextComplete
              : status === 'half'
              ? styles.gridItemTextHalf
              : styles.gridItemTextNone;

            return (
              <TouchableOpacity
                key={qId || idx}
                style={[
                  styles.gridItem,
                  itemStyle,
                  isCurrent && styles.gridItemCurrent
                ]}
                onPress={() => {
                  onSelectQuestion(idx);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.gridItemText,
                    textStyle,
                    isCurrent && styles.gridItemTextCurrent
                  ]}
                >
                  {idx + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    zIndex: 1000,
    justifyContent: 'flex-end',
  },
  backdropClickArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '65%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: 'bold',
  },
  statusLegendRow: {
    marginBottom: 16,
  },
  modalSummaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  legendBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingBottom: 16,
  },
  gridItem: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
  },
  gridItemComplete: {
    backgroundColor: '#A8CBBA', // 柔和薄荷绿
  },
  gridItemHalf: {
    backgroundColor: '#FFFBE6', // 柔和奶油黄
    borderWidth: 1,
    borderColor: '#F3EED9',
  },
  gridItemNone: {
    backgroundColor: '#EAA7A7', // 柔和粉红
  },
  gridItemCurrent: {
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  gridItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  gridItemTextComplete: {
    color: '#2E5A44',
  },
  gridItemTextHalf: {
    color: '#8C826B',
  },
  gridItemTextNone: {
    color: '#7A3E3E',
  },
  gridItemTextCurrent: {
    fontWeight: '700',
  },
});

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MathRenderer } from '@/components/MathRenderer';
import { HomeworkQuestionDetail } from '@/services/homework-service';

interface QuestionViewerProps {
  question: HomeworkQuestionDetail;
  currentIndex: number;
  totalCount: number;
  options: string[] | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export function QuestionViewer({
  question,
  currentIndex,
  totalCount,
  options,
  isFavorite,
  onToggleFavorite,
}: QuestionViewerProps) {
  return (
    <View style={styles.topContainer}>
      {/* 题型标签及切题指示 */}
      <View style={styles.questionTagRow}>
        <View style={styles.questionTypeTag}>
          <Text style={styles.questionTypeTagText}>
            {options ? '选择题' : '解答题'}
          </Text>
        </View>
        <Text style={styles.progressText}>
          第 {currentIndex + 1} / {totalCount} 题
        </Text>
        <TouchableOpacity
          style={[styles.favoriteBtn, isFavorite && styles.favoriteBtnActive]}
          onPress={onToggleFavorite}
          activeOpacity={0.7}
        >
          <Text style={[styles.favoriteBtnText, isFavorite && styles.favoriteBtnTextActive]}>
            {isFavorite ? '★ 已加入习题' : '☆ 收藏此题'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 题干 LaTeX 渲染滑动区 */}
      <ScrollView style={styles.questionScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.mathContainer}>
          <MathRenderer content={question.questionContent} textColor="#0F172A" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topContainer: {
    flex: 1.1,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  questionTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  questionTypeTag: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 10,
  },
  questionTypeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  favoriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  favoriteBtnActive: {
    borderColor: '#EAB308',
    backgroundColor: '#FEF08A',
  },
  favoriteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  favoriteBtnTextActive: {
    color: '#A16207',
  },
  questionScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  mathContainer: {
    paddingVertical: 12,
    paddingBottom: 24,
  },
});

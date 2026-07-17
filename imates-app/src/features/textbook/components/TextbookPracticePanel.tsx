import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MathRenderer } from '@/components/MathRenderer';
import type { TextbookPracticeContext } from '../types';
import {
  PracticeQuestion,
  PreparedPracticeData,
  TextbookPracticeService,
} from '../services/textbook-practice-service';

interface TextbookPracticePanelProps {
  context: TextbookPracticeContext;
  preparedData: PreparedPracticeData;
  onStart: (questions: PracticeQuestion[]) => void;
}

export function TextbookPracticePanel({
  context,
  preparedData,
  onStart,
}: TextbookPracticePanelProps) {
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [knowledgeIds, setKnowledgeIds] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  const hydrate = useCallback((prepared: PreparedPracticeData) => {
    setKnowledgeIds(prepared.knowledgeIds);
    setSavedIds(prepared.savedIds);
    setQuestions(prepared.page.questions);
    setSelectedIds(
      new Set(
        prepared.page.questions
          .filter((question) => question.atUserList)
          .map((question) => question.bmNo)
      )
    );
    setCurrentPage(prepared.page.currentPage);
    setTotalCount(prepared.page.totalCount);
    setError('');
  }, []);

  useEffect(() => {
    hydrate(preparedData);
  }, [hydrate, preparedData]);

  const selectableQuestions = useMemo(
    () => questions.filter((question) => !question.atUserList),
    [questions]
  );
  const isAllSelected =
    selectableQuestions.length > 0 &&
    selectableQuestions.every((question) => selectedIds.has(question.bmNo));
  const selectedQuestions = questions.filter((question) =>
    selectedIds.has(question.bmNo)
  );
  const hasMore = questions.length < totalCount;

  const toggleQuestion = (question: PracticeQuestion) => {
    if (question.atUserList) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(question.bmNo)) next.delete(question.bmNo);
      else next.add(question.bmNo);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (isAllSelected) {
        selectableQuestions.forEach((question) => next.delete(question.bmNo));
      } else {
        selectableQuestions.forEach((question) => next.add(question.bmNo));
      }
      return next;
    });
  };

  const loadMore = async () => {
    if (!knowledgeIds || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setError('');
    try {
      const page = await TextbookPracticeService.findQuestionsByKnowledge(
        knowledgeIds,
        context.subject,
        savedIds,
        currentPage + 1
      );
      setQuestions((current) => {
        const byId = new Map(
          current.map((question) => [question.bmNo, question])
        );
        page.questions.forEach((question) => byId.set(question.bmNo, question));
        return Array.from(byId.values());
      });
      setSelectedIds((current) => {
        const next = new Set(current);
        page.questions
          .filter((question) => question.atUserList)
          .forEach((question) => next.add(question.bmNo));
        return next;
      });
      setCurrentPage(page.currentPage);
      setTotalCount(page.totalCount);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载更多失败');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const startPractice = async () => {
    if (selectedQuestions.length === 0 || isStarting) return;
    setIsStarting(true);
    setError('');
    try {
      await TextbookPracticeService.addQuestions(
        selectedQuestions,
        context.subject,
        savedIds
      );
      onStart(selectedQuestions);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : '加入练习失败，请重试'
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.actionRow}>
        <View>
          <Text style={styles.contextLabel} numberOfLines={1}>
            {context.sectionName}
          </Text>
          <Text style={styles.summaryText}>
            已选 <Text style={styles.summaryStrong}>{selectedIds.size}</Text> /
            {totalCount || questions.length}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={toggleAll}
          disabled={selectableQuestions.length === 0}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.selectAllText,
              selectableQuestions.length === 0 && styles.disabledText,
            ]}
          >
            {isAllSelected ? '取消全选' : '全选'}
          </Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.questionList}>
        {questions.map((question, index) => {
          const selected = selectedIds.has(question.bmNo);
          return (
            <TouchableOpacity
              key={question.bmNo}
              style={[
                styles.questionCard,
                selected && styles.questionCardSelected,
                question.atUserList && styles.questionCardSaved,
              ]}
              onPress={() => toggleQuestion(question)}
              activeOpacity={question.atUserList ? 1 : 0.78}
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: selected,
                disabled: !!question.atUserList,
              }}
            >
              <View style={styles.questionHeader}>
                <Text style={styles.questionNumber}>题目 {index + 1}</Text>
                <View
                  style={[
                    styles.checkbox,
                    selected && styles.checkboxSelected,
                    question.atUserList && styles.checkboxSaved,
                  ]}
                >
                  {selected ? <Text style={styles.checkboxText}>✓</Text> : null}
                </View>
              </View>
              <MathRenderer content={question.content} textColor="#20243D" />
              {question.atUserList ? (
                <Text style={styles.savedLabel}>已在我的习题中</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {hasMore ? (
        <TouchableOpacity
          style={styles.loadMoreButton}
          onPress={() => void loadMore()}
          disabled={isLoadingMore}
          accessibilityRole="button"
        >
          {isLoadingMore ? (
            <ActivityIndicator size="small" color="#6256D9" />
          ) : (
            <Text style={styles.loadMoreText}>加载更多题目</Text>
          )}
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[
          styles.startButton,
          selectedQuestions.length === 0 && styles.startButtonDisabled,
        ]}
        onPress={() => void startPractice()}
        disabled={selectedQuestions.length === 0 || isStarting}
        accessibilityRole="button"
      >
        {isStarting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.startButtonText}>开始练习</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1E3EC',
    backgroundColor: '#FFFFFF',
  },
  actionRow: {
    minHeight: 52,
    marginBottom: 10,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contextLabel: {
    maxWidth: 220,
    marginBottom: 4,
    color: '#20243D',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryText: { color: '#626881', fontSize: 12 },
  summaryStrong: { color: '#6256D9', fontWeight: '900' },
  selectAllButton: {
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectAllText: { color: '#6256D9', fontSize: 13, fontWeight: '800' },
  disabledText: { color: '#A5A8B5' },
  errorBanner: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFF0F0',
  },
  errorText: {
    color: '#C74242',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  questionList: { width: '100%' },
  questionCard: {
    minHeight: 132,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E3EC',
    backgroundColor: '#FFFFFF',
  },
  questionCardSelected: { borderColor: '#7A6FF0', backgroundColor: '#F0EEFF' },
  questionCardSaved: { borderColor: '#FFB48F', backgroundColor: '#FFF7F2' },
  questionHeader: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionNumber: { color: '#626881', fontSize: 12, fontWeight: '800' },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#B5BAC8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: { borderColor: '#6256D9', backgroundColor: '#6256D9' },
  checkboxSaved: { borderColor: '#FF7D40', backgroundColor: '#FF7D40' },
  checkboxText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  savedLabel: {
    marginTop: 10,
    color: '#D26330',
    fontSize: 11,
    fontWeight: '800',
  },
  loadMoreButton: {
    minHeight: 44,
    marginTop: 2,
    marginBottom: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D6D2FA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F5FF',
  },
  loadMoreText: { color: '#6256D9', fontSize: 13, fontWeight: '800' },
  startButton: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF7D40',
  },
  startButtonDisabled: { backgroundColor: '#C6C8D2' },
  startButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});

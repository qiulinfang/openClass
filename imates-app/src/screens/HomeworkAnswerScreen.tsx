import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MathRenderer } from '@/components/MathRenderer';
import { Card } from '@/components/Card';
import { HomeworkService, HomeworkQuestionDetail } from '@/services/homework-service';
import { MistakeService } from '@/services/mistake-service';
import { ExerciseService } from '@/services/exercise-service';

interface HomeworkAnswerScreenProps {
  homeworkId: string;
  homeworkTitle: string;
  homeworkSubject?: string;
  onBack: () => void;
  onAskAI: (questionContent: string) => void;
}

const LightColors = {
  background: '#F8FAFC',
  cardBackground: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  primary: '#3B82F6',
};

export function HomeworkAnswerScreen({
  homeworkId,
  homeworkTitle,
  homeworkSubject = '6',
  onBack,
  onAskAI,
}: HomeworkAnswerScreenProps) {
  const [questions, setQuestions] = useState<HomeworkQuestionDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 记录每个 questionId 的答案
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 习题本收藏状态
  const [isFavorite, setIsFavorite] = useState(false);

  // 监听当前题目变化，检查是否已被加入习题本
  const activeQuestion = questions[currentIndex];
  useEffect(() => {
    if (activeQuestion) {
      ExerciseService.isExerciseSaved(activeQuestion.questionId).then(setIsFavorite);
    }
  }, [currentIndex, activeQuestion]);

  const handleToggleFavorite = async () => {
    if (!activeQuestion) return;
    try {
      const saved = await ExerciseService.toggleExercise({
        id: activeQuestion.questionId,
        title: activeQuestion.questionContent.substring(0, 15).replace(/<[^>]+>/g, '').trim() + '...',
        subject: homeworkSubject,
        content: activeQuestion.questionContent,
        answer: activeQuestion.questionAnswer || '',
        analysis: activeQuestion.questionAnalysis || '暂无解析',
      });
      setIsFavorite(saved);
      Alert.alert(saved ? '★ 已加入习题本' : '☆ 已从习题本移除');
    } catch (e) {
      console.warn('[HomeworkAnswerScreen] 切换习题收藏失败:', e);
    }
  };

  // 加载作业题目详情
  useEffect(() => {
    async function loadDetails() {
      setIsLoading(true);
      try {
        const list = await HomeworkService.getHomeworkDetailList(homeworkId);
        setQuestions(list);
        
        // 初始化答案
        const initialAnswers: Record<string, string> = {};
        list.forEach(q => {
          initialAnswers[q.questionId] = '';
        });
        setAnswers(initialAnswers);
      } catch (error) {
        console.warn('[HomeworkAnswerScreen] 加载题目详情错误:', error);
        Alert.alert('错误', '加载作业题目失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    }
    loadDetails();
  }, [homeworkId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={LightColors.primary} />
          <Text style={styles.loadingText}>正在载入作业题目...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>◀ 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {homeworkTitle}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>当前作业没有任何题目数据 💡</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentIndex];
  
  // 提取选项列表 (支持 A, B, C, D 渲染)
  const options = (() => {
    if (currentQuestion.questionChooseList && currentQuestion.questionChooseList.length > 0) {
      return currentQuestion.questionChooseList;
    }
    if (currentQuestion.questionChooseInfo) {
      try {
        // 有可能是个 JSON 字符串
        const parsed = JSON.parse(currentQuestion.questionChooseInfo);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // 如果是按逗号或分号隔开的文本，进行切分
        const parts = currentQuestion.questionChooseInfo.split(/[;；,，]/).map(p => p.trim()).filter(Boolean);
        if (parts.length > 0) return parts;
      }
    }
    // 默认如果题目含 ABCD 选项特征且没有列表，提供标准的单选按钮
    const content = currentQuestion.questionContent || '';
    if (content.includes('A.') || content.includes('A、')) {
      return ['A', 'B', 'C', 'D'];
    }
    return null;
  })();

  const handleSelectOption = (option: string) => {
    // 提取选项首字母作为答案，例如 "A. 选项一" ➜ "A"
    const char = option.trim().charAt(0).toUpperCase();
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.questionId]: char,
    }));
  };

  const handleTextAnswerChange = (text: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.questionId]: text,
    }));
  };

  // 提交整份作业
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const questionAnswerList = questions.map(q => {
        const answerText = answers[q.questionId] || '';
        return {
          questionId: q.questionId,
          answerData: [answerText],
        };
      });

      const success = await HomeworkService.submitHomework({
        homeworkId,
        questionAnswerList,
      });

      if (success) {
        // 自动将答错的题目记录到错题本
        for (const q of questions) {
          const userAns = (answers[q.questionId] || '').trim();
          const correctAns = (q.questionAnswer || '').trim();
          if (userAns !== '' && userAns.toUpperCase() !== correctAns.toUpperCase()) {
            try {
              await MistakeService.addMistake({
                bmNo: q.questionId,
                questionData: {
                  id: q.questionId,
                  title: q.questionContent.substring(0, 30).replace(/<[^>]+>/g, '').trim(),
                  subject: homeworkSubject,
                  content: q.questionContent,
                  answer: correctAns,
                  analysis: q.questionAnalysis || '暂无解析',
                  timestamp: Date.now()
                },
                originalAnswer: userAns,
                homeworkId: homeworkId,
                homeworkName: homeworkTitle,
              });
            } catch (mistakeErr) {
              console.warn('[HomeworkAnswerScreen] 自动同步错题本失败:', mistakeErr);
            }
          }
        }

        Alert.alert('成功', '作业提交保存成功！', [
          { text: '确定', onPress: onBack }
        ]);
      } else {
        Alert.alert('失败', '作业提交保存失败，请稍后重试');
      }
    } catch (e) {
      console.warn('[HomeworkAnswerScreen] 提交作业异常:', e);
      Alert.alert('错误', '提交作业接口连接异常');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 顶部 Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>◀ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {homeworkTitle}
        </Text>
        
        {/* 智能辅助提问按钮 */}
        <TouchableOpacity
          style={styles.aiAssistBtn}
          onPress={() => onAskAI(currentQuestion.questionContent)}
        >
          <Text style={styles.aiAssistBtnText}>🤖 问学伴</Text>
        </TouchableOpacity>
      </View>

      {/* 答题进度展示 */}
      <View style={styles.progressBarRow}>
        <Text style={styles.progressText}>
          题目 {currentIndex + 1} / {questions.length}
        </Text>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${((currentIndex + 1) / questions.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* 题目内容与选项/输入框区域 */}
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollInner}>
        <Card style={styles.questionCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.questionIndexTag}>题干说明：</Text>
            <TouchableOpacity
              style={[styles.favoriteBtn, isFavorite && styles.favoriteBtnActive]}
              onPress={handleToggleFavorite}
              activeOpacity={0.7}
            >
              <Text style={[styles.favoriteBtnText, isFavorite && styles.favoriteBtnTextActive]}>
                {isFavorite ? '★ 已加入习题' : '☆ 收藏此题'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mathContainer}>
            <MathRenderer content={currentQuestion.questionContent} textColor="#0F172A" />
          </View>
        </Card>

        {/* 答案填写区域 */}
        <View style={styles.answerSection}>
          <Text style={styles.sectionTitle}>✍️ 您的解答：</Text>
          
          {options ? (
            // 选择题渲染
            <View style={styles.optionsList}>
              {options.map((opt, idx) => {
                const char = opt.trim().charAt(0).toUpperCase();
                const isSelected = answers[currentQuestion.questionId] === char;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.optionItem, isSelected && styles.activeOptionItem]}
                    onPress={() => handleSelectOption(opt)}
                  >
                    <View style={[styles.optionIndicator, isSelected && styles.activeOptionIndicator]}>
                      <Text style={[styles.optionIndicatorText, isSelected && styles.activeOptionIndicatorText]}>
                        {char}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.activeOptionText]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            // 简答主观题渲染
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={6}
              placeholder="请输入您的解题步骤或答案..."
              value={answers[currentQuestion.questionId]}
              onChangeText={handleTextAnswerChange}
            />
          )}
        </View>
      </ScrollView>

      {/* 底部翻页与提交控制条 */}
      <View style={styles.footerRow}>
        <TouchableOpacity
          disabled={currentIndex === 0}
          style={[styles.navBtn, currentIndex === 0 && styles.disabledNavBtn]}
          onPress={() => setCurrentIndex(prev => prev - 1)}
        >
          <Text style={styles.navBtnText}>上一题</Text>
        </TouchableOpacity>

        {currentIndex === questions.length - 1 ? (
          <TouchableOpacity
            style={styles.submitBtn}
            disabled={isSubmitting}
            onPress={handleSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>提交作业 🚀</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentIndex(prev => prev + 1)}
          >
            <Text style={styles.navBtnText}>下一题</Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: LightColors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 14,
    color: LightColors.textSecondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: LightColors.border,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: LightColors.textSecondary,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: LightColors.textPrimary,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  aiAssistBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  aiAssistBtnText: {
    fontSize: 12,
    color: LightColors.primary,
    fontWeight: '700',
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: LightColors.border,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: LightColors.textSecondary,
    marginRight: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: LightColors.primary,
    borderRadius: 3,
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollInner: {
    padding: 16,
  },
  questionCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderColor: LightColors.border,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  questionIndexTag: {
    fontSize: 13,
    fontWeight: '700',
    color: LightColors.primary,
    marginBottom: 8,
  },
  mathContainer: {
    marginTop: 4,
  },
  answerSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LightColors.textPrimary,
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: LightColors.textPrimary,
    textAlignVertical: 'top',
    minHeight: 120,
  },
  optionsList: {
    marginTop: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  activeOptionItem: {
    borderColor: LightColors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
  },
  optionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeOptionIndicator: {
    backgroundColor: LightColors.primary,
    borderColor: LightColors.primary,
  },
  optionIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
    color: LightColors.textSecondary,
  },
  activeOptionIndicatorText: {
    color: '#FFFFFF',
  },
  optionText: {
    fontSize: 14,
    color: LightColors.textSecondary,
    flex: 1,
  },
  activeOptionText: {
    color: LightColors.textPrimary,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: LightColors.border,
    backgroundColor: '#FFFFFF',
  },
  navBtn: {
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 20,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledNavBtn: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: LightColors.textSecondary,
  },
  submitBtn: {
    flex: 1,
    marginLeft: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  favoriteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  favoriteBtnActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  favoriteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: LightColors.textSecondary,
  },
  favoriteBtnTextActive: {
    color: '#F59E0B',
    fontWeight: '700',
  },
});

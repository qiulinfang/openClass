import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { QuestionViewer } from '@/components/QuestionViewer';
import { MathRenderer } from '@/components/MathRenderer';
import { HomeworkService, HomeworkQuestionDetail } from '@/services/homework-service';
import { ExerciseService } from '@/services/exercise-service';
import { useRoute, useNavigation } from '@react-navigation/native';
import { storage } from '@/services/storage';
import { getXuebanApiUrl } from '@/services/api-url';
import { getCurrentEnvType, AppEnvType } from '@/services/env-config';
import { GlobalAiAssistant, type AiChatContext } from '@/features/ai-chat';

const LightColors = {
  background: '#F8FAFC',
  cardBackground: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  primary: '#4F46E5', // 现代靛蓝色
  primaryLight: '#E0E7FF',
  danger: '#EF4444',
  success: '#10B981',
};
const EXERCISE_ASSISTANT = require('../../assets/exercise-assistant.png');

export function PracticeReviewScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const {
    homeworkId,
    homeworkTitle,
    homeworkSubject = '6',
    questionsList,
    initialIndex = 0,
  }: {
    homeworkId?: string;
    homeworkTitle: string;
    homeworkSubject?: string;
    questionsList?: HomeworkQuestionDetail[];
    initialIndex?: number;
  } = route.params || {};

  const handleBack = () => {
    navigation.goBack();
  };

  // 科目 ID 映射英文前缀 (微课 / 举一反三使用)
  const SUBJECT_ID_TO_ENGLISH: Record<string, string> = {
    '1': 'chinese',
    '2': 'math',
    '3': 'english',
    '4': 'physics',
    '5': 'chemistry',
    '6': 'biology',
    '7': 'politics',
    '8': 'history',
    '9': 'geography',
  };

  const [questions, setQuestions] = useState<HomeworkQuestionDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAiAssistant, setShowAiAssistant] = useState(false);

  // 查看答案 & 举一反三 模态框及数据状态
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const [similarQuestions, setSimilarQuestions] = useState<any[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // 练习模式下，控制当前题目答案和解析是否内联显示 (默认进入时不显示)
  const [showAnswersInline, setShowAnswersInline] = useState<Record<string, boolean>>({});

  // 习题本收藏状态
  const [isFavorite, setIsFavorite] = useState(false);

  // 监听当前题目变化，检查是否已被加入习题本
  const activeQuestion = questions[currentIndex];
  const questionAiContext = useMemo<AiChatContext | null>(() => {
    if (!activeQuestion) return null;
    return {
      scene: 'exercise',
      scopeKey: `exercise-${activeQuestion.questionId}`,
      title: '题目学伴',
      subtitle: '围绕当前题目启发式答疑',
      resourceId: activeQuestion.questionId,
      resourceName: homeworkTitle,
      subject: homeworkSubject,
      exerciseQuestion: {
        id: activeQuestion.questionId,
        content: activeQuestion.questionContent,
        answer: activeQuestion.questionAnswer || '',
        analysis: activeQuestion.questionAnalysis || '',
        subject: homeworkSubject,
      },
    };
  }, [activeQuestion, homeworkSubject, homeworkTitle]);
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
      console.warn('[PracticeReviewScreen] 切换习题收藏失败:', e);
    }
  };

  const handleOpenMiniClass = () => {
    if (!activeQuestion) return;
    const bmNo = (activeQuestion.questionId || '').trim();
    if (!bmNo) {
      Alert.alert('提示', '题目 ID 缺失，无法打开微课');
      return;
    }
    const subjId = homeworkSubject || '2';
    const subjectPrefix = (SUBJECT_ID_TO_ENGLISH[subjId] || 'math').toLowerCase();
    const url = `https://www.imates.com.cn:9099/wk/${subjectPrefix}/${bmNo}/${bmNo}.html`;
    Linking.openURL(url).catch(() => {
      Alert.alert('提示', '无法打开微课链接');
    });
  };

  const handleViewAnswer = () => {
    setShowAnswerModal(true);
  };

  const handleViewSimilar = async () => {
    if (!activeQuestion) return;
    setLoadingSimilar(true);
    setShowSimilarModal(true);
    try {
      const token = await storage.getItem('XUEBAN_TOKEN') || '';
      const subjId = homeworkSubject || '2';
      const subjectName = (SUBJECT_ID_TO_ENGLISH[subjId] || 'math').toLowerCase();
      
      const response = await fetch(getXuebanApiUrl('/permission/topicAndAck'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': token.trim(),
          'sa-token': token.trim(),
          'authorization': token.trim(),
        },
        body: JSON.stringify({
          bmNo: activeQuestion.questionId,
          title: activeQuestion.questionContent.substring(0, 30).replace(/<[^>]+>/g, '').trim(),
          answer: activeQuestion.questionAnswer || '',
          explanation: activeQuestion.questionAnalysis || '',
          analysisData: activeQuestion.questionAnalysis || '',
          exercisesId: '',
          type: subjectName,
        })
      });
      
      if (response.ok) {
        const resJson = await response.json();
        const list = resJson?.data?.questions || [];
        setSimilarQuestions(list);
      } else {
        setSimilarQuestions([]);
      }
    } catch (e) {
      console.warn('[PracticeReviewScreen] 获取相似题目失败:', e);
      setSimilarQuestions([]);
    } finally {
      setLoadingSimilar(false);
    }
  };

  // 加载题目列表
  useEffect(() => {
    if (questionsList && questionsList.length > 0) {
      setQuestions(questionsList);
      if (initialIndex >= 0 && initialIndex < questionsList.length) {
        setCurrentIndex(initialIndex);
      }
      setIsLoading(false);
      return;
    }

    async function loadDetails() {
      if (!homeworkId) return;
      setIsLoading(true);
      try {
        const list = await HomeworkService.getHomeworkDetailList(homeworkId);
        setQuestions(list);
        if (initialIndex >= 0 && initialIndex < list.length) {
          setCurrentIndex(initialIndex);
        }
      } catch (error) {
        console.warn('[PracticeReviewScreen] 加载题目详情错误:', error);
        Alert.alert('错误', '加载作业题目失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    }
    loadDetails();
  }, [homeworkId, questionsList]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={LightColors.primary} />
          <Text style={styles.loadingText}>正在载入题目...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backBtnText}>◀ 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {homeworkTitle}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>没有题目数据 💡</Text>
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
        const parsed = JSON.parse(currentQuestion.questionChooseInfo);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        const parts = currentQuestion.questionChooseInfo.split(/[;；,，]/).map(p => p.trim()).filter(Boolean);
        if (parts.length > 0) return parts;
      }
    }
    const content = currentQuestion.questionContent || '';
    if (content.includes('A.') || content.includes('A、')) {
      return ['A', 'B', 'C', 'D'];
    }
    return null;
  })();

  const renderAnswerArea = () => {
    const isVisible = !!showAnswersInline[currentQuestion.questionId];
    if (!isVisible) {
      return (
        <View style={styles.showAnswerPlaceholder}>
          <TouchableOpacity
            style={styles.showAnswerToggleBtn}
            onPress={() => setShowAnswersInline(prev => ({ ...prev, [currentQuestion.questionId]: true }))}
          >
            <Text style={styles.showAnswerToggleBtnText}>👁️ 显示答案与解析</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.reviewContentArea}>
        <View style={styles.reviewSection}>
          <View style={styles.reviewHeaderRow}>
            <Text style={styles.reviewLabel}>✅ 参考答案：</Text>
            <TouchableOpacity
              onPress={() => setShowAnswersInline(prev => ({ ...prev, [currentQuestion.questionId]: false }))}
              style={styles.hideAnswerBtn}
            >
              <Text style={styles.hideAnswerText}>隐藏 ▲</Text>
            </TouchableOpacity>
          </View>
          <Card style={styles.reviewCard}>
            <MathRenderer content={currentQuestion.questionAnswer || '暂无答案'} textColor="#10B981" />
          </Card>
        </View>
        <View style={[styles.reviewSection, { marginTop: 14 }]}>
          <Text style={styles.reviewLabel}>💡 题目解析：</Text>
          <Card style={styles.reviewCard}>
            <MathRenderer content={currentQuestion.questionAnalysis || '暂无解析'} textColor="#475569" />
          </Card>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 顶部 Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>◀ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {homeworkTitle}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* 题干部分 (Top Container) */}
      <QuestionViewer
        question={currentQuestion}
        currentIndex={currentIndex}
        totalCount={questions.length}
        options={options}
        isFavorite={isFavorite}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* 分割线与拖动手柄效果 */}
      <View style={styles.splitterLine}>
        <View style={styles.splitterHandle} />
      </View>

      {/* 作答区域 (Bottom Container) */}
      <View style={styles.bottomContainer}>
        <View style={styles.answerHeaderRow}>
          <Text style={styles.answerSectionTitle}>解答与解析</Text>
        </View>

        <ScrollView style={styles.answerScroll} contentContainerStyle={styles.answerScrollInner} showsVerticalScrollIndicator={false}>
          {renderAnswerArea()}
        </ScrollView>
      </View>

      {/* 底部翻页与控制条 */}
      <View style={styles.footerRow}>
        <View style={styles.navArrowsGroup}>
          <TouchableOpacity
            disabled={currentIndex === 0}
            style={[styles.roundNavBtn, currentIndex === 0 && styles.disabledRoundNavBtn]}
            onPress={() => setCurrentIndex(prev => prev - 1)}
          >
            <Text style={styles.roundNavText}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={currentIndex === questions.length - 1}
            style={[styles.roundNavBtn, currentIndex === questions.length - 1 && styles.disabledRoundNavBtn]}
            onPress={() => setCurrentIndex(prev => prev + 1)}
          >
            <Text style={styles.roundNavText}>▼</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerFunctionGroup}>
          <TouchableOpacity
            style={styles.footerFunctionBtn}
            onPress={handleOpenMiniClass}
          >
            <Text style={styles.footerFunctionBtnText}>📺 微课</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerFunctionBtn}
            onPress={handleViewAnswer}
          >
            <Text style={styles.footerFunctionBtnText}>🔑 答案</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerFunctionBtn}
            onPress={handleViewSimilar}
          >
            <Text style={styles.footerFunctionBtnText}>🔄 举一反三</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 查看答案 Modal */}
      <Modal
        visible={showAnswerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAnswerModal(false)}
      >
        <TouchableOpacity
          style={styles.webModalBackdrop}
          activeOpacity={1}
          onPress={() => setShowAnswerModal(false)}
        >
          <TouchableOpacity
            style={styles.webModalContent}
            activeOpacity={1}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>参考答案与解析 🔑</Text>
              <TouchableOpacity onPress={() => setShowAnswerModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.webModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.reviewLabel}>✅ 参考答案：</Text>
              <Card style={[styles.reviewCard, { marginBottom: 16 }]}>
                <MathRenderer content={currentQuestion.questionAnswer || '暂无答案'} textColor="#10B981" />
              </Card>

              <Text style={styles.reviewLabel}>💡 题目解析：</Text>
              <Card style={styles.reviewCard}>
                <MathRenderer content={currentQuestion.questionAnalysis || '暂无解析'} textColor="#475569" />
              </Card>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 举一反三 Modal */}
      <Modal
        visible={showSimilarModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSimilarModal(false)}
      >
        <TouchableOpacity
          style={styles.webModalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSimilarModal(false)}
        >
          <TouchableOpacity
            style={styles.webModalContent}
            activeOpacity={1}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>举一反三 (相似推荐) 🔄</Text>
              <TouchableOpacity onPress={() => setShowSimilarModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingSimilar ? (
              <View style={styles.similarLoadingContainer}>
                <ActivityIndicator size="large" color={LightColors.primary} />
                <Text style={styles.similarLoadingText}>正在寻找相似题目...</Text>
              </View>
            ) : (
              <ScrollView style={styles.webModalScroll} showsVerticalScrollIndicator={false}>
                {similarQuestions.length === 0 ? (
                  <Text style={styles.noSimilarText}>暂无相似推荐题目 📭</Text>
                ) : (
                  similarQuestions.map((q, idx) => (
                    <View key={q.id || idx} style={styles.similarCard}>
                      <View style={styles.similarCardHeader}>
                        <Text style={styles.similarCardTitle}>相似题 {idx + 1}</Text>
                        {q.similarity && (
                          <Text style={styles.similarityText}>
                            相似度: {Math.round(q.similarity * 100)}%
                          </Text>
                        )}
                      </View>
                      <View style={styles.similarCardBody}>
                        <MathRenderer content={q.question || q.content || q.title || ''} textColor="#0F172A" />
                      </View>
                      {q.answer && (
                        <View style={styles.similarCardAnswerArea}>
                          <Text style={styles.similarAnswerLabel}>答案：</Text>
                          <MathRenderer content={q.answer} textColor="#10B981" />
                        </View>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {questionAiContext ? (
        <GlobalAiAssistant
          hidden={showAnswerModal || showSimilarModal}
          visible={showAiAssistant}
          onVisibleChange={setShowAiAssistant}
          context={questionAiContext}
          mascotSource={EXERCISE_ASSISTANT}
          accessibilityLabel="打开当前题目的 AI 问答"
          prefillStorageKey={`EXERCISE_CHAT_PREFILL_${activeQuestion.questionId}`}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  splitterLine: {
    height: 10,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitterHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  bottomContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  answerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  answerSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  answerScroll: {
    flex: 1,
  },
  answerScrollInner: {
    padding: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: LightColors.border,
    backgroundColor: '#FFFFFF',
  },
  navArrowsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  roundNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  disabledRoundNavBtn: {
    opacity: 0.4,
  },
  roundNavText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: 'bold',
  },
  footerFunctionGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerFunctionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 3,
  },
  footerFunctionBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
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
  webModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webModalContent: {
    width: '90%',
    maxHeight: '75%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  webModalScroll: {
    marginTop: 10,
  },
  reviewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  reviewCard: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  similarLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarLoadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  noSimilarText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  similarCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  similarCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    paddingBottom: 6,
  },
  similarCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  similarityText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
  },
  similarCardBody: {
    marginBottom: 10,
  },
  similarCardAnswerArea: {
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingTop: 8,
    marginTop: 4,
  },
  similarAnswerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 4,
  },
  showAnswerPlaceholder: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showAnswerToggleBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  showAnswerToggleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  hideAnswerBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  hideAnswerText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
  },
  reviewContentArea: {
    marginTop: 6,
    width: '100%',
  },
  reviewSection: {
    width: '100%',
  },
});

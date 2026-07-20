import React, { useState, useEffect, useMemo } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MathRenderer } from '@/components/MathRenderer';
import { Card } from '@/components/Card';
import { HomeworkService, HomeworkQuestionDetail } from '@/services/homework-service';
import { MistakeService } from '@/services/mistake-service';
import { ExerciseService } from '@/services/exercise-service';
import { GlobalAiAssistant } from '@/features/ai-chat';
import type { AiChatContext } from '@/features/ai-chat';

interface HomeworkAnswerScreenProps {
  homeworkId?: string;
  homeworkTitle: string;
  homeworkSubject?: string;
  questionsList?: HomeworkQuestionDetail[];
  isReviewMode?: boolean;
  onBack: () => void;
}

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

// 纯 View 绘制的极简相机图标
const CameraIcon = () => (
  <View style={styles.cameraIconContainer}>
    <View style={styles.cameraTop} />
    <View style={styles.cameraBody}>
      <View style={styles.cameraLens} />
    </View>
  </View>
);

export function HomeworkAnswerScreen({
  homeworkId,
  homeworkTitle,
  homeworkSubject = '6',
  questionsList,
  isReviewMode = false,
  onBack,
}: HomeworkAnswerScreenProps) {
  const [questions, setQuestions] = useState<HomeworkQuestionDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 记录每个 questionId 的答案文本
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // 记录每个 questionId 的过程照片本地路径
  const [answersImage, setAnswersImage] = useState<Record<string, string>>({});
  // 是否显示答题卡检查面板
  const [showCheckPanel, setShowCheckPanel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 计算未答题数量
  const unansweredCount = questions.filter(q => {
    const textAns = (answers[q.questionId] || '').trim();
    const imgAns = (answersImage[q.questionId] || '').trim();
    return textAns === '' && imgAns === '';
  }).length;
  
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
      console.warn('[HomeworkAnswerScreen] 切换习题收藏失败:', e);
    }
  };

  // 加载作业题目详情
  useEffect(() => {
    if (questionsList && questionsList.length > 0) {
      setQuestions(questionsList);

      const initialAnswers: Record<string, string> = {};
      const initialImages: Record<string, string> = {};
      questionsList.forEach(q => {
        initialAnswers[q.questionId] = '';
        initialImages[q.questionId] = '';
      });
      setAnswers(initialAnswers);
      setAnswersImage(initialImages);
      setIsLoading(false);
      return;
    }

    async function loadDetails() {
      if (!homeworkId) return;
      setIsLoading(true);
      try {
        const list = await HomeworkService.getHomeworkDetailList(homeworkId);
        setQuestions(list);
        
        // 初始化答案和过程图
        const initialAnswers: Record<string, string> = {};
        const initialImages: Record<string, string> = {};
        list.forEach(q => {
          initialAnswers[q.questionId] = '';
          initialImages[q.questionId] = '';
        });
        setAnswers(initialAnswers);
        setAnswersImage(initialImages);
      } catch (error) {
        console.warn('[HomeworkAnswerScreen] 加载题目详情错误:', error);
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

  const handleSelectOption = (option: string) => {
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

  // (1) 拍照扫描/识别文本答案 (Mock OCR 逻辑)
  const handleScanTextAnswer = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('授权失败', '我们需要相机权限来拍摄照片！');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // 模拟识别出的三角形解答结果
        const mockResult = "c = 5";
        setAnswers(prev => ({
          ...prev,
          [currentQuestion.questionId]: mockResult,
        }));
        Alert.alert('识别成功', '已智能拍照识别解答结果并自动填入框内！');
      }
    } catch (e) {
      console.warn('[HomeworkAnswerScreen] 扫码拍照识别失败:', e);
    }
  };

  // (2) 拍照上传作答过程
  const handleSelectImageForProcess = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('授权失败', '我们需要相机权限来拍摄照片！');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setAnswersImage(prev => ({
          ...prev,
          [currentQuestion.questionId]: uri,
        }));
      }
    } catch (e) {
      console.warn('[HomeworkAnswerScreen] 拍照上传过程失败:', e);
    }
  };

  const handleClearImageForProcess = () => {
    setAnswersImage(prev => ({
      ...prev,
      [currentQuestion.questionId]: '',
    }));
  };

  // 清空本题全部输入
  const handleClearAllCurrent = () => {
    Alert.alert(
      '确认清空',
      '确定要清空本题的所有解答内容吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => {
            setAnswers(prev => ({ ...prev, [currentQuestion.questionId]: '' }));
            setAnswersImage(prev => ({ ...prev, [currentQuestion.questionId]: '' }));
          }
        }
      ]
    );
  };

  // 检查已答题进度情况
  const handleCheck = () => {
    setShowCheckPanel(true);
  };

  // 提交整份作业
  const handleSubmit = async () => {
    if (!homeworkId) return;

    setIsSubmitting(true);
    try {
      const questionAnswerList = questions.map(q => {
        const answerText = answers[q.questionId] || '';
        const answerImg = answersImage[q.questionId] || '';
        // 接口中 answerData 是数组，将文字答案和图片URI一并打包发送以防丢失
        return {
          questionId: q.questionId,
          answerData: answerImg ? [answerText, answerImg] : [answerText],
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
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* 题干部分 (Top Container) */}
      <View style={styles.topContainer}>
        <View style={styles.questionTagRow}>
          <View style={styles.questionTypeTag}>
            <Text style={styles.questionTypeTagText}>
              {options ? '选择题' : '解答题'}
            </Text>
          </View>
          <Text style={styles.progressText}>
            第 {currentIndex + 1} / {questions.length} 题
          </Text>
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

        <ScrollView style={styles.questionScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.mathContainer}>
            <MathRenderer content={currentQuestion.questionContent} textColor="#0F172A" />
          </View>
        </ScrollView>
      </View>

      {/* 分割线与拖动手柄效果 */}
      <View style={styles.splitterLine}>
        <View style={styles.splitterHandle} />
      </View>

      {/* 作答区域 (Bottom Container) */}
      <View style={styles.bottomContainer}>
        <View style={styles.answerHeaderRow}>
          <Text style={styles.answerSectionTitle}>
            {isReviewMode ? '解答与解析' : '作答区域'}
          </Text>
          {!isReviewMode && (
            <TouchableOpacity onPress={handleClearAllCurrent}>
              <Text style={styles.clearAllBtnText}>清空全部</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.answerScroll} contentContainerStyle={styles.answerScrollInner} showsVerticalScrollIndicator={false}>
          {isReviewMode ? (
            <View style={styles.reviewContentArea}>
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>✅ 参考答案：</Text>
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
          ) : options ? (
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
            // 解答主观题分步作答渲染
            <View style={styles.subjectiveAnswerArea}>
              {/* (1) 填写答案 */}
              <View style={styles.answerPart}>
                <Text style={styles.partLabel}>(1) 填写答案:</Text>
                <View style={styles.inputTextRow}>
                  <TextInput
                    style={styles.textInputShort}
                    placeholder="请输入计算结果..."
                    value={answers[currentQuestion.questionId]}
                    onChangeText={handleTextAnswerChange}
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity style={styles.cameraIconBtn} onPress={handleScanTextAnswer}>
                    <CameraIcon />
                  </TouchableOpacity>
                </View>
              </View>

              {/* (2) 拍照上传过程 */}
              <View style={[styles.answerPart, { marginTop: 16 }]}>
                <Text style={styles.partLabel}>(2) 拍照上传过程:</Text>
                <TouchableOpacity style={styles.photoUploadBox} onPress={handleSelectImageForProcess}>
                  {answersImage[currentQuestion.questionId] ? (
                    <View style={styles.uploadedPhotoWrapper}>
                      <Image
                        source={{ uri: answersImage[currentQuestion.questionId] }}
                        style={styles.uploadedPhoto}
                        resizeMode="contain"
                      />
                      <TouchableOpacity style={styles.deletePhotoBtn} onPress={handleClearImageForProcess}>
                        <Text style={styles.deletePhotoText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <View style={[styles.cameraIconContainer, { transform: [{ scale: 1.2 }], marginBottom: 6 }]}>
                        <View style={styles.cameraTop} />
                        <View style={styles.cameraBody}>
                          <View style={styles.cameraLens} />
                        </View>
                      </View>
                      <Text style={styles.uploadPlaceholderText}>拍摄照片</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
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

        {isReviewMode ? (
          <>
            <TouchableOpacity style={styles.reviewBackBtn} onPress={onBack}>
              <Text style={styles.reviewBackText}>关闭退出</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.checkBtn} onPress={handleCheck}>
              <Text style={styles.checkBtnText}>检查</Text>
            </TouchableOpacity>

            {currentIndex === questions.length - 1 ? (
              <TouchableOpacity
                style={styles.submitBtnStyle}
                disabled={isSubmitting}
                onPress={handleSubmit}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnTextStyle}>确认提交</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.submitBtnStyle}
                onPress={() => setCurrentIndex(prev => prev + 1)}
              >
                <Text style={styles.submitBtnTextStyle}>下一题</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* 答题卡检查面板 (Bottom Sheet) */}
      {showCheckPanel && (
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.backdropClickArea} onPress={() => setShowCheckPanel(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>答题卡检查 📋</Text>
              <TouchableOpacity onPress={() => setShowCheckPanel(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSummary}>
              共 {questions.length} 题，已答 <Text style={{ color: LightColors.success, fontWeight: 'bold' }}>{questions.length - unansweredCount}</Text> 题，未答 <Text style={{ color: LightColors.danger, fontWeight: 'bold' }}>{unansweredCount}</Text> 题
            </Text>

            <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
              {questions.map((q, idx) => {
                const textAns = (answers[q.questionId] || '').trim();
                const imgAns = (answersImage[q.questionId] || '').trim();
                const isAnswered = textAns !== '' || imgAns !== '';
                const isCurrent = idx === currentIndex;

                return (
                  <TouchableOpacity
                    key={q.questionId}
                    style={[
                      styles.gridItem,
                      isAnswered ? styles.gridItemAnswered : styles.gridItemUnanswered,
                      isCurrent && styles.gridItemCurrent
                    ]}
                    onPress={() => {
                      setCurrentIndex(idx);
                      setShowCheckPanel(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.gridItemText,
                        isAnswered ? styles.gridItemTextAnswered : styles.gridItemTextUnanswered,
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
      )}
      {questionAiContext ? (
        <GlobalAiAssistant
          hidden={showCheckPanel}
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
  headerRightPlaceholder: {
    width: 60,
  },

  // 拆分容器布局
  topContainer: {
    flex: 1.1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  questionTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionTypeTag: {
    backgroundColor: LightColors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 10,
  },
  questionTypeTagText: {
    color: LightColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: LightColors.textSecondary,
    flex: 1,
  },
  favoriteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
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
  questionScroll: {
    flex: 1,
  },
  mathContainer: {
    marginTop: 4,
  },

  // 分割线拖动手柄
  splitterLine: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitterHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },

  // 下部作答容器
  bottomContainer: {
    flex: 1.3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  answerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
  },
  answerSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LightColors.textPrimary,
  },
  clearAllBtnText: {
    fontSize: 13,
    color: LightColors.textSecondary,
  },
  answerScroll: {
    flex: 1,
  },
  answerScrollInner: {
    paddingBottom: 20,
  },

  // 选择题列表
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
    backgroundColor: 'rgba(79, 70, 229, 0.04)',
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

  // 简答主观题作答区域样式
  subjectiveAnswerArea: {
    marginTop: 6,
  },
  answerPart: {
    width: '100%',
  },
  partLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '600',
  },
  inputTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInputShort: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: LightColors.textPrimary,
    marginRight: 12,
  },
  cameraIconBtn: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 纯 View 的相机图标样式
  cameraIconContainer: {
    width: 20,
    height: 14,
    backgroundColor: '#475569',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cameraTop: {
    width: 8,
    height: 3,
    backgroundColor: '#475569',
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    position: 'absolute',
    top: -3,
  },
  cameraBody: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraLens: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#475569',
  },

  // 拍照上传框
  photoUploadBox: {
    width: '100%',
    height: 160,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPlaceholderText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  uploadedPhotoWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },
  uploadedPhoto: {
    width: '100%',
    height: '100%',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletePhotoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -2,
  },

  // 底部控制栏
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
        elevation: 1,
      },
    }),
  },
  disabledRoundNavBtn: {
    opacity: 0.3,
    backgroundColor: '#F1F5F9',
  },
  roundNavText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: 'bold',
  },
  checkBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  submitBtnStyle: {
    flex: 1.4,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  submitBtnTextStyle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // 答题卡检查面板样式
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '60%',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
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
  modalSummary: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 16,
    lineHeight: 18,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingBottom: 20,
  },
  gridItem: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  gridItemAnswered: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: '#10B981',
  },
  gridItemUnanswered: {
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  gridItemCurrent: {
    borderColor: '#4F46E5',
    borderWidth: 2,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  gridItemText: {
    fontSize: 14,
    fontWeight: '700',
  },
  gridItemTextAnswered: {
    color: '#10B981',
  },
  gridItemTextUnanswered: {
    color: '#94A3B8',
  },
  gridItemTextCurrent: {
    color: '#4F46E5',
  },
  // 题库复习查看解析模式样式
  reviewContentArea: {
    marginTop: 6,
    width: '100%',
  },
  reviewSection: {
    width: '100%',
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
  reviewBackBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewBackText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
});

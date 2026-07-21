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
import { Card } from '@/components/Card';
import { QuestionViewer } from '@/components/QuestionViewer';
import { MathRenderer } from '@/components/MathRenderer';
import { HomeworkService, HomeworkQuestionDetail } from '@/services/homework-service';
import { MistakeService } from '@/services/mistake-service';
import { ExerciseService, ExerciseItem } from '@/services/exercise-service';
import { useRoute, useNavigation } from '@react-navigation/native';
import { storage } from '@/services/storage';
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

// 纯 View 绘制的极简相机图标
const CameraIcon = () => (
  <View style={styles.cameraIconContainer}>
    <View style={styles.cameraTop} />
    <View style={styles.cameraBody}>
      <View style={styles.cameraLens} />
    </View>
  </View>
);

export function HomeworkSolveScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const {
    homeworkId,
    homeworkTitle,
    homeworkSubject = '6',
    questionsList,
    initialIndex = 0,
    isSubmitted = false,
  }: {
    homeworkId: string;
    homeworkTitle: string;
    homeworkSubject?: string;
    questionsList?: HomeworkQuestionDetail[];
    initialIndex?: number;
    isSubmitted?: boolean;
  } = route.params || {};

  const handleBack = () => {
    navigation.goBack();
  };

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
      console.warn('[HomeworkSolveScreen] 切换习题收藏失败:', e);
    }
  };

  // 加载作业题目详情与作答历史记录
  useEffect(() => {
    async function loadWithHistory(list: HomeworkQuestionDetail[]) {
      const initialAnswers: Record<string, string> = {};
      const initialImages: Record<string, string> = {};
      list.forEach(q => {
        initialAnswers[q.questionId] = '';
        initialImages[q.questionId] = '';
      });

      try {
        const localMistakes = await MistakeService.getMistakes();
        list.forEach(q => {
          const matchedMistake = localMistakes.find(m => m.bmNo === q.questionId);
          if (matchedMistake && matchedMistake.practiceHistory && matchedMistake.practiceHistory.length > 0) {
            const homeworkHistory = matchedMistake.practiceHistory
              .filter(h => h.homeworkId === homeworkId)
              .sort((a, b) => b.timestamp - a.timestamp);
            
            if (homeworkHistory.length > 0) {
              const latestRecord = homeworkHistory[0];
              const originalAns = latestRecord.originalAnswer as { studentAnswer?: string; studentImage?: string } | undefined;
              if (originalAns) {
                if (originalAns.studentAnswer !== undefined) {
                  initialAnswers[q.questionId] = originalAns.studentAnswer;
                }
                if (originalAns.studentImage !== undefined) {
                  initialImages[q.questionId] = originalAns.studentImage;
                }
              }
            }
          }
        });
      } catch (err) {
        console.warn('[HomeworkSolveScreen] 预加载本地作答历史失败:', err);
      }

      setAnswers(initialAnswers);
      setAnswersImage(initialImages);
    }

    if (questionsList && questionsList.length > 0) {
      setQuestions(questionsList);
      if (initialIndex >= 0 && initialIndex < questionsList.length) {
        setCurrentIndex(initialIndex);
      }
      loadWithHistory(questionsList).then(() => {
        setIsLoading(false);
      });
      return;
    }

    async function loadDetails() {
      if (!homeworkId) return;
      setIsLoading(true);
      try {
        const list = await HomeworkService.getHomeworkDetailList(homeworkId);
        setQuestions(list);
        await loadWithHistory(list);
      } catch (error) {
        console.warn('[HomeworkSolveScreen] 加载题目详情错误:', error);
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
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
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

  // 拍照扫描/识别文本答案 (Mock OCR 逻辑)
  const handleScanTextAnswer = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('提示', '请允许开启摄像头权限以进行扫描识字 📸');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        Alert.alert('扫描成功', '已模拟OCR自动识字提取文本');
        setAnswers(prev => ({
          ...prev,
          [currentQuestion.questionId]: '已模拟扫描提取得到的作答文本：通过手写OCR自动扫描获取。'
        }));
      }
    } catch (e) {
      console.warn('[HomeworkSolveScreen] 扫码拍照识别失败:', e);
    }
  };

  // 拍摄解答过程图
  const handleUploadImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('提示', '请允许开启相机权限以拍摄解答过程 📸');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.6,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imagePath = result.assets[0].uri;
        setAnswersImage(prev => ({
          ...prev,
          [currentQuestion.questionId]: imagePath,
        }));
      }
    } catch (e) {
      console.warn('[HomeworkSolveScreen] 拍照上传过程失败:', e);
    }
  };

  const handleDeleteImage = () => {
    setAnswersImage(prev => ({
      ...prev,
      [currentQuestion.questionId]: '',
    }));
  };

  // 校验当前回答，进行静态提醒
  const handleCheck = () => {
    const textAns = (answers[currentQuestion.questionId] || '').trim();
    const imgAns = (answersImage[currentQuestion.questionId] || '').trim();
    if (textAns === '' && imgAns === '') {
      Alert.alert('提醒', '您目前还没有在该题写下任何作答或拍摄过程哦 ✏️');
    } else {
      Alert.alert('已作答', '当前题目已填充作答，确认提交前可以继续修改。');
    }
  };

  const handleClearAllCurrent = () => {
    setAnswers(prev => ({ ...prev, [currentQuestion.questionId]: '' }));
    setAnswersImage(prev => ({ ...prev, [currentQuestion.questionId]: '' }));
  };

  // 提交整份作业
  const handleSubmit = async () => {
    if (unansweredCount > 0) {
      Alert.alert(
        '确认提交',
        `您还有 ${unansweredCount} 道题未作答，确定要提交吗？`,
        [
          { text: '检查看看', style: 'cancel', onPress: () => setShowCheckPanel(true) },
          { text: '强制提交', style: 'destructive', onPress: performSubmit }
        ]
      );
    } else {
      Alert.alert(
        '确认提交',
        '您已完成全部题目，确定要提交作业吗？',
        [
          { text: '取消', style: 'cancel' },
          { text: '确定提交', onPress: performSubmit }
        ]
      );
    }
  };

  const performSubmit = async () => {
    if (!homeworkId) {
      Alert.alert('错误', '找不到作业ID');
      return;
    }
    setIsSubmitting(true);
    try {
      const submissions = questions.map(q => {
        const textAns = answers[q.questionId] || '';
        const imgAns = answersImage[q.questionId] || '';
        const isChoice = q.questionChooseList && q.questionChooseList.length > 0;
        
        return {
          questionId: q.questionId,
          answerData: isChoice ? [] : [textAns],
          answerList: isChoice ? [] : (imgAns ? [imgAns] : []),
          chooseList: isChoice ? [textAns] : [],
        };
      });

      const success = await HomeworkService.submitHomework({
        homeworkId,
        questionAnswerList: submissions,
      });

      if (success) {
        // 同步存入本地错题本
        for (const q of questions) {
          const textAns = answers[q.questionId] || '';
          const imgAns = answersImage[q.questionId] || '';
          const exercise: ExerciseItem = {
            id: q.questionId,
            title: q.questionContent.substring(0, 15).replace(/<[^>]+>/g, '').trim() + '...',
            subject: homeworkSubject,
            content: q.questionContent,
            answer: q.questionAnswer || '',
            analysis: q.questionAnalysis || '暂无解析',
            timestamp: Date.now(),
          };
          try {
            await MistakeService.addMistake({
              bmNo: q.questionId,
              homeworkId: homeworkId,
              homeworkName: homeworkTitle,
              questionData: exercise,
              originalAnswer: {
                studentAnswer: textAns,
                studentImage: imgAns,
              }
            });
          } catch (mistakeErr) {
            console.warn('[HomeworkSolveScreen] 自动同步错题本失败:', mistakeErr);
          }
        }

        Alert.alert('提交成功', '您的作业已经成功保存并提交！🎉', [
          { text: '确定', onPress: handleBack }
        ]);
      } else {
        Alert.alert('失败', '作业提交保存失败，请稍后重试');
      }
    } catch (e) {
      console.warn('[HomeworkSolveScreen] 提交作业异常:', e);
      Alert.alert('错误', '提交作业接口连接异常');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderAnswerArea = () => {
    const textAns = (answers[currentQuestion.questionId] || '').trim();
    const imgAns = (answersImage[currentQuestion.questionId] || '').trim();
    const hasHistory = textAns !== '' || imgAns !== '';

    const interactionNode = options ? (
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
      <View style={styles.subjectiveArea}>
        {/* 输入文本答题框 */}
        <View style={styles.textAreaBox}>
          <TextInput
            multiline
            numberOfLines={4}
            style={styles.textInputStyle}
            placeholder="请在此输入您的作谈文本或答案... ✏️"
            placeholderTextColor="#94A3B8"
            value={answers[currentQuestion.questionId] || ''}
            onChangeText={handleTextAnswerChange}
          />
          <TouchableOpacity style={styles.ocrScanTrigger} onPress={handleScanTextAnswer}>
            <Text style={styles.ocrScanTriggerText}>📷 扫图识字</Text>
          </TouchableOpacity>
        </View>

        {/* 上传解答照片过程 */}
        <View style={styles.photoContainer}>
          <Text style={styles.photoLabelText}>📷 过程照片（选填，用于老师查阅解答步骤）：</Text>
          <TouchableOpacity
            style={[styles.photoUploadBtn, imgAns !== '' && styles.photoUploadBtnHasPhoto]}
            onPress={imgAns ? undefined : handleUploadImage}
            activeOpacity={0.8}
          >
            {imgAns ? (
              <View style={styles.uploadedPhotoWrapper}>
                <Image source={{ uri: imgAns }} style={styles.uploadedPhotoImage} />
                <TouchableOpacity style={styles.deletePhotoBadge} onPress={handleDeleteImage}>
                  <Text style={styles.deletePhotoText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <CameraIcon />
                <Text style={styles.uploadPlaceholderText}>拍摄照片</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );

    return (
      <View style={{ width: '100%' }}>
        {interactionNode}

        {/* 如果该题已经作答（有历史记录），且存在答案/解析，则在下方显示参考答案与解析 */}
        {hasHistory && (
          <View style={styles.correctAnswerSection}>
            <Text style={styles.correctAnswerTitle}>✅ 参考答案：</Text>
            <Card style={styles.correctAnswerCard}>
              <MathRenderer content={currentQuestion.questionAnswer || '暂无答案'} textColor="#10B981" />
            </Card>
            {currentQuestion.questionAnalysis ? (
              <>
                <Text style={[styles.correctAnswerTitle, { marginTop: 14 }]}>💡 题目解析：</Text>
                <Card style={styles.correctAnswerCard}>
                  <MathRenderer content={currentQuestion.questionAnalysis} textColor="#475569" />
                </Card>
              </>
            ) : null}
          </View>
        )}
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
        <View style={styles.headerRightPlaceholder} />
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
          <Text style={styles.answerSectionTitle}>作答区域</Text>
          <TouchableOpacity onPress={handleClearAllCurrent}>
            <Text style={styles.clearAllBtnText}>清空全部</Text>
          </TouchableOpacity>
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

        {!isSubmitted && (
          <>
            <TouchableOpacity style={styles.checkBtn} onPress={handleCheck}>
              <Text style={styles.checkBtnText}>检查</Text>
            </TouchableOpacity>

            {currentIndex === questions.length - 1 && (
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
  headerRightPlaceholder: {
    width: 64,
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
    justifyContent: 'space-between',
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
  clearAllBtnText: {
    fontSize: 12,
    color: LightColors.danger,
    fontWeight: '600',
  },
  answerScroll: {
    flex: 1,
  },
  answerScrollInner: {
    padding: 16,
  },
  optionsList: {
    width: '100%',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  activeOptionItem: {
    borderColor: '#4F46E5',
    backgroundColor: 'rgba(79, 70, 229, 0.04)',
  },
  optionIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activeOptionIndicator: {
    borderColor: '#4F46E5',
    backgroundColor: '#4F46E5',
  },
  optionIndicatorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  activeOptionIndicatorText: {
    color: '#FFFFFF',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  activeOptionText: {
    color: '#4F46E5',
  },
  subjectiveArea: {
    width: '100%',
  },
  textAreaBox: {
    width: '100%',
    minHeight: 120,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    position: 'relative',
    marginBottom: 16,
  },
  textInputStyle: {
    fontSize: 14,
    color: '#1E293B',
    textAlignVertical: 'top',
    paddingBottom: 28,
  },
  ocrScanTrigger: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  ocrScanTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  photoContainer: {
    width: '100%',
  },
  photoLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  photoUploadBtn: {
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoUploadBtnHasPhoto: {
    borderStyle: 'solid',
    borderColor: '#E2E8F0',
  },
  cameraIconContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  cameraTop: {
    width: 14,
    height: 3,
    backgroundColor: '#94A3B8',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  cameraBody: {
    width: 26,
    height: 18,
    backgroundColor: '#94A3B8',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraLens: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#94A3B8',
  },
  uploadPlaceholderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  uploadedPhotoWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  uploadedPhotoImage: {
    width: '100%',
    height: '100%',
  },
  deletePhotoBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
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
  checkBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  submitBtnStyle: {
    flex: 1.5,
    height: 44,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnTextStyle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
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
    width: 46,
    height: 46,
    borderRadius: 23,
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
  correctAnswerSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  correctAnswerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  correctAnswerCard: {
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

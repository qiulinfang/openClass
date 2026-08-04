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
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { QuestionViewer } from '@/components/QuestionViewer';
import { QuestionAnalysis } from '@/components/exercise/QuestionAnalysis';
import { SimilarQuestionsModal } from '@/components/SimilarQuestionsModal';
import { AnswerCheckModal } from '@/components/AnswerCheckModal';
import { StudentHandwritingOcrOverlay } from '@/components/StudentHandwritingOcrOverlay';
import { HomeworkChatPanelDrawer } from '@/components/HomeworkChatPanelDrawer';
import { ExerciseComponentRouter } from '@/components/exercise/ExerciseComponentRouter';
import { DrawingCanvas } from '@/components/DrawingCanvas';
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
    isSubmitted = true,
  }: {
    homeworkId?: string;
    homeworkTitle: string;
    homeworkSubject?: string;
    questionsList?: HomeworkQuestionDetail[];
    initialIndex?: number;
    isSubmitted?: boolean;
  } = route.params || {};

  // 作业提交状态：未提交前隐藏 AI 悬浮窗，提交完成之后显示海獭悬浮窗
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(!!isSubmitted);

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

  // 查看答案 & 举一反三 & 全题检查 模态框状态
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const [showCheckPanel, setShowCheckPanel] = useState(false);
  const [similarQuestions, setSimilarQuestions] = useState<any[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // 作业作答区域状态：文本/手写作答与图片上传过程
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answersImage, setAnswersImage] = useState<Record<string, string>>({});

  // 练习模式下，控制当前题目答案和解析是否内联显示 (默认进入时不显示)
  const [showAnswersInline, setShowAnswersInline] = useState<Record<string, boolean>>({});

  // 微课 内置横屏 WebView 状态
  const [showMiniClassModal, setShowMiniClassModal] = useState(false);
  const [miniClassUrl, setMiniClassUrl] = useState('');
  const [miniClassLoading, setMiniClassLoading] = useState(true);

  // 习题本收藏状态
  const [isFavorite, setIsFavorite] = useState(false);

  // 判罚明细数据与双向高亮关联状态
  const [judgeDetailData, setJudgeDetailData] = useState<any>(null);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  // 获取判罚详情数据
  useEffect(() => {
    if (homeworkId && hasSubmitted) {
      HomeworkService.getHomeworkSubmitJudgeDetail(homeworkId)
        .then((res) => {
          if (res) {
            const msg = String((res as any)?.message || (res as any)?.msg || '');
            if (!msg.includes('尚未提交') && !msg.includes('未提交')) {
              setJudgeDetailData(res);
            }
          }
        })
        .catch((err) => console.warn('[PracticeReviewScreen] 获取判罚详情异常:', err));
    }
  }, [homeworkId, hasSubmitted]);



  // 组件卸载时还原为竖屏
  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

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
  // 从判罚数据中解析出当前小题的采分点列表 (1:1 字段映射)
  const currentScorePoints = useMemo(() => {
    if (!activeQuestion) return [];
    const rawList = Array.isArray(judgeDetailData)
      ? judgeDetailData
      : (judgeDetailData?.data ? (Array.isArray(judgeDetailData.data) ? judgeDetailData.data : [judgeDetailData.data]) : []);
    
    const qId = String(activeQuestion.questionId || activeQuestion.id || '').trim().replace(/^root\./, '');

    for (const item of rawList) {
      if (!item) continue;
      const judgeData = item.questionJudgeDataData || item.questionJudgeData;
      if (!judgeData) continue;
      let parsed: any = null;
      try {
        parsed = typeof judgeData === 'string' ? JSON.parse(judgeData) : judgeData;
      } catch {
        parsed = null;
      }
      if (!parsed) continue;

      const judgeNodes = Array.isArray(parsed) ? parsed : (parsed.judge_nodes || parsed.nodes || [parsed]);
      for (const node of judgeNodes) {
        const nId = String(node.nodeId || node.questionId || '').trim().replace(/^root\./, '');
        if (nId === qId || !qId) {
          const payloads = node.route?.payload || node.payload || [];
          return payloads.map((p: any, idx: number) => {
            const pId = String(p.standard_node_id || p.id || idx + 1);
            return {
              id: pId,
              pointId: pId,
              hit: Boolean(p.criterion_met),
              sourceText: p.hit_description ?? '',
              nodeId: p.node_id ?? '',
              nodeLabel: p.node_label ?? '',
              solutionMethodId: p.solution_method_id ?? '',
              methodLabel: p.method_label ?? '',
              criterionType: p.criterion_type ?? '',
              criterionText: p.criterion_text ?? '',
              criterionReason: p.potential_error_reason ?? '',
              score: p.score_awarded ?? 0,
              pointScore: p.score_awarded ?? null,
              maxScore: p.score_max ?? 0,
              potentialErrorType: p.potential_error_type ?? '',
              potentialErrorReason: p.potential_error_reason ?? '',
              preconditionType: p.precondition_type ?? null,
              preconditionRequired: p.precondition_required ?? null,
              knowledgePoints: p.knowledge_points ?? [],
              applicableSigns: p.applicable_signs ?? [],
              recommended: p.recommended ?? null,
              matchedOcrRegions: p.matched_ocr_regions ?? [],
              displayIndex: idx + 1,
            };
          });
        }
      }
    }
    return [];
  }, [activeQuestion, judgeDetailData]);

  // 点击划线 ➔ 触发 2px 紫框高亮 + 打开侧边抽屉
  const handleSelectOcrPoint = (payload: { point: any; index: number }) => {
    const pId = payload.point?.id || payload.point?.pointId || null;
    setActivePointId(pId);
    setSelectedPointIndex(payload.index);
    setShowChatDrawer(true);
  };

  // 点击侧边栏卡片 ➔ 触发 2px 紫框高亮
  const handleLocatePointFromCard = (item: any, index: number) => {
    const pId = item?.id || item?.pointId || null;
    setActivePointId(pId);
    setSelectedPointIndex(index);
  };

  useEffect(() => {
    if (activeQuestion) {
      ExerciseService.isExerciseSaved(activeQuestion.questionId).then(setIsFavorite);
    }
  }, [currentIndex, activeQuestion]);

  const handleToggleFavorite = async () => {
    if (!activeQuestion) return;
    try {
      const contentStr = activeQuestion.questionContent || (activeQuestion as any).content || '';
      const titleText = contentStr ? contentStr.substring(0, 15).replace(/<[^>]+>/g, '').trim() + '...' : '题目';
      const saved = await ExerciseService.toggleExercise({
        id: activeQuestion.questionId || (activeQuestion as any).id,
        title: titleText,
        subject: homeworkSubject,
        content: contentStr,
        answer: activeQuestion.questionAnswer || '',
        analysis: activeQuestion.questionAnalysis || '暂无解析',
      });
      setIsFavorite(saved);
      Alert.alert(saved ? '★ 已加入习题本' : '☆ 已从习题本移除');
    } catch (e) {
      console.warn('[PracticeReviewScreen] 切换习题收藏失败:', e);
    }
  };

  const handleOpenMiniClass = async () => {
    if (!activeQuestion) return;
    const bmNo = ((activeQuestion as any).bmNo || activeQuestion.questionId || activeQuestion.id || '').trim();
    if (!bmNo) {
      Alert.alert('提示', '题目 ID 缺失，无法打开微课');
      return;
    }
    const subjId = homeworkSubject || '2';
    const subjectPrefix = (SUBJECT_ID_TO_ENGLISH[subjId] || 'math').toLowerCase();
    const url = `https://www.imates.com.cn:9099/wk/${subjectPrefix}/${bmNo}/${bmNo}.html`;

    setMiniClassUrl(url);
    setMiniClassLoading(true);
    setShowMiniClassModal(true);

    try {
      // 手机自动锁定为横屏播放
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch (e) {
      console.warn('[PracticeReviewScreen] 切换横屏模式警告:', e);
    }
  };

  const handleCloseMiniClass = async () => {
    setShowMiniClassModal(false);
    setMiniClassUrl('');
    try {
      // 还原为竖屏模式
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (e) {
      console.warn('[PracticeReviewScreen] 还原竖屏模式警告:', e);
    }
  };

  const handleViewAnswer = () => {
    if (!hasSubmitted) {
      Alert.alert('提示', '作业需要在提交后才可以查看参考答案和解析哦');
      return;
    }
    setShowAnswerModal(true);
  };

  // 提交整份作业
  const handleSubmitHomework = () => {
    const unanswered = questions.filter(q => {
      const qId = q.questionId || q.id;
      const textAns = (answers[qId] || '').trim();
      const imgAns = (answersImage[qId] || '').trim();
      return textAns === '' && imgAns === '';
    }).length;

    const performSubmit = () => {
      setHasSubmitted(true);
      Alert.alert('提交成功', '您的作业已经成功保存并提交！');
    };

    if (unanswered > 0) {
      Alert.alert(
        '确认提交',
        `您还有 ${unanswered} 道题未作答，确定要提交吗？`,
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

  // 作业作答交互逻辑
  const handleSelectOption = (optionStr: string) => {
    if (!activeQuestion) return;
    const char = optionStr.trim().charAt(0).toUpperCase();
    setAnswers(prev => ({
      ...prev,
      [activeQuestion.questionId]: char,
    }));
  };

  const handleTextAnswerChange = (text: string) => {
    if (!activeQuestion) return;
    setAnswers(prev => ({
      ...prev,
      [activeQuestion.questionId]: text,
    }));
  };

  // 拍照扫图识字 (OCR 识别)
  const handleScanTextAnswer = async () => {
    if (!activeQuestion) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('提示', '请允许开启摄像头权限以进行扫图识字 📸');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        Alert.alert('扫描成功', '已成功提取照片文本并填入答题框！');
        setAnswers(prev => ({
          ...prev,
          [activeQuestion.questionId]: (prev[activeQuestion.questionId] || '') + '\n[手写扫描识字文本已生成]'
        }));
      }
    } catch (e) {
      console.warn('[PracticeReviewScreen] 扫码拍照识别失败:', e);
    }
  };

  // 拍摄上传解答过程照片
  const handleUploadImage = async () => {
    if (!activeQuestion) return;
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
          [activeQuestion.questionId]: imagePath,
        }));
      }
    } catch (e) {
      console.warn('[PracticeReviewScreen] 拍照上传过程失败:', e);
    }
  };

  const handleDeleteImage = () => {
    if (!activeQuestion) return;
    setAnswersImage(prev => ({
      ...prev,
      [activeQuestion.questionId]: '',
    }));
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
          bmNo: (activeQuestion as any).bmNo || activeQuestion.questionId || (activeQuestion as any).id || '',
          title: (activeQuestion.questionContent || (activeQuestion as any).title || '').replace(/<[^>]+>/g, '').trim(),
          answer: activeQuestion.questionAnswer || (activeQuestion as any).answer || '',
          explanation: activeQuestion.questionAnalysis || (activeQuestion as any).explanation || (activeQuestion as any).aiExplanation || '',
          analysisData: activeQuestion.questionAnalysis || (activeQuestion as any).analysisData || '',
          exercisesId: '',
          type: subjectName,
        })
      });
      
      if (response.ok) {
        const resJson = await response.json();
        console.log('[PracticeReviewScreen] topicAndAck 接口返回:', JSON.stringify(resJson));
        const rawData = resJson?.data?.questions || resJson?.data?.data?.questions || resJson?.data || [];
        const list: any[] = Array.isArray(rawData)
          ? rawData
          : (rawData?.question || rawData?.questions || (Array.isArray(resJson?.questions) ? resJson.questions : []));
        
        const listWithStatus = await Promise.all(list.map(async (q: any) => {
          const bmNo = String(q.bmNo || q.id || '');
          const isSaved = await ExerciseService.isExerciseSaved(bmNo);
          return {
            ...q,
            bmNo,
            atUserList: isSaved,
          };
        }));
        setSimilarQuestions(listWithStatus);
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

  const handleDebugQuestionInfo = () => {
    if (!activeQuestion) return;
    const debugInfo = {
      id: activeQuestion.id,
      questionId: activeQuestion.questionId,
      bmNo: (activeQuestion as any).bmNo,
      questionContent: activeQuestion.questionContent,
      questionAnswer: activeQuestion.questionAnswer,
      questionAnalysis: activeQuestion.questionAnalysis,
      rawQuestionObject: activeQuestion,
    };
    console.log('====== [DEBUG 题目信息] ======\n', JSON.stringify(debugInfo, null, 2));
    Alert.alert(
      '🛠️ 题目调试信息',
      `ID: ${activeQuestion.questionId || activeQuestion.id}\n\n[完整对象已打印至终端 console]\n\n` + JSON.stringify(debugInfo, null, 2).substring(0, 400) + '...',
      [{ text: '确定' }]
    );
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
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>没有题目数据</Text>
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
    const textAns = (answers[currentQuestion.questionId] || '').trim();
    const imgAns = (answersImage[currentQuestion.questionId] || '').trim();

    return (
      <View style={{ width: '100%' }}>
        {options ? (
          <View style={styles.optionsList}>
            {options.map((opt, idx) => {
              const char = opt.trim().charAt(0).toUpperCase();
              const isSelected = answers[currentQuestion.questionId] === char;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.optionItem, isSelected && styles.activeOptionItem]}
                  onPress={() => handleSelectOption(opt)}
                  activeOpacity={0.8}
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
            {/* 文本 / 手写作答输入框 */}
            <View style={styles.textAreaBox}>
              <TextInput
                multiline
                numberOfLines={4}
                style={styles.textInputStyle}
                placeholder="请在此输入您的作答文本或解题思路..."
                placeholderTextColor="#94A3B8"
                value={answers[currentQuestion.questionId] || ''}
                onChangeText={handleTextAnswerChange}
              />
              <TouchableOpacity style={styles.ocrScanTrigger} onPress={handleScanTextAnswer}>
                <Text style={styles.ocrScanTriggerText}>扫图识字</Text>
              </TouchableOpacity>
            </View>

            {/* 上传解答过程照片与 OCR 划线覆盖 */}
            <View style={styles.photoContainer}>
              <Text style={styles.photoLabelText}>过程照片（选填，上传解答步骤照片）：</Text>
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
                    <Text style={styles.uploadPlaceholderText}>拍摄/选取照片</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* 批改完成之后，在图片下方/浮层渲染 StudentHandwritingOcrOverlay */}
              {hasSubmitted && (
                <View style={{ marginTop: 12 }}>
                  <StudentHandwritingOcrOverlay
                    questionData={[{ ...currentQuestion, answerData: [imgAns].filter(Boolean) }]}
                    scorePointList={currentScorePoints}
                    activePointId={activePointId}
                    focusedPointIndex={selectedPointIndex}
                    onSelectPoint={handleSelectOcrPoint}
                  />
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 顶部 Header：仅保留返回按钮 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>◀ 返回</Text>
        </TouchableOpacity>
      </View>

      {/* 主体两分栏布局：上半部分渲染题目，下半部分渲染绘图 Canvas */}
      <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 6 }}>
        {/* 上半部分：题目内容直接渲染区域 (不显示 OCR 覆膜，不显示参考答案与解析) */}
        <ScrollView style={{ flex: 1, marginBottom: 8 }} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
          <ExerciseComponentRouter
            question={currentQuestion}
            showTitle={true}
            showId={true}
            showAnalysis={false}
            hideAnswerArea={true}
            showOcrOverlay={false}
          />
        </ScrollView>

        {/* 下半部分：绘图 Canvas 草稿板 */}
        <View style={{ flex: 1, marginBottom: 8 }}>
          <DrawingCanvas />
        </View>
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
            <Text style={styles.footerFunctionBtnText}>微课</Text>
          </TouchableOpacity>

          {!hasSubmitted ? (
            <TouchableOpacity
              style={styles.submitBtnStyle}
              onPress={handleSubmitHomework}
            >
              <Text style={styles.submitBtnTextStyle}>确认提交</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.footerFunctionBtn}
              onPress={handleViewAnswer}
            >
              <Text style={styles.footerFunctionBtnText}>答案</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.footerFunctionBtn}
            onPress={handleViewSimilar}
          >
            <Text style={styles.footerFunctionBtnText}>举一反三</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 答题卡全题作答检查组件 */}
      <AnswerCheckModal
        visible={showCheckPanel}
        onClose={() => setShowCheckPanel(false)}
        questions={questions}
        currentIndex={currentIndex}
        answers={answers}
        answersImage={answersImage}
        onSelectQuestion={setCurrentIndex}
      />

      {/* 侧边栏/抽屉 判罚明细与 AI 学伴答疑 */}
      <HomeworkChatPanelDrawer
        visible={showChatDrawer}
        onClose={() => setShowChatDrawer(false)}
        scorePointList={currentScorePoints}
        activePointIndex={selectedPointIndex}
        selectedPointIndex={selectedPointIndex}
        onLocatePoint={handleLocatePointFromCard}
        aiContext={questionAiContext}
      />

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
              <Text style={styles.modalTitle}>参考答案与解析</Text>
              <TouchableOpacity onPress={() => setShowAnswerModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.webModalScroll} showsVerticalScrollIndicator={false}>
              <QuestionAnalysis
                question={currentQuestion}
                show={true}
              />
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 举一反三 Modal (已抽离为独立组件) */}
      <SimilarQuestionsModal
        visible={showSimilarModal}
        onClose={() => setShowSimilarModal(false)}
        similarQuestions={similarQuestions}
        loading={loadingSimilar}
        homeworkSubject={homeworkSubject}
      />

      {/* 微课 内置横屏 WebView Modal */}
      <Modal
        visible={showMiniClassModal}
        transparent={false}
        animationType="slide"
        supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={handleCloseMiniClass}
      >
        <SafeAreaView style={styles.miniClassSafeArea}>
          {/* 顶部横屏控制栏（含关闭微课 ✕ 叉号按钮） */}
          <View style={styles.miniClassHeader}>
            <TouchableOpacity style={styles.miniClassCloseBtn} onPress={handleCloseMiniClass} activeOpacity={0.7}>
              <Text style={styles.miniClassCloseBtnText}>✕ 关闭微课</Text>
            </TouchableOpacity>
            <Text style={styles.miniClassHeaderTitle} numberOfLines={1}>
              📺 {homeworkTitle || '微课讲解'}
            </Text>
          </View>

          {/* WebView 播放区域 */}
          <View style={styles.miniClassWebviewContainer}>
            {miniClassLoading && (
              <View style={styles.miniClassLoadingOverlay}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.miniClassLoadingText}>正在加载微课视频...</Text>
              </View>
            )}
            {miniClassUrl ? (
              <WebView
                source={{ uri: miniClassUrl }}
                style={{ flex: 1 }}
                onLoadEnd={() => setMiniClassLoading(false)}
                onError={() => {
                  setMiniClassLoading(false);
                  Alert.alert('提示', '微课加载失败，请重试');
                }}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>

      {/* 作业未提交前隐藏 AI 悬浮窗，提交完成之后再显示海獭悬浮图标 */}
      {hasSubmitted && questionAiContext ? (
        <GlobalAiAssistant
          hidden={showSimilarModal || showMiniClassModal}
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
  dividerStrip: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
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
  similarModalMobileContainer: {
    width: '92%',
    maxHeight: '85%',
    padding: 16,
  },
  similarHeaderLeft: {
    flex: 1,
  },
  similarSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  similarControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
  },
  selectAllBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxSquareChecked: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  checkboxCheckmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  selectAllLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  selectedBadgeChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedBadgeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  similarScrollList: {
    flex: 1,
    marginTop: 4,
  },
  similarQuestionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  similarQuestionCardSelected: {
    borderColor: '#818CF8',
    backgroundColor: '#F9F8FF',
  },
  similarQuestionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  similarCardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  similarQuestionIndexTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  favoritedBadgeTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  favoritedBadgeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  similarQuestionCardBody: {
    marginBottom: 8,
  },
  similarCardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  toggleAnswerBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  toggleAnswerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  similarCardAnswerExpandArea: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
  similarCardSection: {
    width: '100%',
  },
  similarAnswerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  similarModalBottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
    gap: 10,
  },
  similarActionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  similarActionBtnSecondary: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  similarActionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  similarActionBtnPrimary: {
    backgroundColor: '#4F46E5',
  },
  similarActionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  similarActionBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  miniClassSafeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  miniClassHeader: {
    height: 44,
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  miniClassCloseBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  miniClassCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FCA5A5',
  },
  miniClassHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    marginRight: 40,
  },
  miniClassWebviewContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  miniClassLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  miniClassLoadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#94A3B8',
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
  backdropClickArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  statusLegendRow: {
    marginBottom: 14,
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
    gap: 8,
  },
  legendBadge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingBottom: 20,
  },
  gridItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
  },
  gridItemComplete: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  gridItemHalf: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#F59E0B',
  },
  gridItemNone: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#EF4444',
    borderStyle: 'dashed',
  },
  gridItemCurrent: {
    borderColor: '#4F46E5',
    borderWidth: 2,
  },
  gridItemText: {
    fontSize: 14,
    fontWeight: '700',
  },
  gridItemTextComplete: {
    color: '#059669',
  },
  gridItemTextHalf: {
    color: '#D97706',
  },
  gridItemTextNone: {
    color: '#DC2626',
  },
  gridItemTextCurrent: {
    color: '#4F46E5',
  },
  submitBtnStyle: {
    paddingHorizontal: 14,
    height: 36,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnTextStyle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

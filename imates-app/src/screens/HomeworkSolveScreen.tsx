import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnswerCheckModal } from '@/components/AnswerCheckModal';
import { HomeworkChatPanelDrawer } from '@/components/HomeworkChatPanelDrawer';
import { ExerciseComponentRouter } from '@/components/exercise/ExerciseComponentRouter';
import { isQuestionAnsweredHelper } from '@/utils/exercise-parser';
import { HomeworkQuestionDetail } from '@/services/homework-service';
import { MistakeService } from '@/services/mistake-service';
import { ExerciseItem } from '@/services/exercise-service';
import { useRoute, useNavigation } from '@react-navigation/native';
import { GlobalAiAssistant, type AiChatContext } from '@/features/ai-chat';
import { useHomeworkStore } from '@/stores/homework-store';
import {
  showConfirmDialog,
  showNoticeDialog,
  showIncompleteConfirmDialog,
} from '@/utils/dialog';

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

export function HomeworkSolveScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const store = useHomeworkStore();

  const {
    homeworkId,
    homeworkTitle,
    homeworkSubject = '6',
    questionsList,
    isSubmitted = false,
  }: {
    homeworkId: string;
    homeworkTitle: string;
    homeworkSubject?: string;
    questionsList?: HomeworkQuestionDetail[];
    isSubmitted?: boolean;
  } = route.params || {};

  const handleBack = () => {
    if (isSubmitting) return;
    navigation.goBack();
  };

  const {
    questions,
    answers,
    answersImage,
    currentIndex,
    isSubmitted: storeIsSubmitted,
    judgeDetailData,
    isLoading,
    isSubmitting,
  } = store;

  // 以本地是否有提交记录为唯一标准计算是否已提交
  const hasSubmitted = Boolean(
    storeIsSubmitted ||
    (homeworkId && store.localSubmittedMap[homeworkId])
  );

  const isExpiredParam = (route.params as any)?.isExpired;
  const deadlineParam = (route.params as any)?.deadline;

  const isExpired = useMemo(() => {
    if (typeof isExpiredParam === 'boolean') return isExpiredParam;
    if (deadlineParam) {
      const dlMs = new Date(deadlineParam).getTime();
      if (Number.isFinite(dlMs)) return dlMs <= Date.now();
    }
    return false;
  }, [isExpiredParam, deadlineParam]);

  // 已提交或已截止的作业，统一设为只读复习模式
  const isReadOnly = hasSubmitted || isExpired;

  // 是否显示答题卡检查面板
  const [showCheckPanel, setShowCheckPanel] = useState(false);

  // 判罚明细数据与双向高亮关联状态
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  // 错题本已被加入的题目 ID 集合
  const [mistakeBmNos, setMistakeBmNos] = useState<Set<string>>(new Set());

  // 刷新错题本已录入记录集合
  const refreshMistakeStatus = useCallback(async () => {
    try {
      const list = await MistakeService.getMistakes();
      const set = new Set<string>();
      list.forEach((m) => {
        if (m.bmNo) set.add(String(m.bmNo));
        if (m.id) set.add(String(m.id));
      });
      setMistakeBmNos(set);
    } catch (e) {
      console.warn('[HomeworkSolveScreen] 刷新错题本状态失败:', e);
    }
  }, []);

  useEffect(() => {
    if (isReadOnly) {
      refreshMistakeStatus();
    }
  }, [isReadOnly, refreshMistakeStatus]);

  // 切换单题加入/移出错题本 handler
  const handleToggleMistake = async (q: HomeworkQuestionDetail) => {
    if (!q) return;
    const key = getQKey(q);
    const qBmNo = String(q.questionId || q.id || key || Date.now());
    const isIn = mistakeBmNos.has(qBmNo);

    if (isIn) {
      try {
        await MistakeService.removeMistake(qBmNo);
        setMistakeBmNos((prev) => {
          const next = new Set(prev);
          next.delete(qBmNo);
          return next;
        });
        showNoticeDialog('提示', '已从错题本中移除');
      } catch (err) {
        console.warn('[HomeworkSolveScreen] 移除错题本失败:', err);
      }
    } else {
      const textAns = answers[key] || (q.questionId ? answers[q.questionId] : '') || (q.id ? answers[q.id] : '') || '';
      const imgAns = answersImage[key] || (q.questionId ? answersImage[q.questionId] : '') || (q.id ? answersImage[q.id] : '') || '';
      const contentStr = q.questionContent || (q as any).content || '';
      const titleText = contentStr ? contentStr.substring(0, 15).replace(/<[^>]+>/g, '').trim() + '...' : '题目';
      const exercise: ExerciseItem = {
        ...q,
        id: qBmNo,
        bmNo: qBmNo,
        title: titleText,
        subject: homeworkSubject,
        content: contentStr,
        answer: q.questionAnswer || '',
        analysis: q.questionAnalysis || '暂无解析',
        timestamp: Date.now(),
      };
      try {
        await MistakeService.addMistake({
          bmNo: qBmNo,
          homeworkId,
          homeworkName: homeworkTitle,
          questionData: exercise,
          originalAnswer: {
            studentAnswer: typeof textAns === 'string' ? textAns : JSON.stringify(textAns ?? ''),
            studentImage: imgAns,
            answersMap: answers,
            answersImageMap: answersImage,
          },
        });
        setMistakeBmNos((prev) => new Set(prev).add(qBmNo));
        showNoticeDialog('成功', '已手动加入错题本');
      } catch (err) {
        console.warn('[HomeworkSolveScreen] 手动加入错题本失败:', err);
      }
    }
  };

  const preloadedJudgeDetail = (route.params as any)?.preloadedJudgeDetail;
  const preloadedQuestions = (route.params as any)?.preloadedQuestions;

  // 初始化 HomeworkStore 中的作业数据
  useEffect(() => {
    if (homeworkId) {
      store.loadHomeworkDetails(homeworkId, {
        homeworkTitle,
        homeworkSubject,
        isSubmitted,
        preloadedQuestions: preloadedQuestions || questionsList,
        preloadedJudgeDetail,
      });
    }
  }, [homeworkId, homeworkTitle, homeworkSubject, isSubmitted, preloadedQuestions, questionsList, preloadedJudgeDetail]);

  // 校验每道题目的作答状态 (兼容文本与图片/手写答案)
  const isQuestionAnswered = (q: HomeworkQuestionDetail) => {
    return isQuestionAnsweredHelper(q, answers, answersImage);
  };

  // 监听当前题目变化，检查是否已被加入习题本
  const activeQuestion = questions[currentIndex];

  // 围绕当前题目构建 AI 学伴问答上下文
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
    if (!activeQuestion || !judgeDetailData) return [];

    const qId = String(activeQuestion.questionId || activeQuestion.id || '').trim().replace(/^root\./, '');

    // 1. 递归/解包提取全量判罚节点 (支持 rearrange_judge_nodes, judge_nodes, results, questionJudgeDataData, questionRevisedData 等所有后端结构)
    const allNodes: any[] = [];
    const rootData = judgeDetailData.data ?? judgeDetailData;

    const collectNodes = (target: any) => {
      if (!target) return;
      if (Array.isArray(target)) {
        target.forEach(collectNodes);
        return;
      }
      if (typeof target === 'string') {
        try {
          const parsed = JSON.parse(target);
          collectNodes(parsed);
        } catch {}
        return;
      }
      if (typeof target === 'object') {
        if (target.questionJudgeDataData || target.questionJudgeData) {
          collectNodes(target.questionJudgeDataData || target.questionJudgeData);
        }
        if (target.questionRevisedData) {
          collectNodes(target.questionRevisedData);
        }
        if (Array.isArray(target.results)) {
          collectNodes(target.results);
        }
        if (Array.isArray(target.rearrange_judge_nodes)) {
          collectNodes(target.rearrange_judge_nodes);
        }
        if (Array.isArray(target.judge_nodes)) {
          collectNodes(target.judge_nodes);
        }
        if (Array.isArray(target.nodes)) {
          collectNodes(target.nodes);
        }
        if (target.nodeId || target.node_id || target.questionId || target.route || target.payload) {
          allNodes.push(target);
        }
      }
    };

    collectNodes(rootData);

    if (allNodes.length === 0) return [];

    // 2. 匹配当前题目的所有判罚节点 (支持复合题各子题节点 root.429173715654918144_sub_1 关联匹配)
    let matchedNodes = allNodes.filter((n) => {
      const nId = String(n.nodeId || n.node_id || n.questionId || n.question_id || '').trim().replace(/^root\./, '');
      if (!qId) return true;
      return nId === qId || nId.includes(qId) || qId.includes(nId.replace(/_sub_\d+$/, ''));
    });

    if (matchedNodes.length === 0 && allNodes.length > 0) {
      matchedNodes = allNodes;
    }

    // 3. 汇总所有匹配节点的 payload 列表
    const allPayloads: { payloadItem: any; node: any }[] = [];
    matchedNodes.forEach((node) => {
      const payloadList =
        node.route?.payload ||
        node.payload ||
        node.scoreSummary?.points ||
        node.points ||
        (Array.isArray(node) ? node : []);

      if (Array.isArray(payloadList)) {
        payloadList.forEach((p: any) => {
          allPayloads.push({ payloadItem: p, node });
        });
      }
    });

    if (allPayloads.length === 0) return [];

    // 4. 1:1 映射采分点元数据 (遵守 AGENTS.md 规范)
    return allPayloads.map(({ payloadItem: p, node }, idx: number) => {
      const pId = String(p.standard_node_id || p.pointId || p.id || idx + 1);
      return {
        id: pId,
        pointId: pId,
        hit: Boolean(p.criterion_met),
        sourceText: p.hit_description ?? p.sourceText ?? '',
        nodeId: p.node_id ?? node?.nodeId ?? '',
        nodeLabel: p.node_label ?? node?.nodeLabel ?? '',
        solutionMethodId: p.solution_method_id ?? '',
        methodLabel: p.method_label ?? '',
        criterionType: p.criterion_type ?? p.error_type ?? '',
        criterionText: p.criterion_text ?? p.hit_description ?? '',
        criterionReason: p.potential_error_reason ?? p.criterionReason ?? '',
        score: p.score_awarded ?? p.score ?? 0,
        pointScore: p.score_awarded ?? p.score ?? null,
        maxScore: p.score_max ?? p.maxScore ?? 0,
        potentialErrorType: p.potential_error_type ?? p.error_type ?? '',
        potentialErrorReason: p.potential_error_reason ?? p.hit_description ?? '',
        preconditionType: p.precondition_type ?? null,
        preconditionRequired: p.precondition_required ?? null,
        knowledgePoints: p.knowledge_points ?? p.knowledgePoints ?? [],
        applicableSigns: p.applicable_signs ?? p.applicableSigns ?? [],
        recommended: p.recommended ?? null,
        matchedOcrRegions: p.matched_ocr_regions ?? p.matchedOcrRegions ?? [],
        displayIndex: idx + 1,
      };
    });
  }, [activeQuestion, judgeDetailData]);

  // 点击划线区域 ➔ 触发 2px 紫框高亮 + 打开侧边抽屉
  const handleSelectOcrPoint = (payload: { point: any; index: number }) => {
    const pId = payload.point?.id || payload.point?.pointId || null;
    setActivePointId(pId);
    setSelectedPointIndex(payload.index);
    setShowChatDrawer(true);
  };

  // 点击侧边栏诊断卡片 ➔ 触发对应采分点高亮
  const handleLocatePointFromCard = (item: any, index: number) => {
    const pId = item?.id || item?.pointId || null;
    setActivePointId(pId);
    setSelectedPointIndex(index);
  };

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
          <Text style={styles.emptyText}>当前作业没有任何题目数据</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentIndex];
  
  // 获取题目通用标识 Key
  const getQKey = (q: HomeworkQuestionDetail): string => {
    return String(q.questionId || q.id || '');
  };

  // 题目通用作答内容更新回调 handler
  const handleAnswerChange = (questionItem: HomeworkQuestionDetail, val: any) => {
    if (hasSubmitted) return;
    store.setAnswer(questionItem, val);
  };

  // 题目纯文本作答内容更新回调 handler
  const handleTextAnswerChange = (text: string) => {
    if (hasSubmitted || !currentQuestion) return;
    handleAnswerChange(currentQuestion, text);
  };

  // 点击检查按钮：开启全题填写情况预览 Modal
  const handleCheck = () => {
    setShowCheckPanel(true);
  };

  // 提交整份作业事件回调 (100% 对标 imates-web handleBoardUpload 全流程)
  const handleSubmit = async () => {
    if (hasSubmitted) {
      console.warn('[HomeworkSolveScreen] 当前作业已提交，禁止重复提交');
      return;
    }
    console.log('[HomeworkSolveScreen] 👆 用户点击了底部【确认提交】按钮');
    if (isSubmitting) {
      console.warn('[HomeworkSolveScreen] 正在提交中，拦截重复点击');
      return;
    }

    // 1. 无任何作答内容防空校验
    const answeredCount = questions.filter(isQuestionAnswered).length;
    console.log('[HomeworkSolveScreen] 当前题目总数:', questions.length, '已作答题目数:', answeredCount);

    if (answeredCount === 0) {
      console.warn('[HomeworkSolveScreen] 没有找到任何作答内容，无法提交');
      showNoticeDialog('无法提交', '没有找到任何作答内容，请先在题目上进行作答');
      return;
    }

    // 2. 漏答校验与未答题号计算 (1-indexed)
    const incompleteNumbers: number[] = [];
    questions.forEach((q, idx) => {
      if (!isQuestionAnswered(q)) {
        incompleteNumbers.push(idx + 1);
      }
    });

    if (incompleteNumbers.length > 0) {
      console.log('[HomeworkSolveScreen] 存在未答题目, 漏答题号:', incompleteNumbers);
      showIncompleteConfirmDialog(
        incompleteNumbers,
        () => {
          console.log('[HomeworkSolveScreen] 用户在漏答对话框中确认【仍然提交】');
          performSubmit();
        },
        (firstUnansweredIndex) => {
          console.log('[HomeworkSolveScreen] 用户选择【去作答】, 切换至第', firstUnansweredIndex + 1, '题');
          if (firstUnansweredIndex >= 0 && firstUnansweredIndex < questions.length) {
            store.setCurrentIndex(firstUnansweredIndex);
          }
        }
      );
    } else {
      console.log('[HomeworkSolveScreen] 全部题目均已作答, 弹出确认提交对话框');
      showConfirmDialog(
        '确认提交',
        '您已完成全部题目，确定要提交作业吗？',
        () => {
          console.log('[HomeworkSolveScreen] 用户在全答对话框中点击【确定提交】');
          performSubmit();
        },
        '取消',
        '确定提交'
      );
    }
  };

  // 执行具体的作业网络提交请求与错题本自动同步 handler
  const performSubmit = async () => {
    console.log('[HomeworkSolveScreen] 🚀 开始执行 performSubmit 函数, homeworkId:', homeworkId);
    if (!homeworkId) {
      console.error('[HomeworkSolveScreen] performSubmit 错误: 找不到作业ID');
      showNoticeDialog('错误', '找不到作业ID');
      return;
    }

    try {
      console.log('[HomeworkSolveScreen] 正在调用 store.submitHomework()...');
      const success = await store.submitHomework();
      console.log('[HomeworkSolveScreen] store.submitHomework() 返回结果:', success);

      if (success) {
        console.log('[HomeworkSolveScreen] 提交成功, 开始自动同步选择题错题记录到错题本...');
        const isChoiceQuestion = (q: HomeworkQuestionDetail) => {
          const type = String(q.type || (q as any)?.questionType || (q as any)?.structuredContent?.type || '').toLowerCase();
          if (type === 'single_choice' || type === 'multiple_choice' || type === 'choice') {
            return true;
          }
          if (Array.isArray(q.questionChooseList) && q.questionChooseList.length > 0) {
            return true;
          }
          if (typeof q.questionChooseInfo === 'string' && q.questionChooseInfo.trim() !== '') {
            return true;
          }
          if (Array.isArray((q as any)?.structuredContent?.options) && (q as any).structuredContent.options.length > 0) {
            return true;
          }
          return false;
        };

        for (const q of questions) {
          if (!q) continue;
          if (!isChoiceQuestion(q)) {
            console.log('[HomeworkSolveScreen] 仅选择题自动加入错题本，跳过非选择题:', q.questionId || q.id);
            continue;
          }
          const key = getQKey(q);
          const textAns = answers[key] || (q.questionId ? answers[q.questionId] : '') || (q.id ? answers[q.id] : '') || '';
          const imgAns = answersImage[key] || (q.questionId ? answersImage[q.questionId] : '') || (q.id ? answersImage[q.id] : '') || '';
          const contentStr = q.questionContent || (q as any).content || '';
          const titleText = contentStr ? contentStr.substring(0, 15).replace(/<[^>]+>/g, '').trim() + '...' : '题目';
          const qBmNo = String(q.questionId || q.id || key || Date.now());
          const exercise: ExerciseItem = {
            ...q,
            id: qBmNo,
            bmNo: qBmNo,
            title: titleText,
            subject: homeworkSubject,
            content: contentStr,
            answer: q.questionAnswer || '',
            analysis: q.questionAnalysis || '暂无解析',
            timestamp: Date.now(),
          };
          try {
            await MistakeService.addMistake({
              bmNo: qBmNo,
              homeworkId: homeworkId,
              homeworkName: homeworkTitle,
              questionData: exercise,
              originalAnswer: {
                studentAnswer: typeof textAns === 'string' ? textAns : JSON.stringify(textAns ?? ''),
                studentImage: imgAns,
                answersMap: answers,
                answersImageMap: answersImage,
              },
            });
          } catch (mistakeErr) {
            console.warn('[HomeworkSolveScreen] 同步错题本失败:', mistakeErr);
          }
        }

        console.log('[HomeworkSolveScreen] 错题本同步完毕, 弹出【提交成功】提示对话框');
        showNoticeDialog('提交成功', '您的作业已经成功保存并提交！');
      } else {
        console.warn('[HomeworkSolveScreen] 提交失败, 弹出【提交失败】提示对话框');
        showNoticeDialog('提交失败', '作业提交保存失败，请稍后重试');
      }
    } catch (err) {
      console.error('[HomeworkSolveScreen] ❌ performSubmit 执行过程抛出未捕获异常:', err);
      showNoticeDialog('提交失败', '作业提交过程抛出异常，请稍后重试');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 顶部 Header */}
      {/* 顶部 Header：仅保留返回按钮 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>◀ 返回</Text>
        </TouchableOpacity>
      </View>

      {/* 题目组件直接渲染区域 (直接渲染原生 /exercise 迁移组件) */}
      <ScrollView style={{ flex: 1, paddingHorizontal: 12 }} contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
        <ExerciseComponentRouter
          question={currentQuestion}
          value={answers[getQKey(currentQuestion)] || (currentQuestion.questionId ? answers[currentQuestion.questionId] : '') || (currentQuestion.id ? answers[currentQuestion.id] : '')}
          textValue={answers[getQKey(currentQuestion)] || (currentQuestion.questionId ? answers[currentQuestion.questionId] : '') || (currentQuestion.id ? answers[currentQuestion.id] : '') || ''}
          imageValue={answersImage[getQKey(currentQuestion)] || (currentQuestion.questionId ? answersImage[currentQuestion.questionId] : '') || (currentQuestion.id ? answersImage[currentQuestion.id] : '') || ''}
          answersImage={answersImage}
          onChange={(val) => handleAnswerChange(currentQuestion, val)}
          onTextChange={(text) => handleTextAnswerChange(text)}
          onImageChange={(subIdOrUri, possibleUri) => {
            if (!isReadOnly) store.setAnswerImage(subIdOrUri, possibleUri);
          }}
          showTitle={true}
          showId={true}
          disabled={isReadOnly || isSubmitting}
          showAnalysis={isReadOnly}
          showOcrOverlay={hasSubmitted}
          scorePointList={currentScorePoints}
          activePointId={activePointId}
          selectedPointIndex={selectedPointIndex}
          onSelectPoint={handleSelectOcrPoint}
          headerExtra={
            isReadOnly && currentQuestion ? (
              <TouchableOpacity
                style={[
                  styles.mistakeHeaderBtn,
                  mistakeBmNos.has(String(currentQuestion.questionId || currentQuestion.id || '')) &&
                    styles.mistakeHeaderBtnActive,
                ]}
                onPress={() => handleToggleMistake(currentQuestion)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.mistakeHeaderBtnText,
                    mistakeBmNos.has(String(currentQuestion.questionId || currentQuestion.id || '')) &&
                      styles.mistakeHeaderBtnTextActive,
                  ]}
                >
                  {mistakeBmNos.has(String(currentQuestion.questionId || currentQuestion.id || ''))
                    ? '★ 已加入错题本'
                    : '☆ 加入错题本'}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />

        {/* 提交后/只读查看模式下每道题目底部展示【是否加入错题本】显式操作栏 */}
        {isReadOnly && currentQuestion && (
          <View style={styles.mistakeCardActionBar}>
            <Text style={styles.mistakeCardTipText}>错题本状态：</Text>
            <TouchableOpacity
              style={[
                styles.mistakeActionBtn,
                mistakeBmNos.has(String(currentQuestion.questionId || currentQuestion.id || ''))
                  ? styles.mistakeActionBtnActive
                  : styles.mistakeActionBtnInactive,
              ]}
              onPress={() => handleToggleMistake(currentQuestion)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.mistakeActionBtnText,
                  mistakeBmNos.has(String(currentQuestion.questionId || currentQuestion.id || '')) &&
                    styles.mistakeActionBtnTextActive,
                ]}
              >
                {mistakeBmNos.has(String(currentQuestion.questionId || currentQuestion.id || ''))
                  ? '★ 已加入错题本 (点击可移除)'
                  : '☆ 尚未加入错题本 (点击加入)'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 底部翻页与控制条 */}
      <View style={styles.footerRow}>
        <View style={styles.navArrowsGroup}>
          <TouchableOpacity
            disabled={currentIndex === 0 || isSubmitting}
            style={[styles.roundNavBtn, (currentIndex === 0 || isSubmitting) && styles.disabledRoundNavBtn]}
            onPress={() => !isSubmitting && store.setCurrentIndex(currentIndex - 1)}
          >
            <Text style={styles.roundNavText}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={currentIndex === questions.length - 1 || isSubmitting}
            style={[styles.roundNavBtn, (currentIndex === questions.length - 1 || isSubmitting) && styles.disabledRoundNavBtn]}
            onPress={() => !isSubmitting && store.setCurrentIndex(currentIndex + 1)}
          >
            <Text style={styles.roundNavText}>▼</Text>
          </TouchableOpacity>
        </View>

        {!isReadOnly ? (
          <>
            <TouchableOpacity style={styles.checkBtn} disabled={isSubmitting} onPress={handleCheck}>
              <Text style={styles.checkBtnText}>检查</Text>
            </TouchableOpacity>

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
          </>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            {isExpired && !hasSubmitted && (
              <View style={styles.expiredNoticeTag}>
                <Text style={styles.expiredNoticeText}>⏰ 已截止</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.checkBtn}
              onPress={() => setShowChatDrawer(true)}
            >
              <Text style={styles.checkBtnText}>
                判罚明细{currentScorePoints.length > 0 ? ` (${currentScorePoints.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 提交作业过程中全局遮罩 Loading 面板，拦截全局任意触控交互 */}
      <Modal
        visible={isSubmitting}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.submittingModalOverlay}>
          <View style={styles.submittingModalContent}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.submittingModalTitle}>正在提交保存作业中...</Text>
            <Text style={styles.submittingModalSubtext}>正在上传作答内容与手写图片，请稍候并保持网络畅通</Text>
          </View>
        </View>
      </Modal>

      {/* 答题卡全题作答检查组件 */}
      <AnswerCheckModal
        visible={showCheckPanel}
        onClose={() => setShowCheckPanel(false)}
        questions={questions}
        currentIndex={currentIndex}
        answers={answers}
        answersImage={answersImage}
        onSelectQuestion={(idx) => store.setCurrentIndex(idx)}
      />

      {/* 侧边栏/抽屉 判罚明细与 AI 学伴答疑 */}
      <HomeworkChatPanelDrawer
        visible={showChatDrawer}
        onClose={() => setShowChatDrawer(false)}
        questions={questions}
        currentIndex={currentIndex}
        onSelectQuestion={(idx) => store.setCurrentIndex(idx)}
        judgeDetailData={judgeDetailData}
        scorePointList={currentScorePoints}
        activePointIndex={selectedPointIndex}
        selectedPointIndex={selectedPointIndex}
        onLocatePoint={(item, idx, qIdx) => {
          if (typeof qIdx === 'number') {
            store.setCurrentIndex(qIdx);
          }
          handleLocatePointFromCard(item, idx);
        }}
        aiContext={questionAiContext}
      />

      {/* 作业未提交前严禁显示 AI 问答悬浮窗；提交完成之后再显示海獭悬浮图标 */}
      {hasSubmitted && questionAiContext ? (
        <GlobalAiAssistant
          hidden={showCheckPanel || showChatDrawer}
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
  mistakeHeaderBtn: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  mistakeHeaderBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  mistakeHeaderBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  mistakeHeaderBtnTextActive: {
    color: '#D97706',
  },
  mistakeCardActionBar: {
    marginTop: 12,
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mistakeCardTipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  mistakeActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  mistakeActionBtnInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  mistakeActionBtnActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  mistakeActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  mistakeActionBtnTextActive: {
    color: '#D97706',
  },
  expiredNoticeTag: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  expiredNoticeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  submittingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  submittingModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '85%',
    maxWidth: 320,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  submittingModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  submittingModalSubtext: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});

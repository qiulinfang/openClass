import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { HomeworkQuestionDetail } from '@/services/homework-service';
import { ScorePointCardList, ScorePointItem } from './ScorePointCardList';

export interface HomeworkJudgeDetailPanelProps {
  questions: HomeworkQuestionDetail[];
  currentIndex?: number;
  onSelectQuestion?: (index: number) => void;
  judgeDetailData: any;
  activePointIndex?: number | null;
  selectedPointIndex?: number | null;
  onLocatePoint?: (item: ScorePointItem, index: number, questionIndex: number) => void;
}

/**
 * 通用判罚采分点提取函数 (1:1 属性直接映射)
 */
export function extractScorePointsForQuestion(
  question: HomeworkQuestionDetail,
  judgeDetailData: any
): ScorePointItem[] {
  if (!question || !judgeDetailData) return [];

  const qId = String(question.questionId || question.id || '').trim().replace(/^root\./, '');

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

  // 匹配当前题目的判罚节点 (支持复合大题与其各子题 ID 关联匹配)
  let matchedNodes = allNodes.filter((n) => {
    const nId = String(n.nodeId || n.node_id || n.questionId || n.question_id || '').trim().replace(/^root\./, '');
    if (!qId) return true;
    return nId === qId || nId.includes(qId) || qId.includes(nId.replace(/_sub_\d+$/, ''));
  });

  if (matchedNodes.length === 0 && allNodes.length > 0) {
    matchedNodes = allNodes;
  }

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
}

export function HomeworkJudgeDetailPanel({
  questions = [],
  currentIndex = 0,
  onSelectQuestion,
  judgeDetailData,
  activePointIndex,
  selectedPointIndex,
  onLocatePoint,
}: HomeworkJudgeDetailPanelProps) {
  const [selectedQIndex, setSelectedQIndex] = useState<number>(currentIndex);

  // 同步外部选中的大题 Index
  useEffect(() => {
    if (typeof currentIndex === 'number' && currentIndex >= 0 && currentIndex < questions.length) {
      setSelectedQIndex(currentIndex);
    }
  }, [currentIndex, questions.length]);

  const activeQ = questions[selectedQIndex] || questions[0];

  // 提取当前选中大题的采分点列表
  const currentScorePoints = useMemo(() => {
    if (!activeQ) return [];
    return extractScorePointsForQuestion(activeQ, judgeDetailData);
  }, [activeQ, judgeDetailData]);

  // 统计每个大题的得分与采分点概况 (过滤重复节点)
  const questionSummaries = useMemo(() => {
    return questions.map((q) => {
      const points = extractScorePointsForQuestion(q, judgeDetailData);
      
      const map = new Map<string, any[]>();
      points.forEach((p) => {
        const rawNodeId = p.nodeId || 'default';
        const cleanNodeId = rawNodeId.replace(/^root\./, '');
        if (!map.has(cleanNodeId)) map.set(cleanNodeId, []);
        map.get(cleanNodeId)!.push(p);
      });

      const groupsList = Array.from(map.entries());
      const hasSpecificSubNodes = groupsList.some(([k]) => k.includes('_sub_'));
      const filteredPoints = hasSpecificSubNodes
        ? points.filter((p) => String(p.nodeId || '').includes('_sub_'))
        : points;

      const hitCount = filteredPoints.filter((p) => p.hit).length;
      const totalCount = filteredPoints.length;
      return {
        pointCount: totalCount,
        hitCount,
        hasError: totalCount > 0 && hitCount < totalCount,
      };
    });
  }, [questions, judgeDetailData]);

  // 将当前大题的采分点按小问 (subquestion) 分组
  const subGroups = useMemo(() => {
    if (!currentScorePoints || currentScorePoints.length === 0) return [];

    const map = new Map<string, { subId: string; subTitle: string; points: ScorePointItem[] }>();

    currentScorePoints.forEach((p) => {
      const rawNodeId = p.nodeId || 'default';
      const cleanNodeId = rawNodeId.replace(/^root\./, '');
      const rawLabel = p.nodeLabel || '';

      // 提取小问标题 (如 "子题 1", "子题 2")
      let title = rawLabel ? rawLabel.replace(/^主题目\s*>\s*/, '').trim() : '';
      if (!title) {
        const subMatch = cleanNodeId.match(/_sub_(\d+)$/);
        if (subMatch) {
          title = `子题 ${subMatch[1]}`;
        } else {
          title = '小问采分点';
        }
      }

      const groupKey = cleanNodeId || 'default';
      if (!map.has(groupKey)) {
        map.set(groupKey, {
          subId: groupKey,
          subTitle: title,
          points: [],
        });
      }
      map.get(groupKey)!.points.push(p);
    });

    const groupsList = Array.from(map.values());
    // 关键过滤：若存在具体的子题节点 (如含有 _sub_1, _sub_2)，去除重叠的父级默认组 ("小问采分点")
    const hasSpecificSubNodes = groupsList.some((g) => g.subId.includes('_sub_'));
    const filteredList = hasSpecificSubNodes
      ? groupsList.filter((g) => g.subId.includes('_sub_'))
      : groupsList;

    return filteredList.map((g) => {
      const hitCount = g.points.filter((p) => p.hit).length;
      const totalCount = g.points.length;
      // 重新让每个小问内采分点序号从 1 开始
      const indexedPoints = g.points.map((p, idx) => ({
        ...p,
        displayIndex: idx + 1,
      }));

      return {
        ...g,
        points: indexedPoints,
        hitCount,
        totalCount,
        hasError: totalCount > 0 && hitCount < totalCount,
      };
    });
  }, [currentScorePoints]);

  // 小问折叠状态 Map (默认展开)
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const toggleCollapse = (subId: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [subId]: !prev[subId],
    }));
  };

  const handleTabPress = (idx: number) => {
    setSelectedQIndex(idx);
    if (onSelectQuestion) {
      onSelectQuestion(idx);
    }
  };

  return (
    <View style={styles.container}>
      {/* 顶部大题横向切换 Tab 栏 */}
      {questions.length > 0 && (
        <View style={styles.topTabBarWrapper}>
          <Text style={styles.topTabBarLabel}>切换大题：</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topTabBarContent}
          >
            {questions.map((q, idx) => {
              const isSelected = idx === selectedQIndex;
              const summary = questionSummaries[idx];

              return (
                <TouchableOpacity
                  key={String(q.questionId || q.id || idx)}
                  style={[styles.questionTabBtn, isSelected && styles.activeQuestionTabBtn]}
                  onPress={() => handleTabPress(idx)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.questionTabTitle, isSelected && styles.activeQuestionTabTitle]}>
                    第 {idx + 1} 题
                  </Text>
                  {summary && summary.pointCount > 0 ? (
                    <View
                      style={[
                        styles.pointCountBadge,
                        isSelected ? styles.activePointCountBadge : summary.hasError ? styles.errorPointCountBadge : styles.successPointCountBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pointCountText,
                          isSelected ? styles.activePointCountText : summary.hasError ? styles.errorPointCountText : styles.successPointCountText,
                        ]}
                      >
                        {summary.hitCount}/{summary.pointCount}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 下部采分点列表 (全宽列表形式，小问为列表头，点击整行可折叠) */}
      <ScrollView style={styles.listContainer} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {subGroups.length > 0 ? (
          subGroups.map((group) => {
            const isCollapsed = Boolean(collapsedMap[group.subId]);

            return (
              <View key={group.subId} style={styles.subGroupListSection}>
                {/* 全宽小问列表头 - 点击整行触发折叠/展开 */}
                <TouchableOpacity
                  style={styles.subGroupHeader}
                  onPress={() => toggleCollapse(group.subId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.subGroupHeaderLeft}>
                    <Text style={styles.subGroupTitle}>{group.subTitle}</Text>
                    <View
                      style={[
                        styles.subGroupBadge,
                        group.hasError ? styles.subErrorBadge : styles.subSuccessBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.subGroupBadgeText,
                          group.hasError ? styles.subErrorText : styles.subSuccessText,
                        ]}
                      >
                        {group.hitCount}/{group.totalCount} 采分点
                      </Text>
                    </View>
                  </View>
                  <View style={styles.subGroupHeaderRight}>
                    <Text style={styles.collapseHintText}>
                      {isCollapsed ? '展开' : '折叠'}
                    </Text>
                    <Text style={styles.collapseArrowText}>
                      {isCollapsed ? '▼' : '▲'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 展开时列表渲染该小问的所有采分点 */}
                {!isCollapsed && (
                  <View style={styles.subGroupBody}>
                    <ScorePointCardList
                      scorePointList={group.points}
                      activePointIndex={activePointIndex}
                      selectedPointIndex={selectedPointIndex}
                      onLocatePoint={(item, index) => {
                        if (onLocatePoint) {
                          onLocatePoint(item, index, selectedQIndex);
                        }
                      }}
                    />
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>暂无该大题的采分点明细数据</Text>
            <Text style={styles.emptySubtext}>
              已为您呈现基础题目信息，如需详细判罚可重新发起自动判罚或更换大题查看。
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topTabBarWrapper: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topTabBarLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  topTabBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
  },
  questionTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeQuestionTabBtn: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  questionTabTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  activeQuestionTabTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pointCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activePointCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  successPointCountBadge: {
    backgroundColor: '#DCFCE7',
  },
  errorPointCountBadge: {
    backgroundColor: '#FEE2E2',
  },
  pointCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activePointCountText: {
    color: '#FFFFFF',
  },
  successPointCountText: {
    color: '#15803D',
  },
  errorPointCountText: {
    color: '#B91C1C',
  },
  activeQuestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  questionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionIndexTag: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  questionTypeTag: {
    fontSize: 11,
    color: '#6366F1',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
  },
  scoreStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  statsHighlight: {
    fontWeight: '700',
    color: '#4F46E5',
  },
  listContainer: {
    flex: 1,
  },
  subGroupListSection: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 4,
  },
  subGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subGroupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  subGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  subGroupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  subSuccessBadge: {
    backgroundColor: '#DCFCE7',
  },
  subErrorBadge: {
    backgroundColor: '#FEE2E2',
  },
  subGroupBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subSuccessText: {
    color: '#15803D',
  },
  subErrorText: {
    color: '#B91C1C',
  },
  subGroupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  collapseHintText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  collapseArrowText: {
    fontSize: 10,
    color: '#64748B',
  },
  subGroupBody: {
    backgroundColor: '#FFFFFF',
  },
  emptyCard: {
    margin: 20,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
});

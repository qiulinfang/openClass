import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { MathRenderer } from './MathRenderer';

export interface ScorePointItem {
  id?: string;
  pointId?: string;
  hit?: boolean;
  sourceText?: string;
  nodeId?: string;
  nodeLabel?: string;
  solutionMethodId?: string;
  methodLabel?: string;
  criterionType?: string;
  criterionText?: string;
  criterionReason?: string;
  score?: number;
  pointScore?: number | null;
  maxScore?: number;
  potentialErrorType?: string;
  potentialErrorReason?: string;
  preconditionType?: string | null;
  preconditionRequired?: boolean | null;
  knowledgePoints?: string[];
  applicableSigns?: string[];
  recommended?: boolean | null;
  matchedOcrRegions?: any[];
  displayIndex?: number;
  answerData?: string[];
  studentAnswerImage?: string;
}

interface ScorePointCardListProps {
  scorePointList: ScorePointItem[];
  activePointIndex?: number | null;
  selectedPointIndex?: number | null;
  onLocatePoint?: (item: ScorePointItem, index: number) => void;
}

export function ScorePointCardList({
  scorePointList,
  activePointIndex,
  selectedPointIndex,
  onLocatePoint,
}: ScorePointCardListProps) {
  if (!scorePointList || scorePointList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>暂无采分点明细数据 💡</Text>
      </View>
    );
  }

  const getHeaderText = (item: ScorePointItem): string => {
    const text = item?.sourceText || item?.criterionText || '';
    if (!text) return '';
    const match = text.match(/“([^”]+)”/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return text.trim();
  };

  const getBodyText = (item: ScorePointItem): string => {
    return (
      item?.potentialErrorReason ||
      item?.criterionReason ||
      item?.sourceText ||
      item?.criterionText ||
      ''
    );
  };

  const logCardDebugInfo = (item: ScorePointItem, index: number) => {
    console.log(`📌 [DEBUG] 卡片 #${item.displayIndex || index + 1} 字段 1:1 映射数据:`, {
      pointId: item.id || item.pointId,
      hit: item.hit,
      sourceText: item.sourceText,
      nodeId: item.nodeId,
      nodeLabel: item.nodeLabel,
      solutionMethodId: item.solutionMethodId,
      methodLabel: item.methodLabel,
      criterionType: item.criterionType,
      criterionText: item.criterionText,
      criterionReason: item.criterionReason,
      score: item.score,
      pointScore: item.pointScore,
      maxScore: item.maxScore,
      potentialErrorType: item.potentialErrorType,
      potentialErrorReason: item.potentialErrorReason,
      knowledgePoints: item.knowledgePoints,
      applicableSigns: item.applicableSigns,
      matchedOcrRegions: item.matchedOcrRegions,
      rawObject: item,
    });

    Alert.alert(
      `🛠️ 采分点 #${item.displayIndex || index + 1} 字段调试`,
      `PointID: ${item.id || item.pointId}\nHit: ${item.hit}\nScore: ${item.score ?? 0}/${item.maxScore ?? 0}\n\n[全量 1:1 映射字段已输出至 Terminal Console]`,
      [{ text: '确定' }]
    );
  };

  return (
    <ScrollView style={styles.listContainer} contentContainerStyle={styles.listInnerContainer}>
      {scorePointList.map((item, index) => {
        const isHit = !!item.hit;
        const isSelected = selectedPointIndex === index || activePointIndex === index;
        const headerText = getHeaderText(item);
        const bodyText = getBodyText(item);
        const tags = item.applicableSigns && item.applicableSigns.length > 0
          ? item.applicableSigns
          : (item.knowledgePoints && item.knowledgePoints.length > 0 ? item.knowledgePoints : []);

        return (
          <TouchableOpacity
            key={item.id || item.pointId || index}
            style={[
              styles.card,
              isHit ? styles.hitCard : styles.nohitCard,
              isSelected && styles.selectedCard,
            ]}
            activeOpacity={0.9}
            onPress={() => onLocatePoint && onLocatePoint(item, index)}
          >
            {/* 卡片头部：圆圈序号 + 采分点精简公式/标准要求 */}
            <View style={[styles.cardHeaderBar, isHit ? styles.hitHeaderBar : styles.nohitHeaderBar]}>
              <View style={[styles.numBadge, isHit ? styles.hitNumBadge : styles.nohitNumBadge]}>
                <Text style={styles.numBadgeText}>{item.displayIndex || index + 1}</Text>
              </View>
              
              <View style={styles.headerTextContainer}>
                {headerText ? (
                  <MathRenderer content={headerText} />
                ) : (
                  <Text style={styles.headerTextFallback}>采分点明细 #{index + 1}</Text>
                )}
              </View>
            </View>

            {/* 卡片主体：知识点/解法标签 + 诊断原因 */}
            <View style={styles.cardBodyContent}>
              {/* 知识点标签行 */}
              {tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {tags.map((tag, tIdx) => (
                    <View key={tIdx} style={styles.tagPill}>
                      <Text style={styles.tagDot}>●</Text>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 命中诊断文本 */}
              {isHit && bodyText !== '' && (
                <View style={styles.hitReasonBox}>
                  <MathRenderer content={bodyText} />
                </View>
              )}

              {/* 未命中 / 错误分类说明 */}
              {!isHit && (
                <View style={styles.errorReasonBox}>
                  {item.potentialErrorType ? (
                    <Text style={styles.errorTypeTag}>「{item.potentialErrorType}」</Text>
                  ) : null}

                  {bodyText !== '' && (
                    <View style={styles.errorReasonBoxInner}>
                      <MathRenderer content={bodyText} />
                    </View>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    width: '100%',
  },
  listInnerContainer: {
    padding: 12,
    gap: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  card: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#6E55FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  selectedCard: {
    borderColor: '#6E55FF',
    borderWidth: 2,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  hitCard: {
    backgroundColor: '#FBF9FF',
    borderColor: '#EAE5FF',
  },
  nohitCard: {
    backgroundColor: '#FFF8F8',
    borderColor: '#FFE2E2',
  },
  cardHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  hitHeaderBar: {
    backgroundColor: '#F0ECFF',
  },
  nohitHeaderBar: {
    backgroundColor: '#FFEBEB',
  },
  numBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitNumBadge: {
    backgroundColor: '#6E55FF',
  },
  nohitNumBadge: {
    backgroundColor: '#FF3B30',
  },
  numBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTextFallback: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  debugBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  debugBtnText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  cardBodyContent: {
    padding: 12,
    gap: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(110, 85, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  tagDot: {
    fontSize: 8,
    color: '#6E55FF',
  },
  tagText: {
    fontSize: 12,
    color: '#5238DF',
    fontWeight: '500',
  },
  hitReasonBox: {
    marginTop: 2,
  },
  errorReasonBox: {
    marginTop: 2,
    gap: 4,
  },
  errorTypeTag: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  errorReasonBoxInner: {
    marginTop: 2,
  },
});

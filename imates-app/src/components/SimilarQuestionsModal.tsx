import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { MathRenderer } from '@/components/MathRenderer';
import { ExerciseService } from '@/services/exercise-service';
import { HomeworkQuestionDetail } from '@/services/homework-service';

export interface SimilarQuestionsModalProps {
  visible: boolean;
  onClose: () => void;
  similarQuestions: any[];
  loading: boolean;
  homeworkSubject?: string;
  onStartPractice?: (questions?: HomeworkQuestionDetail[]) => void;
  onBatchSaved?: () => void;
}

export function SimilarQuestionsModal({
  visible,
  onClose,
  similarQuestions,
  loading,
  homeworkSubject = '2',
  onStartPractice,
  onBatchSaved,
}: SimilarQuestionsModalProps) {
  const [selectedBmNos, setSelectedBmNos] = useState<string[]>([]);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [localQuestions, setLocalQuestions] = useState<any[]>([]);

  // 同步外部传入的 similarQuestions 列表并生成默认选中
  useEffect(() => {
    setLocalQuestions(similarQuestions);
    const initialSelected = similarQuestions.map(q => q.bmNo || q.id);
    setSelectedBmNos(initialSelected);
  }, [similarQuestions]);

  const isAllSelected = useMemo(() => {
    if (localQuestions.length === 0) return false;
    return localQuestions.every(q => selectedBmNos.includes(q.bmNo || q.id));
  }, [localQuestions, selectedBmNos]);

  const handleToggleSelect = (bmNo: string) => {
    setSelectedBmNos(prev =>
      prev.includes(bmNo) ? prev.filter(id => id !== bmNo) : [...prev, bmNo]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedBmNos([]);
    } else {
      setSelectedBmNos(localQuestions.map(q => q.bmNo || q.id));
    }
  };

  const handleBatchSaveToExercises = async () => {
    const selectedList = localQuestions.filter(q => selectedBmNos.includes(q.bmNo || q.id));
    if (selectedList.length === 0) {
      Alert.alert('提示', '请先勾选需要加入习题本的题目');
      return;
    }

    setIsBatchSaving(true);
    try {
      let addCount = 0;
      for (const q of selectedList) {
        const bmNo = q.bmNo || q.id;
        const isSaved = await ExerciseService.isExerciseSaved(bmNo);
        if (!isSaved) {
          await ExerciseService.toggleExercise({
            id: bmNo,
            bmNo,
            title: (q.question || q.title || q.content || '').replace(/<[^>]+>/g, '').substring(0, 30),
            subject: homeworkSubject,
            content: q.question || q.content || q.title || '',
            answer: q.answer || '',
            analysis: q.explanation || q.analysisData || '暂无解析',
          });
          addCount++;
        }
      }

      setLocalQuestions(prev =>
        prev.map(q => ({
          ...q,
          atUserList: selectedBmNos.includes(q.bmNo || q.id) ? true : q.atUserList,
        }))
      );

      onBatchSaved?.();
      Alert.alert('成功', addCount > 0 ? `已将 ${addCount} 道题目加入自选习题本！` : '选中的题目已在习题本中');
    } catch (e) {
      console.warn('[SimilarQuestionsModal] 批量加入习题本失败:', e);
      Alert.alert('错误', '加入习题本失败，请重试');
    } finally {
      setIsBatchSaving(false);
    }
  };

  const handleStartPractice = () => {
    Alert.alert('提示', '【开始练习】功能正在开发中');
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.modalContent}
          activeOpacity={1}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.modalTitle}>举一反三</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text style={styles.loadingText}>正在寻找相似题目...</Text>
            </View>
          ) : localQuestions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>根据当前知识点暂未找到相似题目</Text>
            </View>
          ) : (
            <>
              {/* 控制栏：全选 + 已选计数 */}
              <View style={styles.controlBar}>
                <TouchableOpacity
                  style={styles.selectAllRow}
                  onPress={handleToggleSelectAll}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkboxSquare, isAllSelected && styles.checkboxSquareChecked]}>
                    {isAllSelected && <Text style={styles.checkboxCheckmark}>✓</Text>}
                  </View>
                  <Text style={styles.selectAllLabel}>全选</Text>
                </TouchableOpacity>

                <View style={styles.selectedChip}>
                  <Text style={styles.selectedChipText}>
                    已选 {selectedBmNos.length}/{localQuestions.length} 题
                  </Text>
                </View>
              </View>

              {/* 题目列表滑动区 */}
              <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
                {localQuestions.map((q, idx) => {
                  const bmNo = q.bmNo || q.id;
                  const isSelected = selectedBmNos.includes(bmNo);

                  return (
                    <View
                      key={bmNo || idx}
                      style={[
                        styles.questionCard,
                        isSelected && styles.questionCardSelected,
                      ]}
                    >
                      {/* 卡片头部 */}
                      <View style={styles.cardHeader}>
                        <TouchableOpacity
                          style={styles.cardTitleGroup}
                          onPress={() => handleToggleSelect(bmNo)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.checkboxSquare, isSelected && styles.checkboxSquareChecked]}>
                            {isSelected && <Text style={styles.checkboxCheckmark}>✓</Text>}
                          </View>
                          <Text style={styles.questionIndexTitle}>题目 {idx + 1}</Text>
                        </TouchableOpacity>

                        {q.atUserList ? (
                          <View style={styles.favoritedBadge}>
                            <Text style={styles.favoritedBadgeText}>已在习题本</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* 题干内容 */}
                      <TouchableOpacity
                        style={styles.cardBody}
                        onPress={() => handleToggleSelect(bmNo)}
                        activeOpacity={0.9}
                      >
                        <MathRenderer content={q.question || q.content || q.title || ''} textColor="#0F172A" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>

              {/* 底部固定单功能悬浮操作条 */}
              <View style={styles.bottomActionBar}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPrimary, selectedBmNos.length === 0 && styles.actionBtnDisabled]}
                  onPress={handleBatchSaveToExercises}
                  disabled={isBatchSaving || selectedBmNos.length === 0}
                  activeOpacity={0.8}
                >
                  {isBatchSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionBtnPrimaryText}>
                      加入习题本 {selectedBmNos.length > 0 ? `(${selectedBmNos.length})` : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '92%',
    height: '82%',
    maxHeight: '85%',
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: 'bold',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
  },
  selectAllRow: {
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
  selectedChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  scrollList: {
    flex: 1,
    marginTop: 4,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  questionCardSelected: {
    borderColor: '#818CF8',
    backgroundColor: '#F9F8FF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionIndexTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  favoritedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  favoritedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  cardBody: {
    marginBottom: 8,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  toggleAnswerBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  toggleAnswerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  answerExpandArea: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
  cardSection: {
    width: '100%',
  },
  answerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  bottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  actionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  actionBtnPrimary: {
    backgroundColor: '#4F46E5',
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
});

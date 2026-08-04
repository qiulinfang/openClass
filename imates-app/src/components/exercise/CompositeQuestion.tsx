import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { BaseQuestion } from './BaseQuestion';
import { QuestionAnalysis } from './QuestionAnalysis';
import { MathRenderer } from '../MathRenderer';

const getExerciseComponentRouter = () => require('./ExerciseComponentRouter').ExerciseComponentRouter;

export interface CompositeQuestionProps {
  question: any;
  value?: Record<string, any>;
  answersImage?: Record<string, string>;
  onChange?: (val: Record<string, any>) => void;
  onImageChange?: (subId: string, uri: string) => void;
  showTitle?: boolean;
  showId?: boolean;
  showAnalysis?: boolean;
  disabled?: boolean;
  layoutMode?: 'tab' | 'list';
  showOcrOverlay?: boolean;
  scorePointList?: any[];
  activePointId?: string | null;
  selectedPointIndex?: number | null;
  onSelectPoint?: (payload: { point: any; index: number }) => void;
}

export function CompositeQuestion({
  question,
  value = {},
  answersImage = {},
  onChange,
  onImageChange,
  showTitle = false,
  showId = false,
  showAnalysis = false,
  disabled = false,
  layoutMode = 'list',
  showOcrOverlay = false,
  scorePointList = [],
  activePointId,
  selectedPointIndex,
  onSelectPoint,
}: CompositeQuestionProps) {
  const subQuestions: any[] = question?.subQuestions || question?.children || question?.structuredContent?.subQuestions || [];
  const [activeSubIdx, setActiveSubIdx] = useState<number>(0);
  const SubQuestionRouter = getExerciseComponentRouter();

  const materialContent = question?.material || question?.structuredContent?.material || '';

  const handleSubChange = (subId: string, subVal: any) => {
    if (disabled) return;
    const newAnswers = { ...value, [subId]: subVal };
    if (onChange) onChange(newAnswers);

    // 同步图层改变 (如果 subVal 中包含图片)
    let imgUri = '';
    if (typeof subVal === 'string' && (subVal.startsWith('http') || subVal.startsWith('file:') || subVal.startsWith('data:image') || subVal.startsWith('blob:'))) {
      imgUri = subVal;
    } else if (typeof subVal === 'object' && subVal !== null) {
      if (subVal.type === 'img' && subVal.content) imgUri = subVal.content;
      else if (subVal.photoUrl) imgUri = subVal.photoUrl;
      else if (subVal.boardImg) imgUri = subVal.boardImg;
    }
    if (imgUri && onImageChange) {
      onImageChange(subId, imgUri);
    }
  };

  const handleSubImageChange = (subId: string, uri: string) => {
    if (disabled) return;
    if (onImageChange) {
      onImageChange(subId, uri);
    }
  };

  const getSubImageValue = (sub: any, subId: string, subVal: any, idx: number): string => {
    const parentQId = String(question?.id || question?.questionId || question?.bmNo || '');
    if (answersImage) {
      const possibleKeys = [
        subId,
        sub?.questionId,
        sub?.id,
        sub?.bmNo,
        String(idx),
        `${parentQId}_${subId}`,
        `${parentQId}_${idx}`,
        `${parentQId}_${sub?.id}`,
        `${parentQId}_${sub?.questionId}`,
      ].filter(Boolean);

      for (const k of possibleKeys) {
        if (answersImage[k]) return String(answersImage[k]);
      }
    }
    if (typeof subVal === 'string' && (subVal.startsWith('http') || subVal.startsWith('file:') || subVal.startsWith('data:image') || subVal.startsWith('blob:'))) {
      return subVal;
    }
    if (typeof subVal === 'object' && subVal !== null) {
      if (subVal.photoUrl) return String(subVal.photoUrl);
      if (subVal.boardImg) return String(subVal.boardImg);
      if (subVal.type === 'img' && subVal.content) return String(subVal.content);
    }
    if (sub?.studentAnswerImage) return String(sub.studentAnswerImage).trim();
    if (sub?.rearrange_students_answer) return String(sub.rearrange_students_answer).trim();
    if (sub?.student_answer_image) return String(sub.student_answer_image).trim();
    if (Array.isArray(sub?.answerData) && sub.answerData.length > 0) return String(sub.answerData[0]).trim();
    return '';
  };

  return (
    <BaseQuestion
      question={question}
      showTitle={showTitle}
      showId={showId}
      showTypeTag={true}
      stemOverride={
        materialContent ? (
          <View style={styles.materialSection}>
            <Text style={styles.materialTitle}>【材料背景】</Text>
            <MathRenderer content={materialContent} textColor="#0F172A" />
          </View>
        ) : undefined
      }
    >
      {layoutMode === 'tab' ? (
        <>
          {/* 子题 Tab 切换栏 */}
          {subQuestions.length > 1 && (
            <View style={styles.tabsRow}>
              <Text style={styles.tabsLabel}>子题列表：</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
                {subQuestions.map((sub, idx) => {
                  const isActive = activeSubIdx === idx;
                  const subId = sub.id || sub.questionId || idx;
                  const subVal = value[subId];

                  return (
                    <TouchableOpacity
                      key={subId}
                      style={[
                        styles.subTabBtn,
                        isActive && styles.activeSubTabBtn,
                      ]}
                      onPress={() => setActiveSubIdx(idx)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.subTabText, isActive && styles.activeSubTabText]}>
                        第 ({idx + 1}) 小题
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Tab 模式下展示当前激活的子题 */}
          {subQuestions[activeSubIdx] ? (
            <View style={styles.subQuestionWrapper}>
              {(() => {
                const currentSub = subQuestions[activeSubIdx];
                const subId = currentSub.id || currentSub.questionId || activeSubIdx;
                const subVal = value[subId];
                return (
                  <SubQuestionRouter
                    question={currentSub}
                    value={subVal}
                    imageValue={getSubImageValue(currentSub, subId, subVal, activeSubIdx)}
                    answersImage={answersImage}
                    onChange={(val: any) => handleSubChange(subId, val)}
                    onImageChange={(uri: any) => handleSubImageChange(subId, uri)}
                    showTitle={true}
                    showId={showId}
                    showAnalysis={showAnalysis}
                    disabled={disabled}
                    showOcrOverlay={showOcrOverlay}
                    scorePointList={scorePointList}
                    activePointId={activePointId}
                    selectedPointIndex={selectedPointIndex}
                    onSelectPoint={onSelectPoint}
                  />
                );
              })()}
            </View>
          ) : null}
        </>
      ) : (
        /* List 模式：极简流式从上到下完整渲染所有子题 (题干自带 (1) (2) 序号) */
        <View style={styles.listContainer}>
          {subQuestions.map((sub, idx) => {
            const subId = sub.id || sub.questionId || idx;
            const subVal = value[subId];
            return (
              <View key={subId} style={styles.listSubItem}>
                <SubQuestionRouter
                  question={sub}
                  value={subVal}
                  imageValue={getSubImageValue(sub, subId, subVal, idx)}
                  answersImage={answersImage}
                  onChange={(val: any) => handleSubChange(subId, val)}
                  onImageChange={(uri: any) => handleSubImageChange(subId, uri)}
                  showTitle={false}
                  showId={false}
                  showAnalysis={showAnalysis}
                  disabled={disabled}
                  layoutMode="list"
                  showOcrOverlay={showOcrOverlay}
                  scorePointList={scorePointList}
                  activePointId={activePointId}
                  selectedPointIndex={selectedPointIndex}
                  onSelectPoint={onSelectPoint}
                />
              </View>
            );
          })}
        </View>
      )}

      <QuestionAnalysis question={question} show={showAnalysis} />
    </BaseQuestion>
  );
}

const styles = StyleSheet.create({
  materialSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  materialTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 8,
  },
  tabsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  tabsScrollContent: {
    flexDirection: 'row',
    gap: 8,
  },
  subTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeSubTabBtn: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  answeredSubTabBtn: {
    borderColor: '#10B981',
  },
  subTabText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  activeSubTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  answeredDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  subQuestionWrapper: {
    marginTop: 8,
  },
  listContainer: {
    marginTop: 8,
    gap: 12,
  },
  listSubItem: {
    marginVertical: 4,
  },
  subIndexHeader: {
    marginBottom: 4,
  },
  subIndexTag: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
});

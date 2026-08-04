import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { BaseQuestion } from './BaseQuestion';
import { QuestionAnalysis } from './QuestionAnalysis';
import { StudentHandwritingOcrOverlay } from '../StudentHandwritingOcrOverlay';
import { ImageUploadArea } from './ImageUploadArea';

export interface FillBlankQuestionProps {
  question: any;
  value?: any;
  textValue?: string;
  imageValue?: string;
  answersImage?: Record<string, string>;
  onTextChange?: (text: string) => void;
  onImageChange?: (subIdOrUri: string, uri?: string) => void;
  onChange?: (val: any) => void;
  showTitle?: boolean;
  showId?: boolean;
  showAnalysis?: boolean;
  disabled?: boolean;
  showOcrOverlay?: boolean;
  questionData?: any[];
  scorePointList?: any[];
  activePointId?: string | null;
  selectedPointIndex?: number | null;
  focusedPointIndex?: number | null;
  onSelectPoint?: (payload: { point: any; index: number }) => void;
}

/**
 * 填空题组件 (重构版):
 * 作答形式与主观题一致，仅提供图片上传与拍摄区域。
 */
export function FillBlankQuestion({
  question,
  value,
  imageValue = '',
  answersImage,
  onImageChange,
  onChange,
  showTitle = false,
  showId = true,
  showAnalysis = false,
  disabled = false,
  showOcrOverlay = false,
  questionData,
  scorePointList = [],
  activePointId,
  selectedPointIndex,
  focusedPointIndex,
  onSelectPoint,
}: FillBlankQuestionProps) {
  // 当前上传的手写答案图片地址
  const currentImage = useMemo(() => {
    if (imageValue && typeof imageValue === 'string' && imageValue.trim()) return imageValue.trim();
    if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('file:') || value.startsWith('data:image') || value.startsWith('blob:'))) {
      return value.trim();
    }
    if (value?.photoUrl) return String(value.photoUrl).trim();
    if (value?.boardImg) return String(value.boardImg).trim();
    if (value?.type === 'img' && value.content) return String(value.content).trim();
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string' && (first.startsWith('http') || first.startsWith('file:') || first.startsWith('data:image'))) return first.trim();
      if (first?.content) return String(first.content).trim();
    }
    const qAny = question as any;
    if (answersImage) {
      const keys = [qAny?.id, qAny?.questionId, qAny?.bmNo].filter(Boolean);
      for (const k of keys) {
        if (answersImage[k]) return String(answersImage[k]).trim();
      }
    }
    if (qAny?.studentAnswerImage) return String(qAny.studentAnswerImage).trim();
    if (qAny?.rearrange_students_answer) return String(qAny.rearrange_students_answer).trim();
    if (qAny?.student_answer_image) return String(qAny.student_answer_image).trim();
    if (Array.isArray(qAny?.answerData) && qAny.answerData.length > 0) return String(qAny.answerData[0]).trim();
    if (typeof qAny?.answerData === 'string' && qAny.answerData) return String(qAny.answerData).trim();
    return '';
  }, [value, imageValue, answersImage, question]);

  const currentFocusedIndex = focusedPointIndex ?? selectedPointIndex;

  // 1. 整理采分点元数据列表 (用于批改标注高亮)
  const displayScorePointList = useMemo(() => {
    if (!scorePointList) return [];
    if (Array.isArray(scorePointList)) return scorePointList;
    return [];
  }, [scorePointList]);

  // 2. 提取题目及采分点中的手写作答图片与数据 (支持 OCR 批改覆膜)
  const displayQuestionData = useMemo(() => {
    if (Array.isArray(questionData) && questionData.length > 0) {
      return questionData;
    }

    const targetQId = String(question?.id || question?.questionId || question?.bmNo || '').trim();
    const imgs: string[] = [];

    // 从采分点中收集手写答案图片
    if (Array.isArray(displayScorePointList)) {
      displayScorePointList.forEach((sp: any) => {
        if (Array.isArray(sp?.answerData)) imgs.push(...sp.answerData);
        if (sp?.studentAnswerImage) imgs.push(sp.studentAnswerImage);
        if (sp?.rearrange_students_answer) imgs.push(sp.rearrange_students_answer);
        if (sp?.student_answer_image) imgs.push(sp.student_answer_image);
        if (sp?.imageUrl) imgs.push(sp.imageUrl);
      });
    }

    // 从传入的作答图片中收集
    if (currentImage) {
      imgs.push(currentImage);
    }

    // 从题目原对象数据中收集
    const qAny = question as any;
    if (Array.isArray(qAny?.answerData)) {
      imgs.push(...qAny.answerData);
    } else if (typeof qAny?.answerData === 'string' && qAny.answerData) {
      imgs.push(qAny.answerData);
    }
    if (Array.isArray(qAny?.answerList)) {
      imgs.push(...qAny.answerList);
    }
    if (qAny?.studentAnswerImage) imgs.push(qAny.studentAnswerImage);
    if (qAny?.rearrange_students_answer) imgs.push(qAny.rearrange_students_answer);
    if (qAny?.student_answer_image) imgs.push(qAny.student_answer_image);

    const uniqueImgs = Array.from(new Set(imgs.filter(Boolean)));
    if (uniqueImgs.length > 0) {
      return [{ questionId: targetQId, answerData: uniqueImgs }];
    }
    return [];
  }, [questionData, question, displayScorePointList, currentImage]);

  // 3. 判断是否开启手写 OCR 覆膜标注模式
  const hasOcrOverlayData = useMemo(() => {
    return (
      displayQuestionData.length > 0 &&
      (showOcrOverlay === true || displayScorePointList.length > 0)
    );
  }, [displayQuestionData, showOcrOverlay, displayScorePointList]);

  // MixedInputArea → onImageChange 适配桥（将纯 uri 透传给上层 onImageChange(uri) ）
  const handleMixedImageChange = (uri: string) => {
    if (onImageChange) onImageChange(uri);
  };

  return (
    <BaseQuestion
      question={question}
      showTitle={showTitle}
      showId={showId}
      showTypeTag={true}
    >
      <View style={styles.container}>
        {hasOcrOverlayData ? (
          /* 手写 OCR 覆膜标注区域 */
          <StudentHandwritingOcrOverlay
            questionData={displayQuestionData}
            scorePointList={displayScorePointList}
            activePointId={activePointId}
            focusedPointIndex={currentFocusedIndex}
            onSelectPoint={onSelectPoint}
          />
        ) : disabled ? (
          /* 只读 / 批改查看模式 */
          <View style={styles.readOnlyAnswerBox}>
            <Text style={styles.readOnlyAnswerTitle}>我的作答照片：</Text>
            {currentImage ? (
              <View style={styles.readOnlyPhotoWrapper}>
                <Image
                  source={{ uri: currentImage }}
                  style={styles.readOnlyPhotoImage}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <Text style={styles.noAnswerTipText}>未上传填空题作答照片</Text>
            )}
          </View>
        ) : (
          /* 填空题图片上传作答区域 —— 仅支持图片/手写作答 */
          <ImageUploadArea
            value={value}
            imageValue={currentImage}
            disabled={disabled}
            label=""
            onImageChange={handleMixedImageChange}
            onChange={onChange}
          />
        )}
      </View>

      <QuestionAnalysis question={question} show={showAnalysis} />
    </BaseQuestion>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  readOnlyAnswerBox: {
    width: '100%',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginTop: 8,
  },
  readOnlyAnswerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  readOnlyPhotoWrapper: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  readOnlyPhotoImage: {
    width: '100%',
    height: '100%',
  },
  noAnswerTipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});

import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BaseQuestion } from './BaseQuestion';
import { QuestionAnalysis } from './QuestionAnalysis';
import { StudentHandwritingOcrOverlay } from '../StudentHandwritingOcrOverlay';
import { MathRenderer } from '../MathRenderer';
import { ImageUploadArea } from './ImageUploadArea';

export interface SubjectiveQuestionProps {
  question: any;
  value?: any;
  textValue?: string;
  imageValue?: string;
  answersImage?: Record<string, string>;
  onTextChange?: (text: string) => void;
  onImageChange?: (uri: string) => void;
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

export function SubjectiveQuestion({
  question,
  value,
  textValue = '',
  imageValue = '',
  answersImage,
  onTextChange,
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
}: SubjectiveQuestionProps) {
  const currentText = typeof value === 'string' ? value : (value?.content || textValue || '');

  const qAny = question as any;
  const currentImage = useMemo(() => {
    if (imageValue && typeof imageValue === 'string' && imageValue.trim()) return imageValue.trim();
    if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('file:') || value.startsWith('data:image') || value.startsWith('blob:'))) {
      return value.trim();
    }
    if (value?.photoUrl) return String(value.photoUrl).trim();
    if (value?.boardImg) return String(value.boardImg).trim();
    if (value?.type === 'img' && value.content) return String(value.content).trim();
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

  // 1. 整理采分点元数据列表 (对标 imates-web/src/components/exercise/SubjectiveQuestion.vue)
  const displayScorePointList = useMemo(() => {
    if (!scorePointList) return [];
    if (Array.isArray(scorePointList)) return scorePointList;
    return [];
  }, [scorePointList]);

  // 2. 全量提取题目及采分点中的手写作答图片与数据 (对标 imates-web)
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

    // 从传入的交互作答值中收集
    if (currentImage) {
      imgs.push(currentImage);
    }

    // 从题目原数据对象中收集
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

  // 3. 判断是否开启手写 OCR 覆膜标注模式 (对标 imates-web: displayQuestionData.length > 0 && (showOcrOverlay === true || displayScorePointList.length > 0))
  const hasOcrOverlayData = useMemo(() => {
    return (
      displayQuestionData.length > 0 &&
      (showOcrOverlay === true || displayScorePointList.length > 0)
    );
  }, [displayQuestionData, showOcrOverlay, displayScorePointList]);

  // 扫图识字 / 拍照识别
  const handleScanTextAnswer = async () => {
    if (disabled) return;
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
        const text = '已通过手写 OCR 自动扫描提取解答步骤。';
        if (onTextChange) onTextChange(text);
        if (onChange) onChange(text);
      }
    } catch (e) {
      console.warn('[SubjectiveQuestion] 扫码拍照识别失败:', e);
    }
  };

  // 拍摄解答过程照片
  const handleUploadImage = async () => {
    if (disabled) return;
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
        const uri = result.assets[0].uri;
        if (onImageChange) onImageChange(uri);
        if (onChange) onChange({ type: 'img', content: uri });
      }
    } catch (e) {
      console.warn('[SubjectiveQuestion] 拍照上传过程失败:', e);
    }
  };

  const handleDeleteImage = () => {
    if (disabled) return;
    if (onImageChange) onImageChange('');
    if (onChange) onChange('');
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
          /* 只读 / 查看作答模式 (对标 imates-web MixedInputArea 只读渲染) */
          <View style={styles.readOnlyAnswerBox}>
            <Text style={styles.readOnlyAnswerTitle}>我的作答：</Text>
            {currentImage ? (
              <View style={styles.readOnlyPhotoWrapper}>
                <Image source={{ uri: currentImage }} style={styles.readOnlyPhotoImage} resizeMode="contain" />
              </View>
            ) : currentText ? (
              <View style={styles.readOnlyTextWrapper}>
                <MathRenderer content={currentText} textColor="#0F172A" />
              </View>
            ) : (
              <Text style={styles.noAnswerTipText}>未填写作答内容或过程照片</Text>
            )}
          </View>
        ) : (
          /* 交互作答模式 (使用极简 ImageUploadArea 图片上传画板) */
          <ImageUploadArea
            value={value}
            imageValue={currentImage}
            disabled={disabled}
            placeholder="请输入您的作答内容..."
            onImageChange={onImageChange}
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
  inputSection: {
    gap: 12,
  },
  textAreaBox: {
    position: 'relative',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  textInput: {
    fontSize: 14,
    color: '#0F172A',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  scanBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  scanBtnText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
  },
  photoContainer: {
    gap: 6,
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  photoUploadBtn: {
    width: '100%',
    height: 120,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hasPhotoBtn: {
    borderStyle: 'solid',
    borderColor: '#E2E8F0',
  },
  uploadedWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  deleteBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  uploadPlaceholderText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  readOnlyAnswerBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    gap: 8,
  },
  readOnlyAnswerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  readOnlyPhotoWrapper: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  readOnlyPhotoImage: {
    width: '100%',
    height: '100%',
  },
  readOnlyTextWrapper: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  noAnswerTipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});

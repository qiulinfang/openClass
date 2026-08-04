import React from 'react';
import { BaseQuestion } from './BaseQuestion';
import { ChoiceQuestion } from './ChoiceQuestion';
import { JudgmentQuestion } from './JudgmentQuestion';
import { FillBlankQuestion } from './FillBlankQuestion';
import { SubjectiveQuestion } from './SubjectiveQuestion';
import { CompositeQuestion } from './CompositeQuestion';
import { normalizeQuestion } from '@/utils/exercise-parser';

export interface ExerciseComponentRouterProps {
  question: any;
  value?: any;
  textValue?: string;
  imageValue?: string;
  answersImage?: Record<string, string>;
  onChange?: (val: any) => void;
  onTextChange?: (text: string) => void;
  onImageChange?: (subIdOrUri: string, uri?: string) => void;
  showTitle?: boolean;
  showId?: boolean;
  showAnalysis?: boolean;
  hideAnswerArea?: boolean;
  disabled?: boolean;
  layoutMode?: 'tab' | 'list';
  showOcrOverlay?: boolean;
  scorePointList?: any[];
  activePointId?: string | null;
  selectedPointIndex?: number | null;
  onSelectPoint?: (payload: { point: any; index: number }) => void;
  headerExtra?: React.ReactNode;
}

export function ExerciseComponentRouter({
  question: rawQuestion,
  value,
  textValue,
  imageValue,
  answersImage,
  onChange,
  onTextChange,
  onImageChange,
  showTitle = false,
  showId = false,
  showAnalysis = false,
  hideAnswerArea = false,
  disabled = false,
  layoutMode = 'list',
  showOcrOverlay = false,
  scorePointList = [],
  activePointId,
  selectedPointIndex,
  onSelectPoint,
  headerExtra,
}: ExerciseComponentRouterProps) {
  if (!rawQuestion) return null;

  // 自动规范化与结构化提取 (解包 questionStructureData、material、subQuestions)
  const question = normalizeQuestion(rawQuestion);

  // 若设置了 hideAnswerArea=true，则仅渲染题干外壳，隐藏一切作答输入框与选择卡片
  if (hideAnswerArea) {
    return (
      <BaseQuestion
        question={question}
        showTitle={showTitle}
        showId={showId}
        showTypeTag={true}
        headerExtra={headerExtra}
      />
    );
  }

  const rawType = String(
    question?.structuredContent?.type || question?.type || ''
  ).toLowerCase();

  // 1. 复合题
  if (rawType === 'composite' || (question?.subQuestions && question.subQuestions.length > 0)) {
    return (
      <CompositeQuestion
        question={question}
        value={value}
        answersImage={answersImage}
        onChange={onChange}
        onImageChange={(subId, uri) => {
          if (onImageChange) onImageChange(subId, uri);
        }}
        showTitle={showTitle}
        showId={showId}
        showAnalysis={showAnalysis}
        disabled={disabled}
        layoutMode={layoutMode}
        showOcrOverlay={showOcrOverlay}
        scorePointList={scorePointList}
        activePointId={activePointId}
        selectedPointIndex={selectedPointIndex}
        onSelectPoint={onSelectPoint}
      />
    );
  }

  // 2. 选择题 (单选 / 多选)
  if (
    rawType === 'single_choice' ||
    rawType === 'multiple_choice' ||
    rawType === 'choice' ||
    (question?.structuredContent?.options && question.structuredContent.options.length > 0) ||
    (Array.isArray(question?.questionChooseList) && question.questionChooseList.length > 0) ||
    (typeof question?.questionChooseInfo === 'string' && question.questionChooseInfo.trim() !== '')
  ) {
    const choiceValue = Array.isArray(value)
      ? value
      : typeof value === 'string' && value
      ? [value]
      : textValue
      ? [textValue]
      : [];
    return (
      <ChoiceQuestion
        question={question}
        value={choiceValue}
        onChange={(valArr) => {
          if (onChange) onChange(valArr);
          if (onTextChange && valArr.length > 0) onTextChange(valArr[0]);
        }}
        showTitle={showTitle}
        showId={showId}
        showAnalysis={showAnalysis}
        disabled={disabled}
      />
    );
  }

  // 3. 判断题
  if (rawType === 'true_false' || rawType === 'judgment') {
    return (
      <JudgmentQuestion
        question={question}
        value={value ?? textValue}
        onChange={(val) => {
          if (onChange) onChange(val);
          if (onTextChange) onTextChange(val);
        }}
        showTitle={showTitle}
        showId={showId}
        showAnalysis={showAnalysis}
        disabled={disabled}
      />
    );
  }

  // 4. 填空题
  if (rawType === 'fill_in_blank' || rawType === 'blank') {
    return (
      <FillBlankQuestion
        question={question}
        value={value}
        textValue={textValue}
        imageValue={imageValue}
        answersImage={answersImage}
        onTextChange={onTextChange}
        onImageChange={(subIdOrUri, possibleUri) => {
          const uri = typeof possibleUri === 'string' ? possibleUri : subIdOrUri;
          if (onImageChange) onImageChange(subIdOrUri, uri);
        }}
        onChange={onChange}
        showTitle={showTitle}
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
  }

  // 5. 解答题 / 主观题 (默认回退)
  return (
    <SubjectiveQuestion
      question={question}
      textValue={textValue ?? (typeof value === 'string' ? value : '')}
      imageValue={imageValue ?? ''}
      answersImage={answersImage}
      onTextChange={(t) => {
        if (onTextChange) onTextChange(t);
        if (onChange) onChange(t);
      }}
      onImageChange={onImageChange}
      showTitle={showTitle}
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
}

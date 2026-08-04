import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { BaseQuestion } from './BaseQuestion';
import { QuestionAnalysis } from './QuestionAnalysis';

export interface JudgmentQuestionProps {
  question: any;
  value?: string | boolean | any;
  onChange?: (val: string) => void;
  showTitle?: boolean;
  showId?: boolean;
  showAnalysis?: boolean;
  disabled?: boolean;
}

export function JudgmentQuestion({
  question,
  value,
  onChange,
  showTitle = false,
  showId = false,
  showAnalysis = false,
  disabled = false,
}: JudgmentQuestionProps) {
  const displayOptions = [
    { id: 'true', label: '正确', icon: '✓' },
    { id: 'false', label: '错误', icon: '✕' },
  ];

  const normalizeVal = (val: any): string => {
    if (val === true || val === 'true' || val === '对' || val === '正确') return 'true';
    if (val === false || val === 'false' || val === '错' || val === '错误') return 'false';
    if (Array.isArray(val) && val.length > 0) return normalizeVal(val[0]);
    return String(val ?? '');
  };

  const strValue = normalizeVal(value);

  const isCorrect = (optId: string) => {
    const rawAns = question?.structuredContent?.answer ?? question?.questionAnswer ?? question?.answer;
    const ansStr = normalizeVal(rawAns);
    return ansStr === optId;
  };

  const handleSelect = (val: string) => {
    if (disabled) return;
    if (onChange) onChange(val);
  };

  return (
    <BaseQuestion
      question={question}
      showTitle={showTitle}
      showId={showId}
      showTypeTag={true}
    >
      <View style={styles.judgmentRow}>
        {displayOptions.map((opt, index) => {
          const isSelected = strValue === opt.id;
          const isTrueType = index === 0;
          const isCorrectState = isSelected && disabled && isCorrect(opt.id);
          const isWrongState = isSelected && disabled && !isCorrect(opt.id);

          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.judgmentBtn,
                isTrueType ? styles.trueBtn : styles.falseBtn,
                isSelected && (isTrueType ? styles.activeTrueBtn : styles.activeFalseBtn),
                isCorrectState && styles.correctFeedbackBtn,
                isWrongState && styles.wrongFeedbackBtn,
              ]}
              activeOpacity={disabled ? 1 : 0.8}
              onPress={() => handleSelect(opt.id)}
            >
              <Text
                style={[
                  styles.judgmentIcon,
                  isTrueType ? styles.trueIconText : styles.falseIconText,
                  isSelected && styles.activeIconText,
                ]}
              >
                {opt.icon}
              </Text>
              <Text
                style={[
                  styles.judgmentLabel,
                  isTrueType ? styles.trueLabelText : styles.falseLabelText,
                  isSelected && styles.activeLabelText,
                ]}
              >
                {opt.label}
              </Text>
              {disabled && isSelected && (
                <Text style={isCorrect(opt.id) ? styles.correctFeedbackText : styles.wrongFeedbackText}>
                  {isCorrect(opt.id) ? '✓' : '✕'}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <QuestionAnalysis question={question} show={showAnalysis} />
    </BaseQuestion>
  );
}

const styles = StyleSheet.create({
  judgmentRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 8,
  },
  judgmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  trueBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  falseBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  activeTrueBtn: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  activeFalseBtn: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  correctFeedbackBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
    borderWidth: 2,
  },
  wrongFeedbackBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  judgmentIcon: {
    fontSize: 18,
    fontWeight: '800',
  },
  trueIconText: {
    color: '#10B981',
  },
  falseIconText: {
    color: '#EF4444',
  },
  judgmentLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  trueLabelText: {
    color: '#065F46',
  },
  falseLabelText: {
    color: '#991B1B',
  },
  activeIconText: {
    color: '#FFFFFF',
  },
  activeLabelText: {
    color: '#FFFFFF',
  },
  correctFeedbackText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 4,
  },
  wrongFeedbackText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 4,
  },
});

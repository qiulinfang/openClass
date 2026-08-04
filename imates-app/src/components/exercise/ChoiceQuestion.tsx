import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { BaseQuestion } from './BaseQuestion';
import { QuestionAnalysis } from './QuestionAnalysis';
import { MathRenderer } from '../MathRenderer';

export interface ChoiceOption {
  value: string;
  label: string;
  text: string;
}

export interface ChoiceQuestionProps {
  question: any;
  value?: string[];
  onChange?: (val: string[]) => void;
  showTitle?: boolean;
  showId?: boolean;
  showAnalysis?: boolean;
  disabled?: boolean;
}

export function ChoiceQuestion({
  question,
  value = [],
  onChange,
  showTitle = false,
  showId = false,
  showAnalysis = false,
  disabled = false,
}: ChoiceQuestionProps) {
  // 解析选项 (支持 structuredContent.options, options, questionChooseList, questionChooseInfo)
  const processedOptions: ChoiceOption[] = (() => {
    const rawOptions =
      question?.structuredContent?.options ||
      question?.options ||
      (Array.isArray(question?.questionChooseList) && question.questionChooseList.length > 0 ? question.questionChooseList : []);
    if (Array.isArray(rawOptions) && rawOptions.length > 0) {
      return rawOptions.map((opt: any, idx: number) => {
        const valChar = String(opt.id || opt.label || String.fromCharCode(65 + idx)).trim().toUpperCase();
        const contentText = opt.content || opt.text || (typeof opt === 'string' ? opt : '');
        return {
          value: valChar,
          label: valChar,
          text: contentText,
        };
      });
    }

    // 从 questionChooseInfo 提取 A, B, C, D 选项
    const info = question?.questionChooseInfo;
    if (info) {
      try {
        const parsed = typeof info === 'string' ? JSON.parse(info) : info;
        if (Array.isArray(parsed)) {
          return parsed.map((item: any, idx: number) => {
            const char = String.fromCharCode(65 + idx);
            return { value: char, label: char, text: typeof item === 'string' ? item : (item.text || item.content || char) };
          });
        }
      } catch {
        const parts = String(info).split(/[;；,，]/).map((p: string) => p.trim()).filter(Boolean);
        if (parts.length > 0) {
          return parts.map((p: string, idx: number) => {
            const char = String.fromCharCode(65 + idx);
            return { value: char, label: char, text: p };
          });
        }
      }
    }

    return [];
  })();

  const isMultiple = (question?.structuredContent?.type || question?.type) === 'multiple_choice';

  const isSelected = (val: string) => Array.isArray(value) && value.includes(val);

  const isCorrect = (val: string) => {
    const answer = question?.structuredContent?.answer || question?.questionAnswer || question?.answer;
    if (Array.isArray(answer)) {
      return answer.includes(val);
    }
    return String(answer ?? '') === val;
  };

  const handleSelect = (val: string) => {
    if (disabled) return;
    let newValue = [...(Array.isArray(value) ? value : [])];
    const index = newValue.indexOf(val);
    if (index > -1) {
      newValue.splice(index, 1);
    } else {
      if (isMultiple) {
        newValue.push(val);
        newValue.sort();
      } else {
        newValue = [val];
      }
    }
    if (onChange) onChange(newValue);
  };

  return (
    <BaseQuestion
      question={question}
      showTitle={showTitle}
      showId={showId}
      showTypeTag={true}
    >
      {processedOptions && processedOptions.length > 0 ? (
        <View style={styles.optionsContainer}>
          {processedOptions.map((opt) => {
            const selected = isSelected(opt.value);
            const correct = isCorrect(opt.value);
            const isAnswerState = disabled && selected;

            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionCard,
                  selected && styles.selectedOptionCard,
                  isAnswerState && correct && styles.correctOptionCard,
                  isAnswerState && !correct && styles.wrongOptionCard,
                ]}
                activeOpacity={disabled ? 1 : 0.8}
                onPress={() => handleSelect(opt.value)}
              >
                <View
                  style={[
                    styles.indicatorCircle,
                    selected && styles.selectedIndicatorCircle,
                    isAnswerState && correct && styles.correctIndicatorCircle,
                    isAnswerState && !correct && styles.wrongIndicatorCircle,
                  ]}
                >
                  <Text
                    style={[
                      styles.indicatorText,
                      (selected || isAnswerState) && styles.selectedIndicatorText,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </View>
                <View style={styles.optionTextContainer}>
                  {opt.text ? (
                    <MathRenderer content={opt.text} textColor={selected ? '#615EFE' : '#333333'} />
                  ) : (
                    <Text style={[styles.optionFallbackText, selected && styles.selectedOptionFallbackText]}>
                      选项 {opt.label}
                    </Text>
                  )}
                </View>
                {isAnswerState && (
                  <View style={styles.statusIconWrapper}>
                    <Text style={correct ? styles.correctIconText : styles.wrongIconText}>
                      {correct ? '✓' : '✕'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.fieldMissingWarning}>
          <Text style={styles.fieldMissingWarningText}>【警告：选择题未配置选项内容 (options)】</Text>
        </View>
      )}

      <QuestionAnalysis question={question} show={showAnalysis} />
    </BaseQuestion>
  );
}

const styles = StyleSheet.create({
  optionsContainer: {
    width: '100%',
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 8,
    gap: 12,
  },
  selectedOptionCard: {
    backgroundColor: '#F0F0FF',
    borderColor: '#615EFE',
  },
  correctOptionCard: {
    backgroundColor: '#F0FFF4',
    borderColor: '#22C55E',
  },
  wrongOptionCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  indicatorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIndicatorCircle: {
    backgroundColor: '#615EFE',
    borderColor: '#615EFE',
  },
  correctIndicatorCircle: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  wrongIndicatorCircle: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  indicatorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  selectedIndicatorText: {
    color: '#FFFFFF',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionFallbackText: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '400',
  },
  selectedOptionFallbackText: {
    color: '#615EFE',
    fontWeight: '600',
  },
  statusIconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  correctIconText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '700',
  },
  wrongIconText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
  },
  fieldMissingWarning: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginVertical: 6,
    alignSelf: 'flex-start',
  },
  fieldMissingWarningText: {
    color: '#EF4444',
    fontSize: 13,
  },
});

import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { storage } from '@/services/storage';

const EXERCISE_ASSISTANT = require('../../../../assets/exercise-assistant.png');
const STORAGE_KEY = 'suggested_questions_ai-exercise';
const CUSTOM_PLACEHOLDER = '点击编辑自定义问题...';
const DEFAULT_SUGGESTIONS = [
  '能和我一起分析一下这道题的已知条件和想求的量之间的关系吗？',
  '这道题通常会用到哪些关键概念或公式？我应该先从哪里入手？',
  '有没有一个最关键的突破口？我应该关注哪个量的变化？',
  '能带我对比一下这题和我们最近学的知识点，看是哪里匹配的吗？',
  CUSTOM_PLACEHOLDER,
];

interface ExerciseSuggestedQuestionsProps {
  disabled?: boolean;
  onSelect: (question: string) => void;
}

function ExerciseSuggestedQuestionsComponent({
  disabled = false,
  onSelect,
}: ExerciseSuggestedQuestionsProps) {
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let disposed = false;
    void storage.getItem(STORAGE_KEY).then((saved) => {
      if (!saved || disposed) return;
      try {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.length === DEFAULT_SUGGESTIONS.length &&
          parsed.every((item) => typeof item === 'string')
        ) {
          setSuggestions(parsed);
        }
      } catch {
        // 损坏的本地推荐配置直接回退到 Web 默认值。
      }
    });
    return () => {
      disposed = true;
    };
  }, []);

  const beginEdit = (index: number) => {
    if (disabled) return;
    setEditingIndex(index);
    setDraft(
      suggestions[index] === CUSTOM_PLACEHOLDER ? '' : suggestions[index]
    );
  };

  const saveEdit = (index: number) => {
    if (editingIndex !== index) return;
    const next = [...suggestions];
    next[index] = draft.trim() || CUSTOM_PLACEHOLDER;
    setSuggestions(next);
    setEditingIndex(null);
    setDraft('');
    void storage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const selectSuggestion = (suggestion: string, index: number) => {
    if (disabled) return;
    if (suggestion === CUSTOM_PLACEHOLDER) {
      beginEdit(index);
      return;
    }
    onSelect(suggestion);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Image
            source={EXERCISE_ASSISTANT}
            style={styles.mascot}
            resizeMode="contain"
            accessibilityLabel="题目学伴"
          />
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>题目学伴</Text>
            <Text style={styles.title}>猜你想问</Text>
          </View>
        </View>

        <View style={styles.list}>
          {suggestions.map((suggestion, index) => (
            <View key={index} style={styles.item}>
              {editingIndex === index ? (
                <TextInput
                  autoFocus
                  value={draft}
                  onChangeText={setDraft}
                  onBlur={() => saveEdit(index)}
                  onSubmitEditing={() => saveEdit(index)}
                  style={styles.input}
                  placeholder="输入你的常用问题"
                  placeholderTextColor="#9297AA"
                  returnKeyType="done"
                  maxLength={120}
                  accessibilityLabel={`编辑第${index + 1}条推荐问题`}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.questionButton}
                    onPress={() => selectSuggestion(suggestion, index)}
                    disabled={disabled}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={suggestion}
                  >
                    <Text style={styles.questionText}>{suggestion}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => beginEdit(index)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={`编辑推荐问题：${suggestion}`}
                  >
                    <Text style={styles.editText}>编辑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sendButton}
                    onPress={() => selectSuggestion(suggestion, index)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={`发送问题：${suggestion}`}
                  >
                    <Text style={styles.sendArrow}>›</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export const ExerciseSuggestedQuestions = React.memo(
  ExerciseSuggestedQuestionsComponent
);

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingHorizontal: 14,
    paddingTop: 34,
    paddingBottom: 16,
  },
  card: {
    overflow: 'visible',
    borderWidth: 1,
    borderColor: '#C9C5F2',
    borderRadius: 18,
    backgroundColor: '#F3F2FF',
  },
  header: {
    minHeight: 62,
    paddingLeft: 92,
    paddingRight: 16,
    justifyContent: 'center',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#E9E6FF',
  },
  mascot: {
    position: 'absolute',
    left: 4,
    bottom: -2,
    width: 88,
    height: 78,
  },
  headerCopy: {
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#756CC7',
  },
  title: {
    marginTop: 1,
    fontSize: 19,
    fontWeight: '900',
    color: '#3A326E',
  },
  list: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
  },
  item: {
    minHeight: 52,
    marginBottom: 8,
    paddingLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDDAF4',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  questionButton: {
    flex: 1,
    minHeight: 50,
    justifyContent: 'center',
    paddingVertical: 9,
  },
  questionText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#34334A',
  },
  editButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6E64CE',
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendArrow: {
    marginTop: -2,
    fontSize: 25,
    color: '#6256D9',
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingRight: 12,
    fontSize: 15,
    color: '#25243A',
  },
});

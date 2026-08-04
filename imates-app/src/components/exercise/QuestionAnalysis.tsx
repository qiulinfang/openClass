import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MathRenderer } from '../MathRenderer';

export interface QuestionAnalysisProps {
  question: any;
  show?: boolean;
}

export function QuestionAnalysis({ question, show = false }: QuestionAnalysisProps) {
  if (!show || !question) return null;

  const structured = question?.structuredContent || question;
  
  // 参考答案提取与格式化
  const rawAnswer = structured?.answer || question?.questionAnswer || '';
  const formattedAnswer = (() => {
    if (structured?.type === 'fill_in_blank' && Array.isArray(structured?.blanks)) {
      return structured.blanks
        .map((b: any, idx: number) => {
          const ansStr = Array.isArray(b.answers) ? b.answers.join(' 或 ') : b.answer || '';
          return `(${idx + 1}): ${ansStr}`;
        })
        .join('; ');
    }
    if (Array.isArray(rawAnswer)) return rawAnswer.join(', ');
    if (rawAnswer === undefined || rawAnswer === null || rawAnswer === '') return '';
    return String(rawAnswer);
  })();

  // 题目解析提取
  const rawAnalysis = (structured?.analysis || question?.questionAnalysis || question?.analysis || '').trim();
  const finalAnalysis = rawAnalysis.includes('###') ? '' : rawAnalysis;

  return (
    <View style={styles.questionFooter}>
      <View style={styles.analysisSection}>
        {/* 参考答案区块 */}
        <View style={styles.analysisBlock}>
          <Text style={styles.sectionTitle}>参考答案：</Text>
          {formattedAnswer ? (
            <View style={styles.sectionContent}>
              <MathRenderer content={formattedAnswer} textColor="#334155" />
            </View>
          ) : (
            <View style={styles.fieldMissingWarning}>
              <Text style={styles.fieldMissingWarningText}>【警告：未配置参考答案】</Text>
            </View>
          )}
        </View>

        {/* 题目解析区块 */}
        <View style={[styles.analysisBlock, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>题目解析：</Text>
          {finalAnalysis ? (
            <View style={styles.sectionContent}>
              <MathRenderer content={finalAnalysis} textColor="#334155" />
            </View>
          ) : (
            <Text style={styles.emptyAnalysisTip}>暂无解析</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  questionFooter: {
    marginTop: 24,
    paddingTop: 16,
  },
  analysisSection: {
    backgroundColor: '#f6f6f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  analysisBlock: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  sectionContent: {
    width: '100%',
  },
  fieldMissingWarning: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  fieldMissingWarningText: {
    color: '#ef4444',
    fontSize: 13,
  },
  emptyAnalysisTip: {
    color: '#94a3b8',
    fontSize: 14,
  },
});




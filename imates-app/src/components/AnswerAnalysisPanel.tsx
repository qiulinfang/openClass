import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { MathRenderer } from '@/components/MathRenderer';

export interface AnswerAnalysisPanelProps {
  answer?: string;
  analysis?: string;
  answerColor?: string;
  analysisColor?: string;
}

export function AnswerAnalysisPanel({
  answer,
  analysis,
  answerColor = '#10B981',
  analysisColor = '#475569',
}: AnswerAnalysisPanelProps) {
  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>✅ 参考答案：</Text>
        <Card style={styles.card}>
          <MathRenderer content={answer || '暂无答案'} textColor={answerColor} />
        </Card>
      </View>

      <View style={[styles.section, { marginTop: 14 }]}>
        <Text style={styles.label}>💡 题目解析：</Text>
        <Card style={styles.card}>
          <MathRenderer content={analysis || '暂无解析'} textColor={analysisColor} />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  section: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  card: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
});

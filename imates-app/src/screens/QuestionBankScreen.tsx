import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { ExerciseSolveScreen } from './ExerciseSolveScreen';
import { MistakeBookScreen } from './MistakeBookScreen';
import { HomeworkQuestionDetail } from '@/services/homework-service';

interface QuestionBankScreenProps {
  onLogout: () => void;
  onAskAI: (questionContent: string) => void;
  onGoAnswer: (questions: HomeworkQuestionDetail[], title: string, subject: string) => void;
}

type SubTabType = 'library' | 'mistakes' | 'favorites';

export function QuestionBankScreen({ onLogout, onAskAI, onGoAnswer }: QuestionBankScreenProps) {
  const [subTab, setSubTab] = useState<SubTabType>('library');

  return (
    <View style={styles.container}>
      {/* 顶部三栏切换卡 */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTabItem, subTab === 'library' && styles.activeSubTabItem]}
          onPress={() => setSubTab('library')}
        >
          <Text style={[styles.subTabText, subTab === 'library' && styles.activeSubTabText]}>选题库</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTabItem, subTab === 'mistakes' && styles.activeSubTabItem]}
          onPress={() => setSubTab('mistakes')}
        >
          <Text style={[styles.subTabText, subTab === 'mistakes' && styles.activeSubTabText]}>错题集</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTabItem, subTab === 'favorites' && styles.activeSubTabItem]}
          onPress={() => setSubTab('favorites')}
        >
          <Text style={[styles.subTabText, subTab === 'favorites' && styles.activeSubTabText]}>题目收藏</Text>
        </TouchableOpacity>
      </View>

      {/* 视图内容承载区 */}
      <View style={styles.contentView}>
        {subTab === 'library' && (
          <ExerciseSolveScreen onLogout={onLogout} onGoAnswer={onGoAnswer} />
        )}
        {subTab === 'mistakes' && (
          <MistakeBookScreen onLogout={onLogout} onAskAI={onAskAI} mode="mistake" onGoAnswer={onGoAnswer} />
        )}
        {subTab === 'favorites' && (
          <MistakeBookScreen onLogout={onLogout} onAskAI={onAskAI} mode="exercise" onGoAnswer={onGoAnswer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  subTabBar: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  subTabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeSubTabItem: {
    borderBottomColor: '#4F46E5',
  },
  subTabText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  activeSubTabText: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  contentView: {
    flex: 1,
  },
});

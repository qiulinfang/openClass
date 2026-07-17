import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { ExerciseSolveScreen } from './ExerciseSolveScreen';
import { MistakeBookScreen } from './MistakeBookScreen';

interface QuestionBankScreenProps {
  onLogout: () => void;
  onAskAI: (questionContent: string) => void;
}

export function QuestionBankScreen({ onLogout, onAskAI }: QuestionBankScreenProps) {
  const [subTab, setSubTab] = useState<'solve' | 'mistake'>('solve');

  return (
    <View style={styles.container}>
      {/* 顶部选项切换卡 */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTabItem, subTab === 'solve' && styles.activeSubTabItem]}
          onPress={() => setSubTab('solve')}
        >
          <Text style={[styles.subTabText, subTab === 'solve' && styles.activeSubTabText]}>自主刷题 ✍️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTabItem, subTab === 'mistake' && styles.activeSubTabItem]}
          onPress={() => setSubTab('mistake')}
        >
          <Text style={[styles.subTabText, subTab === 'mistake' && styles.activeSubTabText]}>错题 & 习题本 📚</Text>
        </TouchableOpacity>
      </View>
      
      {/* 视图内容承载区 */}
      <View style={styles.contentView}>
        {subTab === 'solve' ? (
          <ExerciseSolveScreen onLogout={onLogout} />
        ) : (
          <MistakeBookScreen onLogout={onLogout} onAskAI={onAskAI} />
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

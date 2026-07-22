import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, TextInput, Platform } from 'react-native';
import { ExerciseSolveScreen } from './ExerciseSolveScreen';
import { MistakeBookScreen } from './MistakeBookScreen';

interface QuestionBankScreenProps {
  onAskAI: (questionContent: string) => void;
}

type SubTabType = 'library' | 'mistakes';

export function QuestionBankScreen({ onAskAI }: QuestionBankScreenProps) {
  const [subTab, setSubTab] = useState<SubTabType>('library');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <View style={styles.container}>
      {/* 顶部搜索框 */}
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索我的习题或错题..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* 双项大 Tab 切换槽 */}
      <View style={styles.tabBarWrapper}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabItem, subTab === 'library' && styles.activeTabItem]}
            onPress={() => setSubTab('library')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, subTab === 'library' && styles.activeTabText]}>我的习题</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabItem, subTab === 'mistakes' && styles.activeTabItem]}
            onPress={() => setSubTab('mistakes')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, subTab === 'mistakes' && styles.activeTabText]}>错题本</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 视图内容承载区 */}
      <View style={styles.contentView}>
        {subTab === 'library' && (
          <ExerciseSolveScreen searchQuery={searchQuery} />
        )}
        {subTab === 'mistakes' && (
          <MistakeBookScreen onAskAI={onAskAI} mode="mistake" searchQuery={searchQuery} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f3ff', // Web content background
  },
  searchHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 8,
  },
  searchContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  searchInput: {
    width: '100%',
    height: '100%',
    fontSize: 14,
    color: '#111827',
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 0, // Reset default padding in Android
  },
  tabBarWrapper: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabItem: {
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  contentView: {
    flex: 1,
  },
});

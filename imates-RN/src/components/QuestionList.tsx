/**
 * 习题列表组件
 * 提供题目搜索、选择、操作等功能
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useQuestionStore } from '../stores/questionStore'
import type { ExerciseItem } from '../types/exercise'

interface QuestionListProps {
  onStartAiGuidance?: (question: ExerciseItem) => void
  onQuestionSelected?: (question: ExerciseItem, index: number) => void
  onSendQuestionToTeacher?: (question: ExerciseItem) => void
  onOpenMiniClass?: (question: ExerciseItem) => void
}

const QuestionList: React.FC<QuestionListProps> = ({
  onStartAiGuidance,
  onQuestionSelected,
  onSendQuestionToTeacher,
  onOpenMiniClass,
}) => {
  // Store 状态
  const { 
    questions, 
    currentQuestionIndex, 
    isLoading,
    fetchQuestions,
    selectQuestion,
    deleteQuestion,
    moveQuestionToTop,
  } = useQuestionStore()

  // 本地状态
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('math')

  // 过滤后的题目列表
  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) {
      return questions
    }

    const query = searchQuery.toLowerCase().trim()
    return questions.filter(
      (question) =>
        (question.title && question.title.toLowerCase().includes(query)) ||
        (question.question && question.question.toLowerCase().includes(query)),
    )
  }, [questions, searchQuery])

  // 显示的列表（搜索时用过滤后的，否则用原始列表）
  const displayList = useMemo(() => {
    return searchQuery ? filteredQuestions : questions
  }, [searchQuery, filteredQuestions, questions])

  // 加载题目列表
  useEffect(() => {
    loadQuestions()
  }, [selectedSubject])

  const loadQuestions = useCallback(async () => {
    try {
      await fetchQuestions(selectedSubject, true)
    } catch (error) {
      console.error('[QuestionList] 加载题目失败:', error)
      Alert.alert('错误', '加载题目失败，请重试')
    }
  }, [selectedSubject, fetchQuestions])

  // 选择题目
  const handleSelectQuestion = useCallback(async (question: ExerciseItem, index: number) => {
    // 找到题目在原始列表中的索引
    const originalIndex = questions.findIndex(q => q.id === question.id)
    if (originalIndex >= 0) {
      await selectQuestion(originalIndex)
      onQuestionSelected?.(question, index)
    }
  }, [questions, selectQuestion, onQuestionSelected])

  // 发送给AI
  const handleSendToAi = useCallback((question: ExerciseItem) => {
    onStartAiGuidance?.(question)
  }, [onStartAiGuidance])

  // 拍作业
  const handleSendToTeacher = useCallback((question: ExerciseItem) => {
    onSendQuestionToTeacher?.(question)
  }, [onSendQuestionToTeacher])

  // 微课
  const handleOpenMiniClass = useCallback((question: ExerciseItem) => {
    onOpenMiniClass?.(question)
  }, [onOpenMiniClass])

  // 删除题目
  const handleDeleteQuestion = useCallback((questionId: string) => {
    Alert.alert(
      '确认删除',
      '确定要删除这道题目吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteQuestion(questionId, selectedSubject)
            // 重新加载列表
            await loadQuestions()
          },
        },
      ]
    )
  }, [deleteQuestion, selectedSubject, loadQuestions])

  // 置顶题目
  const handleMoveToTop = useCallback((questionId: string) => {
    moveQuestionToTop(questionId)
  }, [moveQuestionToTop])

  // 渲染题目项
  const renderItem = useCallback(({ item, index }: { item: ExerciseItem; index: number }) => {
    const isSelected = searchQuery 
      ? false // 搜索模式下不显示选中状态
      : currentQuestionIndex >= 0 && 
        questions.findIndex(q => q.id === item.id) === currentQuestionIndex

    return (
      <TouchableOpacity
        style={[styles.questionCard, isSelected && styles.questionCardSelected]}
        onPress={() => handleSelectQuestion(item, index)}
        activeOpacity={0.7}
      >
        <View style={styles.questionBlock}>
          {/* 题目头部 */}
          <View style={styles.questionHeader}>
            <View style={styles.questionNumberContainer}>
              <Text style={styles.questionNumber}>{index + 1}</Text>
            </View>
            
            {/* 操作按钮组 */}
            {isSelected && (
              <View style={styles.questionActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.aiBtn]}
                  onPress={() => handleSendToAi(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionIcon}>🤖</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cameraBtn, styles.actionBtnMargin]}
                  onPress={() => handleSendToTeacher(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionIcon}>📷</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.videoBtn, styles.actionBtnMargin]}
                  onPress={() => handleOpenMiniClass(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionIcon}>🎥</Text>
                </TouchableOpacity>
                {index > 0 && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.topBtn, styles.actionBtnMargin]}
                    onPress={() => handleMoveToTop(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionIcon}>⬆️</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn, styles.actionBtnMargin]}
                  onPress={() => handleDeleteQuestion(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 题目内容 */}
          <View style={styles.questionContentArea}>
            <Text style={styles.questionContent} numberOfLines={3}>
              {item.title || item.question || '暂无内容'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }, [
    searchQuery,
    currentQuestionIndex,
    questions,
    handleSelectQuestion,
    handleSendToAi,
    handleSendToTeacher,
    handleOpenMiniClass,
    handleMoveToTop,
    handleDeleteQuestion,
  ])

  // 空状态
  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.emptyText}>加载中...</Text>
        </View>
      )
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>
          {searchQuery ? '🔍' : '📝'}
        </Text>
        <Text style={styles.emptyText}>
          {searchQuery ? '未找到匹配的题目' : '暂无题目'}
        </Text>
        {!searchQuery && (
          <TouchableOpacity
            style={styles.reloadBtn}
            onPress={loadQuestions}
            activeOpacity={0.7}
          >
            <Text style={styles.reloadBtnText}>🔄 重新加载</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* 搜索栏 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索题目..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9aa0a6"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
              activeOpacity={0.7}
            >
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 题目列表 */}
      <FlatList
        data={displayList}
        renderItem={renderItem}
        keyExtractor={(item) => item.id || item.bmNo}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
    color: '#5f6368',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#202124',
    paddingVertical: 4,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  clearIcon: {
    fontSize: 14,
    color: '#5f6368',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  questionCard: {
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: 'transparent',
    padding: 4,
  },
  questionCardSelected: {
    backgroundColor: '#e8f0fe',
  },
  questionBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  questionNumberContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  questionNumber: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  questionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f3f4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  aiBtn: {
    backgroundColor: '#e8f5e9',
  },
  cameraBtn: {
    backgroundColor: '#e3f2fd',
  },
  videoBtn: {
    backgroundColor: '#f3e5f5',
  },
  topBtn: {
    backgroundColor: '#fff3e0',
  },
  deleteBtn: {
    backgroundColor: '#ffebee',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionBtnMargin: {
    marginLeft: 8,
  },
  questionContentArea: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  questionContent: {
    fontSize: 14,
    color: '#202124',
    lineHeight: 22,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#5f6368',
    marginBottom: 20,
  },
  reloadBtn: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a73e8',
  },
  reloadBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
})

export default QuestionList


  questionNumber: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  questionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f3f4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  aiBtn: {
    backgroundColor: '#e8f5e9',
  },
  cameraBtn: {
    backgroundColor: '#e3f2fd',
  },
  videoBtn: {
    backgroundColor: '#f3e5f5',
  },
  topBtn: {
    backgroundColor: '#fff3e0',
  },
  deleteBtn: {
    backgroundColor: '#ffebee',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionBtnMargin: {
    marginLeft: 8,
  },
  questionContentArea: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  questionContent: {
    fontSize: 14,
    color: '#202124',
    lineHeight: 22,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#5f6368',
    marginBottom: 20,
  },
  reloadBtn: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a73e8',
  },
  reloadBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
})

export default QuestionList


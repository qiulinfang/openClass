import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { MathRenderer } from '@/components/MathRenderer';
import { ExerciseService, ExerciseItem } from '@/services/exercise-service';
import { SUBJECT_ID_TO_NAME, HomeworkQuestionDetail } from '@/services/homework-service';
import { useNavigation } from '@react-navigation/native';

interface ExerciseSolveScreenProps {
  onLogout: () => void;
  onAskAI?: (questionContent: string) => void;
}

const LightColors = {
  background: '#F8FAFC',
  cardBackground: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  primary: '#4F46E5', // 现代靛蓝色
  primaryLight: '#E0E7FF',
  success: '#10B981',
};

export function ExerciseSolveScreen({ onLogout, onAskAI }: ExerciseSolveScreenProps) {
  const navigation = useNavigation<any>();
  // 习题数据
  const [localExercises, setLocalExercises] = useState<ExerciseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 加载本地收藏习题
  const loadLocalExercises = useCallback(async () => {
    try {
      const data = await ExerciseService.getExercises();
      setLocalExercises(data);
      console.log(`[ExerciseSolveScreen] 📥 自选习题库加载成功！共载入本地收藏习题数: ${data.length}`);
    } catch (e) {
      console.warn('[ExerciseSolveScreen] 获取收藏习题失败:', e);
    }
  }, []);

  useEffect(() => {
    loadLocalExercises();
  }, [loadLocalExercises]);

  // 全部习题来自于 ExerciseService.getExercises()
  const allQuestions = localExercises;

  // 搜索过滤
  const filteredQuestions = allQuestions.filter(q => {
    return q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           q.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSelectQuestion = (q: ExerciseItem) => {
    const detail: HomeworkQuestionDetail = {
      id: q.id,
      questionId: q.id,
      questionContent: q.content,
      questionAnswer: q.answer,
      questionAnalysis: '',
    };
    
    navigation.navigate('HomeworkAnswer', {
      questionsList: [detail],
      homeworkTitle: q.title,
      homeworkSubject: q.subject,
      isReviewMode: true,
    });
  };

  // 模拟拍照搜题
  const handlePhotoSearchSimulate = () => {
    Alert.alert(
      '拍照搜题 📸',
      '选择搜题方式：',
      [
        {
          text: '拍照扫描',
          onPress: () => {
            if (allQuestions.length > 0) {
              const match = allQuestions[0];
              Alert.alert('识别成功', `已找到相匹配的习题：【${match.title}】！`);
              handleSelectQuestion(match);
            } else {
              Alert.alert('识别失败', '当前自选习题库为空，无法匹配题目！');
            }
          }
        },
        { text: '取消', style: 'cancel' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.searchBarRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索预置题目或已收藏习题..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.photoBtn} onPress={handlePhotoSearchSimulate}>
            <Text style={styles.photoBtnText}>📸 拍照搜题</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredQuestions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={11}
          removeClippedSubviews={false}
          updateCellsBatchingPeriod={100}
          renderItem={({ item }) => {
            const isPreset = item.id.startsWith('preset');
            const subjectName = SUBJECT_ID_TO_NAME[item.subject] || '学科';
            return (
              <TouchableOpacity onPress={() => handleSelectQuestion(item)} activeOpacity={0.85}>
                <Card style={styles.questionCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.badgeLabel}>{isPreset ? '💡 推荐习题' : '⭐ 我的收藏'}</Text>
                      <Text style={styles.subjectText}> • {subjectName}</Text>
                    </View>
                    <Text style={styles.goBtnText}>去查看 ➔</Text>
                  </View>
                  <Text style={styles.questionTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.questionPreview}>
                    <MathRenderer content={item.content} textColor="#0F172A" />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>没有找到符合条件的题目 📭</Text>
            </View>
          }
        />
      </View>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
    marginRight: 10,
  },
  photoBtn: {
    height: 40,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  photoBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 20,
  },
  questionCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subjectText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  goBtnText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '700',
  },
  questionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  questionPreview: {
    marginTop: 2,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },


});

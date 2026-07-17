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

interface ExerciseSolveScreenProps {
  onLogout: () => void;
  onGoAnswer: (questions: HomeworkQuestionDetail[], title: string, subject: string) => void;
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

const PRESET_QUESTIONS: ExerciseItem[] = [
  {
    id: 'preset-math-1',
    title: '二次函数的对称轴与最值',
    subject: '2',
    content: '已知二次函数 $f(x) = x^2 - 4x + 7$。\\n(1) 求二次函数图象的对称轴与顶点坐标；\\n(2) 当 $x \\in [1, 5]$ 时，求函数 $f(x)$ 的最大值与最小值。',
    answer: '对称轴: x=2, 顶点: (2, 3), 最小值: 3, 最大值: 12',
    timestamp: Date.now()
  },
  {
    id: 'preset-physics-1',
    title: '物体的斜面滑块滑行计算',
    subject: '4',
    content: '一个质量为 $m = 2\\text{kg}$ 的滑块以初速度 $v_0 = 10\\text{m/s}$ 沿倾角为 $\\theta = 37^\\circ$ 的斜面向上滑行。已知滑块与斜面间的动摩擦因数 $\\mu = 0.5$（重力加速度 $g = 10\\text{m/s}^2$）。\\n(1) 求滑块向上滑行时的加速度大小；\\n(2) 求滑块在斜面上滑行的最大位移 $s$。',
    answer: '加速度: 10m/s^2, 最大位移: 5m',
    timestamp: Date.now()
  },
  {
    id: 'preset-chemistry-1',
    title: '化学电池的电极反应',
    subject: '5',
    content: '以稀硫酸为电解质溶液的铜锌原电池中，锌片作为负极，铜片作为正极。\\n(1) 写出正极与负极的电极反应式；\\n(2) 计算当电路中转移 $0.2\\text{mol}$ 电子时，正极生成的氢气在标准状况下的体积。',
    answer: '负极: Zn - 2e- = Zn2+; 正极: 2H+ + 2e- = H2; 体积: 2.24L',
    timestamp: Date.now()
  },
  {
    id: 'preset-biology-1',
    title: '孟德尔豌豆遗传实验分析',
    subject: '6',
    content: '已知豌豆的黄色子叶对绿色子叶为显性。现有杂合的黄色子叶豌豆进行自交，求：\\n(1) 子一代中黄色子叶与绿色子叶的表型比例；\\n(2) 子一代黄色子叶豌豆中，杂合子所占的比例。',
    answer: '(1) 黄色:绿色 = 3:1; (2) 杂合子比例为 2/3',
    timestamp: Date.now()
  }
];

export function ExerciseSolveScreen({ onLogout, onGoAnswer, onAskAI }: ExerciseSolveScreenProps) {
  // 习题数据
  const [localExercises, setLocalExercises] = useState<ExerciseItem[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<ExerciseItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);

  // 加载本地收藏习题
  const loadLocalExercises = useCallback(async () => {
    try {
      const data = await ExerciseService.getExercises();
      setLocalExercises(data);
      console.log(`[ExerciseSolveScreen] 📥 自选习题库加载成功！共载入云端收藏习题数: ${data.length}`);
    } catch (e) {
      console.warn('[ExerciseSolveScreen] 获取收藏习题失败:', e);
    }
  }, []);

  useEffect(() => {
    loadLocalExercises();
  }, [loadLocalExercises]);

  // 融合“本地收藏”与“系统预置”题目的完整列表
  const allQuestions = [...PRESET_QUESTIONS, ...localExercises];

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
    onGoAnswer([detail], q.title, q.subject);
  };

  const handleAskAIFromModal = () => {
    if (activeQuestion && onAskAI) {
      onAskAI(activeQuestion.content);
      setActiveQuestion(null);
    }
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
            Alert.alert('识别成功', '已找到相匹配的系统习题：【二次函数的对称轴与最值】！');
            const match = allQuestions.find(q => q.id === 'preset-math-1');
            if (match) handleSelectQuestion(match);
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
                    <MathRenderer content={item.content.substring(0, 80) + '...'} textColor="#475569" />
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

      {/* 题目详情弹窗 Modal */}
      {activeQuestion && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setActiveQuestion(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>题目详情</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setActiveQuestion(null)}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.questionMeta}>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectBadgeText}>
                      {SUBJECT_ID_TO_NAME[activeQuestion.subject] || '学科'}
                    </Text>
                  </View>
                  <Text style={styles.questionTitleDetail}>{activeQuestion.title}</Text>
                </View>

                {/* 题干内容 */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionLabel}>题干：</Text>
                  <MathRenderer content={activeQuestion.content} textColor="#0F172A" />
                </View>

                {/* 参考答案区域 */}
                <View style={styles.modalSection}>
                  <TouchableOpacity
                    style={styles.toggleAnswerBtn}
                    onPress={() => setShowAnswer(!showAnswer)}
                  >
                    <Text style={styles.toggleAnswerText}>
                      {showAnswer ? '🔑 收起参考答案' : '🔑 查看参考答案'}
                    </Text>
                  </TouchableOpacity>
                  
                  {showAnswer && (
                    <View style={styles.answerBox}>
                      <MathRenderer content={activeQuestion.answer || '暂无参考答案'} textColor="#10B981" />
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* 底部功能按钮 */}
              <View style={styles.modalFooter}>
                {onAskAI && (
                  <TouchableOpacity style={styles.askAiBtn} onPress={handleAskAIFromModal}>
                    <Text style={styles.askAiBtnText}>🦦 问海獭 (智能答疑)</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveQuestion(null)}>
                  <Text style={styles.cancelBtnText}>关闭</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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

  // Modal 弹窗样式
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
  },
  questionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 10,
  },
  subjectBadgeText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '700',
  },
  questionTitleDetail: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  modalSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  toggleAnswerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  toggleAnswerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  answerBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 10,
  },
  askAiBtn: {
    flex: 1.4,
    height: 40,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  askAiBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
});

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';

interface MicroClassScreenProps {
  onLogout: () => void;
}

interface MicroClass {
  id: string;
  title: string;
  subject: '数学' | '生物';
  duration: string;
  progress: number;
  chapter: string;
}

const MOCK_MICRO_CLASSES: MicroClass[] = [
  {
    id: 'mc_1',
    title: '拉普拉斯变换的基本概念与定义',
    subject: '数学',
    duration: '15分钟',
    progress: 80,
    chapter: '高等数学 - 积分变换',
  },
  {
    id: 'mc_2',
    title: '余弦函数图像的周期性与对称性',
    subject: '数学',
    duration: '12分钟',
    progress: 45,
    chapter: '三角函数与几何',
  },
  {
    id: 'mc_3',
    title: '细胞有丝分裂与减数分裂对比解析',
    subject: '生物',
    duration: '20分钟',
    progress: 0,
    chapter: '必修二 - 遗传与进化',
  },
  {
    id: 'mc_4',
    title: '拉普拉斯积分的收敛条件证明',
    subject: '数学',
    duration: '18分钟',
    progress: 10,
    chapter: '高等数学 - 积分变换',
  },
];

const LightColors = {
  background: '#F8FAFC',
  cardBackground: '#FFFFFF',
  cardBorder: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  primary: '#3B82F6',
};

export function MicroClassScreen({ onLogout }: MicroClassScreenProps) {
  const renderMicroClassItem = ({ item }: { item: MicroClass }) => {
    const isMath = item.subject === '数学';
    return (
      <Card style={styles.contentCard}>
        <View style={styles.cardHeaderRow}>
          <Badge
            text={item.subject}
            style={{
              backgroundColor: isMath ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              borderColor: isMath ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)',
              color: isMath ? '#2563EB' : '#059669',
            }}
          />
          <Text style={styles.cardHeaderSub}>{item.chapter}</Text>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${item.progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {item.progress > 0 ? `已学习 ${item.progress}%` : '未学习'}
          </Text>
        </View>

        <View style={styles.cardFooterRow}>
          <Text style={styles.durationText}>⏱️ 时长: {item.duration}</Text>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: LightColors.primary }]}>
            <Text style={styles.actionBtnText}>{item.progress === 100 ? '重新学习' : '开始学习'}</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 顶部标题与用户信息栏 */}
      <View style={styles.header}>
        <View style={styles.userProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>学</Text>
          </View>
          <View>
            <Text style={styles.welcomeText}>您好，</Text>
            <Text style={styles.userName}>智能伴侣学员 🎓</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.logoutIconButton} onPress={onLogout}>
          <Text style={styles.logoutIconText}>🚪</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <View style={styles.viewHeader}>
          <Text style={styles.viewTitle}>推荐微课</Text>
          <Text style={styles.viewSub}>精选核心知识点短视频，快速攻克难关</Text>
        </View>

        <FlatList
          data={MOCK_MICRO_CLASSES}
          renderItem={renderMicroClassItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LightColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: LightColors.cardBorder,
    backgroundColor: LightColors.cardBackground,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: LightColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  welcomeText: {
    fontSize: 11,
    color: LightColors.textSecondary,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: LightColors.textPrimary,
  },
  logoutIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoutIconText: {
    fontSize: 14,
  },
  container: {
    flex: 1,
  },
  viewHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  viewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: LightColors.textPrimary,
    marginBottom: 4,
  },
  viewSub: {
    fontSize: 12,
    color: LightColors.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  contentCard: {
    marginBottom: 14,
    padding: 16,
    backgroundColor: LightColors.cardBackground,
    borderColor: LightColors.cardBorder,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderSub: {
    fontSize: 11,
    color: LightColors.textSecondary,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LightColors.textPrimary,
    lineHeight: 22,
    marginBottom: 12,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  progressBarBg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    marginRight: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: LightColors.primary,
  },
  progressText: {
    fontSize: 11,
    color: LightColors.textSecondary,
    minWidth: 60,
    textAlign: 'right',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 12,
  },
  durationText: {
    fontSize: 12,
    color: LightColors.textSecondary,
  },
  actionBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

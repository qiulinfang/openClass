import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  SafeAreaView,
} from 'react-native';
import { ScorePointItem } from './ScorePointCardList';
import { HomeworkJudgeDetailPanel } from './HomeworkJudgeDetailPanel';
import { HomeworkQuestionDetail } from '@/services/homework-service';
import { GlobalAiAssistant, AiChatContext } from '@/features/ai-chat';

interface HomeworkChatPanelDrawerProps {
  visible: boolean;
  onClose: () => void;
  questions?: HomeworkQuestionDetail[];
  currentIndex?: number;
  onSelectQuestion?: (index: number) => void;
  judgeDetailData?: any;
  scorePointList?: ScorePointItem[];
  activePointIndex?: number | null;
  selectedPointIndex?: number | null;
  onLocatePoint?: (item: ScorePointItem, index: number, questionIndex?: number) => void;
  aiContext?: AiChatContext | null;
  initialTab?: 'judge' | 'ai';
}

export function HomeworkChatPanelDrawer({
  visible,
  onClose,
  questions = [],
  currentIndex = 0,
  onSelectQuestion,
  judgeDetailData,
  scorePointList = [],
  activePointIndex,
  selectedPointIndex,
  onLocatePoint,
  aiContext,
  initialTab = 'judge',
}: HomeworkChatPanelDrawerProps) {
  const [activeTab, setActiveTab] = useState<'judge' | 'ai'>(initialTab);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* 侧边栏 Header 顶栏 */}
        <View style={styles.headerBar}>
          <View style={styles.tabGroup}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'judge' && styles.activeTabBtn]}
              onPress={() => setActiveTab('judge')}
            >
              <Text style={[styles.tabText, activeTab === 'judge' && styles.activeTabText]}>
                📋 判罚明细
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'ai' && styles.activeTabBtn]}
              onPress={() => setActiveTab('ai')}
            >
              <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>
                🤖 学伴 AI 答疑
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* 内容容器 */}
        <View style={styles.bodyContent}>
          {activeTab === 'judge' ? (
            <HomeworkJudgeDetailPanel
              questions={questions}
              currentIndex={currentIndex}
              onSelectQuestion={onSelectQuestion}
              judgeDetailData={judgeDetailData}
              activePointIndex={activePointIndex}
              selectedPointIndex={selectedPointIndex}
              onLocatePoint={(item, idx, qIdx) => {
                if (onLocatePoint) {
                  onLocatePoint(item, idx, qIdx);
                }
              }}
            />
          ) : (
            <View style={styles.aiChatContainer}>
              <GlobalAiAssistant
                context={aiContext || undefined}
                hidden={false}
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  activeTabBtn: {
    backgroundColor: 'rgba(110, 85, 255, 0.1)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#6E55FF',
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '700',
  },
  bodyContent: {
    flex: 1,
  },
  aiChatContainer: {
    flex: 1,
    padding: 12,
  },
});

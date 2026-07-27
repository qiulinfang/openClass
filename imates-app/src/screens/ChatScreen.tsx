import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AiChatWorkspace,
  GENERAL_AI_CHAT_CONTEXT,
} from '@/features/ai-chat';
import type { AiChatWorkspaceTab } from '@/features/ai-chat/types';

interface ChatScreenProps {
  onBack?: () => void;
  initialTab?: AiChatWorkspaceTab;
  initialCategory?: 'companion' | 'teacher';
  initialSessionId?: string;
}

export function ChatScreen({
  onBack,
  initialTab,
  initialCategory,
  initialSessionId,
}: ChatScreenProps) {
  return (
    <View style={styles.container}>
      <AiChatWorkspace
        context={GENERAL_AI_CHAT_CONTEXT}
        onClose={onBack}
        prefillStorageKey="CHAT_PREFILL"
        respectBottomSafeArea={false}
        initialTab={initialTab}
        initialCategory={initialCategory}
        initialSessionId={initialSessionId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7FC',
  },
});

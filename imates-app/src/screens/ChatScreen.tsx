import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AiChatWorkspace,
  GENERAL_AI_CHAT_CONTEXT,
} from '@/features/ai-chat';

interface ChatScreenProps {
  onBack?: () => void;
}

export function ChatScreen({ onBack }: ChatScreenProps) {
  return (
    <View style={styles.container}>
      <AiChatWorkspace
        context={GENERAL_AI_CHAT_CONTEXT}
        onClose={onBack}
        prefillStorageKey="CHAT_PREFILL"
        respectBottomSafeArea={false}
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

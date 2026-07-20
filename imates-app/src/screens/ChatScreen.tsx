import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AiChatWorkspace, type AiChatContext } from '@/features/ai-chat';

interface ChatScreenProps {
  onBack?: () => void;
}

export function ChatScreen({ onBack }: ChatScreenProps) {
  const context = useMemo<AiChatContext>(
    () => ({
      scene: 'general',
      scopeKey: 'general',
      title: 'iMates 智能伴侣',
      subtitle: '全科学习问答',
    }),
    []
  );

  return (
    <View style={styles.container}>
      <AiChatWorkspace
        context={context}
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

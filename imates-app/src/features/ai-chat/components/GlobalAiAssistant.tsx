import React, { useCallback, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AiChatWorkspace } from './AiChatWorkspace';
import { GENERAL_AI_CHAT_CONTEXT } from '../general-context';

interface GlobalAiAssistantProps {
  hidden?: boolean;
}

const SLOTH_IMAGE = require('../../../../assets/ai-sloth.png');

function GlobalAiAssistantComponent({
  hidden = false,
}: GlobalAiAssistantProps) {
  const [chatVisible, setChatVisible] = useState(false);

  const openChat = useCallback(() => {
    setChatVisible(true);
  }, []);

  const closeChat = useCallback(() => {
    setChatVisible(false);
  }, []);

  return (
    <>
      {!hidden && !chatVisible ? (
        <View style={styles.floatingLayer} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [
              styles.floatingButton,
              pressed && styles.floatingButtonPressed,
            ]}
            onPress={openChat}
            accessibilityRole="button"
            accessibilityLabel="打开 AI 问答"
            accessibilityHint="与 iMates 智能伴侣对话"
          >
            <Image
              source={SLOTH_IMAGE}
              style={styles.slothImage}
              resizeMode="contain"
              fadeDuration={0}
            />
            <View style={styles.labelPill}>
              <Text style={styles.labelText}>问 AI</Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {chatVisible ? (
        <Modal
          visible
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent={false}
          onRequestClose={closeChat}
        >
          <SafeAreaView style={styles.chatSafeArea}>
            <AiChatWorkspace
              context={GENERAL_AI_CHAT_CONTEXT}
              onClose={closeChat}
              prefillStorageKey="CHAT_PREFILL"
              respectBottomSafeArea={false}
            />
          </SafeAreaView>
        </Modal>
      ) : null}
    </>
  );
}

export const GlobalAiAssistant = React.memo(GlobalAiAssistantComponent);

const styles = StyleSheet.create({
  floatingLayer: {
    position: 'absolute',
    right: 10,
    bottom: Platform.OS === 'ios' ? 72 : 66,
    zIndex: 100,
    elevation: 16,
  },
  floatingButton: {
    width: 76,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  floatingButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  slothImage: {
    width: 72,
    height: 82,
  },
  labelPill: {
    position: 'absolute',
    bottom: 0,
    minWidth: 48,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDD8FF',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#241B52',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 4,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6256D9',
  },
  chatSafeArea: {
    flex: 1,
    backgroundColor: '#F7F7FC',
  },
});

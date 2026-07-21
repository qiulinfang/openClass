import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Image,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { AiChatWorkspace } from './AiChatWorkspace';
import { GENERAL_AI_CHAT_CONTEXT } from '../general-context';
import type { AiChatContext } from '../types';

interface GlobalAiAssistantProps {
  hidden?: boolean;
  context?: AiChatContext;
  mascotSource?: ImageSourcePropType;
  accessibilityLabel?: string;
  prefillStorageKey?: string;
}

const OTTER_ANIMATION = require('../../../../assets/ai-otter.webp');
const FLOATING_WIDTH = 76;
const FLOATING_HEIGHT = 86;
const EDGE_INSET = 4;
const INITIAL_BOTTOM_CLEARANCE = 68;

function GlobalAiAssistantComponent({
  hidden = false,
  context = GENERAL_AI_CHAT_CONTEXT,
  mascotSource = OTTER_ANIMATION,
  accessibilityLabel = '打开 AI 问答',
  prefillStorageKey = 'CHAT_PREFILL',
}: GlobalAiAssistantProps) {
  const insets = useSafeAreaInsets();
  const modalTopInset =
    Platform.OS === 'ios'
      ? Math.max(
          insets.top,
          initialWindowMetrics?.insets.top || 0,
          insets.top === 0 && !initialWindowMetrics?.insets.top
            ? 44
            : 0
        )
      : 0;
  const [chatVisible, setChatVisible] = useState(false);
  const [positionReady, setPositionReady] = useState(false);
  const position = useRef(new Animated.ValueXY()).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const positionRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const boundsRef = useRef({ width: 0, height: 0 });
  const initializedRef = useRef(false);
  const movedRef = useRef(false);

  const openChat = useCallback(() => {
    setChatVisible(true);
  }, []);

  const closeChat = useCallback(() => {
    setChatVisible(false);
  }, []);

  const clampPosition = useCallback((x: number, y: number) => {
    const { width, height } = boundsRef.current;
    return {
      x: Math.max(
        EDGE_INSET,
        Math.min(Math.max(EDGE_INSET, width - FLOATING_WIDTH - EDGE_INSET), x)
      ),
      y: Math.max(
        EDGE_INSET,
        Math.min(
          Math.max(EDGE_INSET, height - FLOATING_HEIGHT - EDGE_INSET),
          y
        )
      ),
    };
  }, []);

  const handleLayerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      boundsRef.current = { width, height };
      const nextPosition = initializedRef.current
        ? clampPosition(positionRef.current.x, positionRef.current.y)
        : clampPosition(
            width - FLOATING_WIDTH - 10,
            height -
              FLOATING_HEIGHT -
              INITIAL_BOTTOM_CLEARANCE
          );
      initializedRef.current = true;
      positionRef.current = nextPosition;
      position.setValue(nextPosition);
      setPositionReady(true);
    },
    [clampPosition, position]
  );

  const restorePressScale = useCallback(() => {
    Animated.spring(pressScale, {
      toValue: 1,
      speed: 24,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [pressScale]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
        onPanResponderGrant: () => {
          movedRef.current = false;
          dragStartRef.current = positionRef.current;
          Animated.timing(pressScale, {
            toValue: 0.96,
            duration: 90,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (_, gesture) => {
          if (
            !movedRef.current &&
            Math.hypot(gesture.dx, gesture.dy) <= 5
          ) {
            return;
          }
          movedRef.current = true;
          const nextPosition = clampPosition(
            dragStartRef.current.x + gesture.dx,
            dragStartRef.current.y + gesture.dy
          );
          positionRef.current = nextPosition;
          position.setValue(nextPosition);
        },
        onPanResponderRelease: () => {
          restorePressScale();
          if (!movedRef.current) openChat();
        },
        onPanResponderTerminate: restorePressScale,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [clampPosition, openChat, position, pressScale, restorePressScale]
  );

  return (
    <>
      {!hidden && !chatVisible ? (
        <View
          style={styles.floatingLayer}
          pointerEvents="box-none"
          onLayout={handleLayerLayout}
        >
          <Animated.View
            {...panResponder.panHandlers}
            accessible
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint="轻点打开，按住可在屏幕内拖动"
            onAccessibilityTap={openChat}
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[
              styles.floatingPosition,
              {
                opacity: positionReady ? 1 : 0,
                transform: position.getTranslateTransform(),
              },
            ]}
          >
            <Animated.View
              style={[
                styles.floatingButton,
                { transform: [{ scale: pressScale }] },
              ]}
            >
              <Image
                source={mascotSource}
                style={styles.slothImage}
                resizeMode="contain"
                fadeDuration={0}
              />
            </Animated.View>
          </Animated.View>
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
          <SafeAreaView
            style={styles.chatSafeArea}
            edges={['left', 'right', 'bottom']}
          >
            <View
              style={[
                styles.chatContent,
                { paddingTop: modalTopInset },
              ]}
            >
              <AiChatWorkspace
                context={context}
                onClose={closeChat}
                prefillStorageKey={prefillStorageKey}
                respectBottomSafeArea={false}
              />
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </>
  );
}

export const GlobalAiAssistant = React.memo(GlobalAiAssistantComponent);

const styles = StyleSheet.create({
  floatingLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  floatingPosition: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FLOATING_WIDTH,
    height: FLOATING_HEIGHT,
    zIndex: 1,
    elevation: 16,
  },
  floatingButton: {
    width: FLOATING_WIDTH,
    height: FLOATING_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slothImage: {
    width: FLOATING_WIDTH,
    height: FLOATING_HEIGHT,
  },
  chatSafeArea: {
    flex: 1,
    backgroundColor: '#F7F7FC',
  },
  chatContent: {
    flex: 1,
  },
});

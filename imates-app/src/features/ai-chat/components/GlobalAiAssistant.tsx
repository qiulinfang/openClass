import React, {
  useCallback,
  useEffect,
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
import { storage } from '@/services/storage';

interface GlobalAiAssistantProps {
  hidden?: boolean;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  context?: AiChatContext;
  mascotSource?: ImageSourcePropType;
  accessibilityLabel?: string;
  prefillStorageKey?: string;
}

const OTTER_ANIMATION = require('../../../../assets/ai-otter.webp');
const FLOATING_WIDTH = 76;
const FLOATING_HEIGHT = 86;
// 对齐 Web `.textbookip-float`：图片宽 120，right: -64，仅保留左侧半身在屏内。
const EXERCISE_FLOATING_WIDTH = 120;
const EXERCISE_FLOATING_HEIGHT = 105;
const EXERCISE_RIGHT_HIDDEN_INSET = 64;
const EXERCISE_INITIAL_BOTTOM_CLEARANCE = 189;
const EDGE_INSET = 4;
const INITIAL_BOTTOM_CLEARANCE = 68;
const POSITION_STORAGE_KEY = 'NORMAL_AI_ASSISTANT_FLOATING_POSITION_V1';

interface AssistantPositionCache {
  x: number;
  y: number;
}

let assistantPositionCache: AssistantPositionCache | null = null;
let assistantPositionHydrated = false;
let assistantPositionLoadPromise: Promise<AssistantPositionCache | null> | null = null;
let assistantPositionWritePromise: Promise<void> = Promise.resolve();

const hydrateAssistantPosition = (): Promise<AssistantPositionCache | null> => {
  if (assistantPositionHydrated) {
    return Promise.resolve(assistantPositionCache);
  }
  if (assistantPositionLoadPromise) return assistantPositionLoadPromise;

  assistantPositionLoadPromise = storage
    .getItem(POSITION_STORAGE_KEY)
    .then((saved) => {
      if (!saved) return null;
      try {
        const parsed = JSON.parse(saved) as Partial<AssistantPositionCache>;
        if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
        return {
          x: Number(parsed.x),
          y: Number(parsed.y),
        };
      } catch {
        return null;
      }
    })
    .catch(() => null)
    .then((cached) => {
      assistantPositionCache = cached;
      assistantPositionHydrated = true;
      return cached;
    });

  return assistantPositionLoadPromise;
};

const persistAssistantPosition = (next: AssistantPositionCache) => {
  assistantPositionCache = next;
  assistantPositionHydrated = true;
  const serialized = JSON.stringify(next);
  assistantPositionWritePromise = assistantPositionWritePromise
    .catch(() => undefined)
    .then(() => storage.setItem(POSITION_STORAGE_KEY, serialized));
};

function GlobalAiAssistantComponent({
  hidden = false,
  visible,
  onVisibleChange,
  context = GENERAL_AI_CHAT_CONTEXT,
  mascotSource = OTTER_ANIMATION,
  accessibilityLabel = '打开 AI 问答',
  prefillStorageKey = 'CHAT_PREFILL',
}: GlobalAiAssistantProps) {
  const insets = useSafeAreaInsets();
  const isExerciseAssistant = context.scene === 'exercise';
  const floatingWidth = isExerciseAssistant
    ? EXERCISE_FLOATING_WIDTH
    : FLOATING_WIDTH;
  const floatingHeight = isExerciseAssistant
    ? EXERCISE_FLOATING_HEIGHT
    : FLOATING_HEIGHT;
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
  const [internalChatVisible, setInternalChatVisible] = useState(false);
  const chatVisible = visible ?? internalChatVisible;
  const [positionReady, setPositionReady] = useState(false);
  const position = useRef(new Animated.ValueXY()).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const positionRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const boundsRef = useRef({ width: 0, height: 0 });
  const initializedRef = useRef(false);
  const movedRef = useRef(false);

  const openChat = useCallback(() => {
    if (visible === undefined) setInternalChatVisible(true);
    onVisibleChange?.(true);
  }, [onVisibleChange, visible]);

  const closeChat = useCallback(() => {
    if (visible === undefined) setInternalChatVisible(false);
    onVisibleChange?.(false);
  }, [onVisibleChange, visible]);

  const clampPosition = useCallback((x: number, y: number) => {
    const { width, height } = boundsRef.current;
    const rightEdgeX = Math.max(
      0,
      width - floatingWidth + EXERCISE_RIGHT_HIDDEN_INSET
    );
    return {
      x: isExerciseAssistant
        ? rightEdgeX
        : Math.max(
            EDGE_INSET,
            Math.min(
              Math.max(EDGE_INSET, width - floatingWidth - EDGE_INSET),
              x
            )
          ),
      y: Math.max(
        EDGE_INSET,
        Math.min(
          Math.max(EDGE_INSET, height - floatingHeight - EDGE_INSET),
          y
        )
      ),
    };
  }, [floatingHeight, floatingWidth, isExerciseAssistant]);

  const resolveCachedPosition = useCallback(() => {
    const { width, height } = boundsRef.current;
    const fallbackX = width - floatingWidth - 10;
    const fallbackY =
      height -
      floatingHeight -
      (isExerciseAssistant
        ? EXERCISE_INITIAL_BOTTOM_CLEARANCE
        : INITIAL_BOTTOM_CLEARANCE);
    if (isExerciseAssistant) {
      return clampPosition(fallbackX, fallbackY);
    }
    return clampPosition(
      assistantPositionCache?.x ?? fallbackX,
      assistantPositionCache?.y ?? fallbackY
    );
  }, [clampPosition, floatingHeight, floatingWidth, isExerciseAssistant]);

  const applyPosition = useCallback(
    (nextPosition: { x: number; y: number }) => {
      initializedRef.current = true;
      positionRef.current = nextPosition;
      position.setValue(nextPosition);
      setPositionReady(true);
    },
    [position]
  );

  useEffect(() => {
    // 题目详情的右侧半身形态使用自身默认位置，不读取正常海獭的缓存。
    if (isExerciseAssistant) return;

    let disposed = false;
    void hydrateAssistantPosition().then(() => {
      if (
        disposed ||
        boundsRef.current.width <= 0 ||
        boundsRef.current.height <= 0
      ) {
        return;
      }
      applyPosition(resolveCachedPosition());
    });
    return () => {
      disposed = true;
    };
  }, [applyPosition, isExerciseAssistant, resolveCachedPosition]);

  const handleLayerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      boundsRef.current = { width, height };
      const nextPosition = initializedRef.current
        ? clampPosition(positionRef.current.x, positionRef.current.y)
        : isExerciseAssistant || assistantPositionHydrated
          ? resolveCachedPosition()
          : clampPosition(
              width - floatingWidth - 10,
              height -
                floatingHeight -
                (isExerciseAssistant
                  ? EXERCISE_INITIAL_BOTTOM_CLEARANCE
                  : INITIAL_BOTTOM_CLEARANCE)
            );
      initializedRef.current = true;
      positionRef.current = nextPosition;
      position.setValue(nextPosition);
      setPositionReady(isExerciseAssistant || assistantPositionHydrated);
    },
    [
      clampPosition,
      floatingHeight,
      floatingWidth,
      isExerciseAssistant,
      position,
      resolveCachedPosition,
    ]
  );

  const restorePressScale = useCallback(() => {
    Animated.spring(pressScale, {
      toValue: 1,
      speed: 24,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [pressScale]);

  const saveCurrentPosition = useCallback(() => {
    // 只缓存完整的正常海獭；右侧半身形态不会覆盖它的位置。
    if (isExerciseAssistant) return;
    const current = positionRef.current;
    persistAssistantPosition({
      x: current.x,
      y: current.y,
    });
  }, [isExerciseAssistant]);

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
          // 题目场景锁定横坐标，只响应沿右侧的纵向拖动。
          const nextPosition = clampPosition(
            isExerciseAssistant
              ? dragStartRef.current.x
              : dragStartRef.current.x + gesture.dx,
            dragStartRef.current.y + gesture.dy
          );
          positionRef.current = nextPosition;
          position.setValue(nextPosition);
        },
        onPanResponderRelease: () => {
          restorePressScale();
          if (movedRef.current) {
            saveCurrentPosition();
          } else {
            openChat();
          }
        },
        onPanResponderTerminate: () => {
          restorePressScale();
          if (movedRef.current) saveCurrentPosition();
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [
      clampPosition,
      isExerciseAssistant,
      openChat,
      position,
      pressScale,
      restorePressScale,
      saveCurrentPosition,
    ]
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
            accessibilityHint={
              isExerciseAssistant
                ? '轻点打开，按住可沿右侧上下拖动'
                : '轻点打开，按住可在屏幕内拖动'
            }
            onAccessibilityTap={openChat}
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[
              styles.floatingPosition,
              {
                width: floatingWidth,
                height: floatingHeight,
                opacity: positionReady ? 1 : 0,
                transform: position.getTranslateTransform(),
              },
            ]}
          >
            <Animated.View
              style={[
                styles.floatingButton,
                {
                  width: floatingWidth,
                  height: floatingHeight,
                  transform: [{ scale: pressScale }],
                },
              ]}
            >
              <Image
                source={mascotSource}
                style={[
                  styles.slothImage,
                  { width: floatingWidth, height: floatingHeight },
                ]}
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

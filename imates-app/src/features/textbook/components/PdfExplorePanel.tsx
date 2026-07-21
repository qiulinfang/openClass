import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AiChatWorkspace, type AiChatContext } from '@/features/ai-chat';
import type { PdfExploreCapture } from './PdfExploreViewer';

interface PdfExplorePanelProps {
  visible: boolean;
  capture: PdfExploreCapture | null;
  resourceId: string;
  resourceName: string;
  subject: string;
  sectionName: string;
  showPageNumber?: boolean;
  onClose: () => void;
  onReselect?: () => void;
}

export function PdfExplorePanel({
  visible,
  capture,
  resourceId,
  resourceName,
  subject,
  sectionName,
  showPageNumber = true,
  onClose,
  onReselect,
}: PdfExplorePanelProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const collapsedHeight = windowHeight - Math.max(72, windowHeight * 0.12);
  const sheetHeight = useRef(new Animated.Value(collapsedHeight)).current;
  const gestureStartRef = useRef(collapsedHeight);
  const [expanded, setExpanded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const settleSheet = useCallback(
    (nextExpanded: boolean) => {
      setExpanded(nextExpanded);
      Animated.timing(sheetHeight, {
        toValue: nextExpanded ? windowHeight : collapsedHeight,
        duration: reduceMotion ? 0 : 220,
        useNativeDriver: false,
      }).start();
    },
    [collapsedHeight, reduceMotion, sheetHeight, windowHeight]
  );

  useEffect(() => {
    if (!visible) return;
    setExpanded(false);
    sheetHeight.setValue(collapsedHeight);
  }, [collapsedHeight, sheetHeight, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          sheetHeight.stopAnimation((value) => {
            gestureStartRef.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          sheetHeight.setValue(
            Math.max(
              collapsedHeight,
              Math.min(windowHeight, gestureStartRef.current - gesture.dy)
            )
          );
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
            settleSheet(!expanded);
          } else if (gesture.dy < -16 || gesture.vy < -0.22) {
            settleSheet(true);
          } else if (gesture.dy > 16 || gesture.vy > 0.22) {
            settleSheet(false);
          } else {
            const projected = gestureStartRef.current - gesture.dy - gesture.vy * 80;
            settleSheet(projected > (collapsedHeight + windowHeight) / 2);
          }
        },
        onPanResponderTerminate: () => settleSheet(expanded),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [collapsedHeight, expanded, settleSheet, sheetHeight, windowHeight]
  );

  const context = useMemo<AiChatContext>(
    () => ({
      scene: 'textbook',
      scopeKey: `textbook:${resourceId}`,
      title: '探索区域',
      subtitle:
        capture && showPageNumber
          ? `第 ${capture.pageNumber} 页 · ${resourceName}`
          : resourceName,
      resourceId,
      resourceName,
      subject,
      sectionName,
      initialAttachment: capture
        ? {
            uri: capture.dataUrl,
            dataUrl: capture.dataUrl,
            label: showPageNumber
              ? `第 ${capture.pageNumber} 页框选内容`
              : `${resourceName}框选内容`,
            pageNumber: showPageNumber ? capture.pageNumber : undefined,
          }
        : null,
    }),
    [capture, resourceId, resourceName, sectionName, showPageNumber, subject]
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { height: sheetHeight, paddingTop: expanded ? insets.top : 0 },
            expanded && styles.sheetExpanded,
          ]}
        >
          <View
            collapsable={false}
            style={styles.grabberRow}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="探索区域高度"
            accessibilityHint="上滑展开，下滑收回"
            accessibilityValue={{ text: expanded ? '全屏' : '默认高度' }}
            accessibilityActions={[
              { name: 'increment', label: '展开至全屏' },
              { name: 'decrement', label: '收回至默认高度' },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'increment') settleSheet(true);
              if (event.nativeEvent.actionName === 'decrement') settleSheet(false);
            }}
            {...panResponder.panHandlers}
          >
            <View style={styles.grabberCopy}>
              <View style={styles.sheetHandle} />
              <Text style={styles.grabberHint}>
                {expanded ? '下滑收回' : '上滑展开'}
              </Text>
            </View>
          </View>
          <View style={styles.workspace}>
            <AiChatWorkspace
              context={context}
              onClose={onClose}
              onReselect={onReselect}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25, 23, 45, 0.46)',
  },
  sheet: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#F7F7FC',
    shadowColor: '#17152A',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 18,
  },
  sheetExpanded: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  grabberRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  grabberCopy: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: { width: 34, height: 4, borderRadius: 2, backgroundColor: '#D3D2DE' },
  grabberHint: { marginLeft: 8, fontSize: 9, fontWeight: '700', color: '#8A8EA0' },
  workspace: { flex: 1, overflow: 'hidden' },
});

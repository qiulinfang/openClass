import React, { memo, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

export interface ResourceExploreSelection {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}

interface ResourceExploreOverlayProps {
  onComplete: (selection: ResourceExploreSelection) => void;
  onError: (message: string) => void;
}

interface Point {
  x: number;
  y: number;
}

function ResourceExploreOverlayComponent({
  onComplete,
  onError,
}: ResourceExploreOverlayProps) {
  const startRef = useRef<Point | null>(null);
  const endRef = useRef<Point | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const [selection, setSelection] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const updateSelection = (start: Point, end: Point) => {
    setSelection({
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const point = {
            x: event.nativeEvent.locationX,
            y: event.nativeEvent.locationY,
          };
          startRef.current = point;
          endRef.current = point;
          updateSelection(point, point);
        },
        onPanResponderMove: (event) => {
          if (!startRef.current) return;
          const point = {
            x: Math.max(
              0,
              Math.min(sizeRef.current.width, event.nativeEvent.locationX)
            ),
            y: Math.max(
              0,
              Math.min(sizeRef.current.height, event.nativeEvent.locationY)
            ),
          };
          endRef.current = point;
          updateSelection(startRef.current, point);
        },
        onPanResponderRelease: () => {
          const start = startRef.current;
          const end = endRef.current;
          startRef.current = null;
          endRef.current = null;
          setSelection(null);
          if (!start || !end) return;
          const width = Math.abs(end.x - start.x);
          const height = Math.abs(end.y - start.y);
          if (width < 28 || height < 28) {
            onError('框选区域过小，请重新框选');
            return;
          }
          onComplete({
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width,
            height,
            viewportWidth: sizeRef.current.width,
            viewportHeight: sizeRef.current.height,
          });
        },
        onPanResponderTerminate: () => {
          startRef.current = null;
          endRef.current = null;
          setSelection(null);
        },
      }),
    [onComplete, onError]
  );

  return (
    <View
      style={styles.overlay}
      onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout;
        sizeRef.current = { width, height };
      }}
      {...panResponder.panHandlers}
    >
      <View pointerEvents="none" style={styles.hint}>
        <View style={styles.hintIcon}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerBottomRight} />
        </View>
        <View>
          <Text style={styles.hintTitle}>框选资源内容</Text>
          <Text style={styles.hintText}>拖动选择需要向 AI 提问的区域</Text>
        </View>
      </View>
      {selection ? (
        <View pointerEvents="none" style={[styles.selection, selection]} />
      ) : null}
    </View>
  );
}

export const ResourceExploreOverlay = memo(ResourceExploreOverlayComponent);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
    backgroundColor: 'rgba(32, 36, 61, 0.08)',
  },
  selection: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#6256D9',
    borderRadius: 4,
    backgroundColor: 'rgba(98, 86, 217, 0.12)',
  },
  hint: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    left: 14,
    minHeight: 58,
    paddingHorizontal: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#17152A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  hintIcon: { position: 'relative', width: 24, height: 24, marginRight: 11 },
  cornerTopLeft: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 11,
    height: 11,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#6256D9',
  },
  cornerBottomRight: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 11,
    height: 11,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#6256D9',
  },
  hintTitle: { fontSize: 13, fontWeight: '800', color: '#20243D' },
  hintText: { marginTop: 2, fontSize: 10, color: '#74798F' },
});

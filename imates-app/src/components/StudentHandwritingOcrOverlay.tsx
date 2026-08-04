import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';

export interface StudentHandwritingOcrOverlayProps {
  questionData?: any[];
  scorePointList?: any[];
  focusedPointIndex?: number | null;
  activePointId?: string | null;
  onSelectPoint?: (payload: { point: any; index: number }) => void;
}

const getRegionBbox = (region: any) => {
  if (!Array.isArray(region?.bbox) || region.bbox.length < 4) return null;
  const [x1, y1, x2, y2] = region.bbox.slice(0, 4).map(Number);
  if ([x1, y1, x2, y2].some((v) => Number.isNaN(v))) return null;
  if (x2 <= x1 || y2 <= y1) return null;
  return { x1, y1, x2, y2 };
};

const isVirtualRegion = (region: any) => {
  const bbox = getRegionBbox(region);
  return bbox && bbox.x1 === 0 && bbox.y1 === 0 && bbox.x2 === 1 && bbox.y2 === 1;
};

const getOverlayPointRegions = (point: any) => {
  return Array.isArray(point?.matchedOcrRegions)
    ? point.matchedOcrRegions.filter(
        (region: any) => getRegionBbox(region) && !isVirtualRegion(region)
      )
    : [];
};

export function StudentHandwritingOcrOverlay({
  questionData = [],
  scorePointList = [],
  focusedPointIndex,
  activePointId,
  onSelectPoint,
}: StudentHandwritingOcrOverlayProps) {
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);

  const primaryItem = questionData && questionData.length > 0 ? questionData[0] : null;
  const imgUrl = primaryItem
    ? Array.isArray(primaryItem.answerData)
      ? primaryItem.answerData[0]
      : typeof primaryItem.answerData === 'string'
      ? primaryItem.answerData
      : primaryItem.studentAnswerImage || ''
    : '';

  useEffect(() => {
    if (imgUrl) {
      Image.getSize(
        imgUrl,
        (w, h) => {
          if (w > 0 && h > 0) {
            setImageMeta({ width: w, height: h });
          }
        },
        (err) => console.warn('[OcrOverlay] Image.getSize error:', err)
      );
    }
  }, [imgUrl]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const layout = e?.nativeEvent?.layout;
    if (layout) {
      const { width, height } = layout;
      if (width > 0 && height > 0) {
        setContainerSize({ width, height });
      }
    }
  };

  const isPointActive = (point: any, index: number) => {
    if (activePointId && (point.id === activePointId || point.pointId === activePointId)) {
      return true;
    }
    if (focusedPointIndex !== null && focusedPointIndex !== undefined && focusedPointIndex === index) {
      return true;
    }
    return false;
  };

  const shouldShowPointRegions = (pointIndex: number) => {
    if (focusedPointIndex === null || focusedPointIndex === undefined) return true;
    return focusedPointIndex === pointIndex;
  };

  const getRegionStyle = (region: any) => {
    if (!imageMeta || !imageMeta.width || !imageMeta.height) {
      return { display: 'none' as const };
    }
    const bbox = getRegionBbox(region);
    if (!bbox) return { display: 'none' as const };

    const leftPct = (bbox.x1 / imageMeta.width) * 100;
    const topPct = (bbox.y1 / imageMeta.height) * 100;
    const widthPct = ((bbox.x2 - bbox.x1) / imageMeta.width) * 100;
    const heightPct = ((bbox.y2 - bbox.y1) / imageMeta.height) * 100;

    return {
      left: `${leftPct}%`,
      top: `${topPct}%`,
      width: `${Math.min(100, widthPct)}%`,
      height: `${Math.min(100, heightPct)}%`,
    } as any;
  };

  if (!imgUrl) return null;

  return (
    <View style={styles.answerImageCard}>
      <View style={styles.answerImageWrapper}>
        <View style={styles.studentImageContainer} onLayout={handleLayout}>
          <Image
            source={{ uri: imgUrl }}
            style={styles.studentImage}
            resizeMode="contain"
            onError={() => {
              console.warn('[OcrOverlay] 手写图片资源不可访问或失效:', imgUrl);
              setImageMeta(null);
            }}
          />

          {/* OCR 划线覆盖区域 */}
          {scorePointList.map((point, pointIndex) => {
            if (!shouldShowPointRegions(pointIndex)) return null;
            const regions = getOverlayPointRegions(point);
            const active = isPointActive(point, pointIndex);
            const isHit = !!point.hit;

            return regions.map((region: any, regionIndex: number) => {
              const rStyle = getRegionStyle(region);
              return (
                <Pressable
                  key={`${point.id || point.pointId || pointIndex}-${regionIndex}`}
                  style={[
                    styles.ocrRegion,
                    isHit ? styles.hitRegion : styles.nohitRegion,
                    active && styles.activeRegion,
                    rStyle,
                  ]}
                  onPress={() => onSelectPoint && onSelectPoint({ point, index: pointIndex })}
                >
                  {!region.suppressMarker && (
                    <View style={styles.regionMarker}>
                      <View style={[styles.statusIconCircle, isHit ? styles.hitIconCircle : styles.nohitIconCircle]}>
                        <Text style={styles.statusIconText}>{isHit ? '✓' : '✕'}</Text>
                      </View>
                      <View style={[styles.indexBadge, isHit ? styles.hitBadge : styles.nohitBadge]}>
                        <Text style={styles.indexBadgeText}>
                          {point.displayIndex || pointIndex + 1}
                        </Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            });
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  answerImageCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    boxSizing: 'border-box' as any,
  },
  answerImageWrapper: {
    position: 'relative',
    width: '100%',
    minHeight: 180,
    maxHeight: 520,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    padding: 8,
  },
  studentImageContainer: {
    position: 'relative',
    maxWidth: '100%',
    maxHeight: 504,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentImage: {
    width: 320,
    height: 380,
    maxWidth: '100%',
    maxHeight: 504,
    borderRadius: 4,
  },
  ocrRegion: {
    position: 'absolute',
    borderRadius: 4,
    zIndex: 10,
  },
  hitRegion: {
    backgroundColor: 'rgba(110, 85, 255, 0.22)',
  },
  nohitRegion: {
    backgroundColor: 'rgba(220, 100, 100, 0.25)',
  },
  activeRegion: {
    borderWidth: 2,
    borderColor: '#6E55FF',
    zIndex: 30,
  },
  regionMarker: {
    position: 'absolute',
    top: '50%',
    right: -48,
    transform: [{ translateY: -12 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 40,
  },
  statusIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitIconCircle: {
    backgroundColor: '#6E55FF',
  },
  nohitIconCircle: {
    backgroundColor: '#FF3B30',
  },
  statusIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  indexBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitBadge: {
    backgroundColor: '#6E55FF',
  },
  nohitBadge: {
    backgroundColor: '#FF3B30',
  },
  indexBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

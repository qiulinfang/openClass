import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LearningResourceMeta } from './learning-resource';

interface LearningResourceViewerHeaderProps {
  topInset: number;
  title: string;
  meta: LearningResourceMeta;
  exploreSelecting: boolean;
  exploreDisabled: boolean;
  onBack: () => void;
  onExplore: () => void;
}

function LearningResourceViewerHeaderComponent({
  topInset,
  title,
  meta,
  exploreSelecting,
  exploreDisabled,
  onBack,
  onExplore,
}: LearningResourceViewerHeaderProps) {
  return (
    <View style={[styles.header, { paddingTop: topInset + 8 }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="返回教材详情"
      >
        <Text style={styles.backIcon}>‹</Text>
      </TouchableOpacity>

      <View style={styles.heading}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowDot, { backgroundColor: meta.accent }]} />
          <Text style={[styles.eyebrow, { color: meta.accent }]}>
            {meta.label}
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title || '文件预览'}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.exploreButton,
          exploreSelecting && styles.exploreButtonActive,
          exploreDisabled && styles.exploreButtonDisabled,
        ]}
        onPress={onExplore}
        disabled={exploreDisabled}
        accessibilityRole="button"
        accessibilityLabel={exploreSelecting ? '取消框选' : '探索区域'}
      >
        <View style={styles.exploreIcon}>
          <View
            style={[
              styles.exploreCornerTopLeft,
              exploreSelecting && styles.exploreCornerActive,
            ]}
          />
          <View
            style={[
              styles.exploreCornerBottomRight,
              exploreSelecting && styles.exploreCornerActive,
            ]}
          />
        </View>
        <Text
          style={[
            styles.exploreButtonText,
            exploreSelecting && styles.exploreButtonTextActive,
          ]}
        >
          {exploreSelecting ? '取消' : '探索区域'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const LearningResourceViewerHeader = memo(
  LearningResourceViewerHeaderComponent
);

const styles = StyleSheet.create({
  header: {
    minHeight: 58,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E5F0',
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EEFF',
  },
  backIcon: {
    marginTop: -2,
    fontSize: 34,
    lineHeight: 36,
    color: '#6256D9',
  },
  heading: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  eyebrowRow: {
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrowDot: { width: 5, height: 5, marginRight: 5, borderRadius: 3 },
  eyebrow: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  title: {
    maxWidth: '100%',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: '#20243D',
  },
  exploreButton: {
    minWidth: 86,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DAD6FF',
    backgroundColor: '#F5F3FF',
  },
  exploreButtonActive: {
    borderColor: '#6256D9',
    backgroundColor: '#6256D9',
  },
  exploreButtonDisabled: { opacity: 0.45 },
  exploreIcon: { position: 'relative', width: 15, height: 15, marginRight: 5 },
  exploreCornerTopLeft: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 7,
    height: 7,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: '#6256D9',
  },
  exploreCornerBottomRight: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 7,
    height: 7,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#6256D9',
  },
  exploreCornerActive: { borderColor: '#FFFFFF' },
  exploreButtonText: { fontSize: 11, fontWeight: '800', color: '#6256D9' },
  exploreButtonTextActive: { color: '#FFFFFF' },
});

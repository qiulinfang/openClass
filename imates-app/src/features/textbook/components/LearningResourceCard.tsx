import React, { memo, useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ResourceFile } from '../services/textbook-service';
import {
  formatLearningResourceSize,
  getLearningResourceMeta,
} from './learning-resource';

interface LearningResourceCardProps {
  resource: ResourceFile;
  onPress: (resource: ResourceFile) => void;
}

function LearningResourceCardComponent({
  resource,
  onPress,
}: LearningResourceCardProps) {
  const meta = useMemo(() => getLearningResourceMeta(resource), [resource]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(resource)}
      activeOpacity={0.76}
      accessibilityRole="button"
      accessibilityLabel={`打开${meta.label}，${resource.fileName}`}
    >
      <View
        style={[
          styles.thumbnail,
          { backgroundColor: meta.background, borderColor: `${meta.accent}24` },
        ]}
      >
        <View style={[styles.thumbnailSpine, { backgroundColor: meta.accent }]} />
        <Text style={[styles.thumbnailLabel, { color: meta.accent }]}>
          {meta.shortLabel}
        </Text>
        <View style={[styles.thumbnailLine, { backgroundColor: `${meta.accent}38` }]} />
        <View
          style={[
            styles.thumbnailLine,
            styles.thumbnailLineShort,
            { backgroundColor: `${meta.accent}38` },
          ]}
        />
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {resource.fileName}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.kindDot, { backgroundColor: meta.accent }]} />
          <Text style={styles.metaText} numberOfLines={1}>
            {meta.label} · {formatLearningResourceSize(resource.size)}
          </Text>
        </View>
      </View>

      <View style={styles.action}>
        <Text style={styles.actionText}>去学习</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export const LearningResourceCard = memo(LearningResourceCardComponent);

const styles = StyleSheet.create({
  card: {
    minHeight: 92,
    marginBottom: 10,
    padding: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E5F0',
    ...Platform.select({
      ios: {
        shadowColor: '#292545',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  thumbnail: {
    width: 54,
    height: 70,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  thumbnailSpine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 5,
  },
  thumbnailLabel: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.4,
    fontWeight: '900',
  },
  thumbnailLine: {
    width: 29,
    height: 2,
    marginTop: 7,
    borderRadius: 1,
  },
  thumbnailLineShort: {
    width: 20,
    marginTop: 4,
  },
  info: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: '#20243D',
  },
  metaRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  kindDot: {
    width: 5,
    height: 5,
    marginRight: 5,
    borderRadius: 3,
  },
  metaText: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 14,
    color: '#8C91A5',
  },
  action: {
    minWidth: 66,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EEFF',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6256D9',
  },
  chevron: {
    marginLeft: 2,
    marginTop: -1,
    fontSize: 19,
    lineHeight: 20,
    color: '#6256D9',
  },
});

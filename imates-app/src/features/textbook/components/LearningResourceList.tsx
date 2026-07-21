import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type {
  LearningPackage,
  ResourceFile,
} from '../services/textbook-service';
import { LearningResourceCard } from './LearningResourceCard';
import { getUniqueLearningResources } from './learning-resource';

interface LearningResourceListProps {
  packages: LearningPackage[];
  onOpenResource: (resource: ResourceFile) => void;
  emptyTitle?: string;
  emptyHint?: string;
}

function LearningResourceListComponent({
  packages,
  onOpenResource,
  emptyTitle = '本课节暂无学习文件',
  emptyHint = '可选择其他课节继续查看',
}: LearningResourceListProps) {
  const resources = useMemo(
    () => getUniqueLearningResources(packages),
    [packages]
  );

  if (resources.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyHint}>{emptyHint}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {resources.map((resource) => (
        <LearningResourceCard
          key={resource.id}
          resource={resource}
          onPress={onOpenResource}
        />
      ))}
    </View>
  );
}

export const LearningResourceList = memo(LearningResourceListComponent);

const styles = StyleSheet.create({
  list: {
    width: '100%',
  },
  emptyState: {
    minHeight: 118,
    padding: 24,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E5F0',
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#20243D',
  },
  emptyHint: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    color: '#989DB2',
  },
});

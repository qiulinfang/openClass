import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ChapterNode } from '@/services/textbook-service';

interface DirectoryTreeProps {
  nodes: ChapterNode[];
  expandedNodes: Record<string, boolean>;
  selectedNodeId: string | null;
  onNodePress: (node: ChapterNode) => void;
  onToggleExpand: (id: string) => void;
}

const LightColors = {
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#3B82F6',
  selectedBg: 'rgba(59, 130, 246, 0.08)',
};

export function DirectoryTree({
  nodes,
  expandedNodes,
  selectedNodeId,
  onNodePress,
  onToggleExpand,
}: DirectoryTreeProps) {

  // 递归渲染内部树节点
  const renderTree = (treeNodes: ChapterNode[], depth = 0) => {
    return treeNodes.map(node => {
      const isExpanded = !!expandedNodes[node.id];
      const isSelected = selectedNodeId === node.id;
      const hasChildren = node.children && node.children.length > 0;
      const paddingLeft = depth * 14;

      return (
        <View key={node.id}>
          <TouchableOpacity
            style={[
              styles.treeNodeRow,
              isSelected && styles.treeNodeRowSelected,
              depth === 0 ? styles.chapterNode : styles.sectionNode,
              { paddingLeft: Math.max(12, paddingLeft) }
            ]}
            onPress={() => {
              if (hasChildren) {
                onToggleExpand(node.id);
              }
              onNodePress(node);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.treeNodeLeft}>
              <Text style={styles.treeNodeIcon}>
                {depth === 0 ? '📖' : hasChildren ? (isExpanded ? '📂' : '📁') : '✦'}
              </Text>
              <Text
                style={[
                  styles.treeNodeText,
                  isSelected && styles.treeNodeTextSelected,
                  depth === 0 ? styles.chapterNodeText : styles.sectionNodeText
                ]}
                numberOfLines={1}
              >
                {node.name || node.label}
              </Text>
            </View>
            {hasChildren && (
              <Text style={styles.expandArrow}>{isExpanded ? '▼' : '▶'}</Text>
            )}
          </TouchableOpacity>

          {/* 递归渲染下级 */}
          {hasChildren && isExpanded && (
            <View style={styles.treeChildrenWrapper}>
              {renderTree(node.children!, depth + 1)}
            </View>
          )}
        </View>
      );
    });
  };

  return <View style={styles.container}>{renderTree(nodes)}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  treeNodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingRight: 12,
    marginHorizontal: 6,
    marginVertical: 1.5,
    borderRadius: 6,
  },
  treeNodeRowSelected: {
    backgroundColor: LightColors.selectedBg,
    borderLeftWidth: 4,
    borderLeftColor: LightColors.primary,
  },
  chapterNode: {
    backgroundColor: '#F1F5F9',
    marginVertical: 3,
  },
  sectionNode: {
    backgroundColor: 'transparent',
  },
  treeNodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  treeNodeIcon: {
    fontSize: 13,
    marginRight: 8,
  },
  treeNodeText: {
    fontSize: 13,
    color: LightColors.textSecondary,
    flex: 1,
  },
  treeNodeTextSelected: {
    color: LightColors.primary,
    fontWeight: '700',
  },
  chapterNodeText: {
    fontWeight: '700',
    color: LightColors.textPrimary,
  },
  sectionNodeText: {
    fontWeight: '500',
  },
  expandArrow: {
    fontSize: 10,
    color: LightColors.textMuted,
  },
  treeChildrenWrapper: {
    borderLeftWidth: 1.5,
    borderColor: '#E2E8F0',
    marginLeft: 22,
    paddingLeft: 4,
  },
});

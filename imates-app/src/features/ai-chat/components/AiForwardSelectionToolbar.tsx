import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AiForwardSelectionToolbarProps {
  selectedCount: number;
  totalCount: number;
  bottomInset: number;
  onToggleSelectAll: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

function AiForwardSelectionToolbarComponent({
  selectedCount,
  totalCount,
  bottomInset,
  onToggleSelectAll,
  onCancel,
  onConfirm,
}: AiForwardSelectionToolbarProps) {
  const allSelected = totalCount > 0 && selectedCount === totalCount;
  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(10, bottomInset) },
      ]}
    >
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>选择要问老师的对话</Text>
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={onToggleSelectAll}
            accessibilityRole="button"
          >
            <Text style={styles.selectAllText}>
              {allSelected ? '取消全选' : '全选'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.count}>
          已选 {selectedCount}/{totalCount} 条
        </Text>
      </View>
      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelText}>取消</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.confirmButton,
          selectedCount === 0 && styles.confirmButtonDisabled,
        ]}
        onPress={onConfirm}
        disabled={selectedCount === 0}
      >
        <Text style={styles.confirmText}>选择老师</Text>
      </TouchableOpacity>
    </View>
  );
}

export const AiForwardSelectionToolbar = memo(
  AiForwardSelectionToolbarComponent
);

const styles = StyleSheet.create({
  container: {
    minHeight: 76,
    paddingHorizontal: 12,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#DADCE7',
    backgroundColor: '#FFFFFF',
  },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
    color: '#292E47',
  },
  selectAllButton: {
    minHeight: 30,
    marginLeft: 4,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#F0EDFF',
  },
  selectAllText: { fontSize: 10, fontWeight: '800', color: '#6256D9' },
  count: { marginTop: 4, fontSize: 10, color: '#7B8094' },
  cancelButton: {
    minWidth: 56,
    minHeight: 44,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#F0F1F5',
  },
  cancelText: { fontSize: 12, fontWeight: '800', color: '#63687C' },
  confirmButton: {
    minWidth: 86,
    minHeight: 44,
    marginLeft: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#6256D9',
  },
  confirmButtonDisabled: { opacity: 0.42 },
  confirmText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
});

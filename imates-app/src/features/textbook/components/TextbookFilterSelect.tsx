import React, { memo, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export interface TextbookFilterOption {
  label: string;
  value: string;
}

interface TextbookFilterSelectProps {
  label: string;
  value: string;
  options: TextbookFilterOption[];
  onChange: (value: string) => void;
  compact?: boolean;
}

export const TextbookFilterSelect = memo(function TextbookFilterSelect({
  label,
  value,
  options,
  onChange,
  compact = false,
}: TextbookFilterSelectProps) {
  const [visible, setVisible] = useState(false);
  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label || '全部',
    [options, value]
  );
  const displayLabel = compact && !value ? label : selectedLabel;

  return (
    <>
      <TouchableOpacity
        style={[styles.select, compact && styles.compactSelect]}
        activeOpacity={0.75}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}，当前${displayLabel}`}
      >
        {!compact ? <Text style={styles.caption}>{label}</Text> : null}
        <View style={styles.valueRow}>
          <Text
            style={[styles.value, compact && styles.compactValue]}
            numberOfLines={1}
          >
            {displayLabel}
          </Text>
          <Text style={[styles.chevron, compact && styles.compactChevron]}>
            ⌄
          </Text>
        </View>
      </TouchableOpacity>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable
            style={styles.optionSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>选择{label}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <TouchableOpacity
                    key={`${label}-${option.value || 'all'}`}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => {
                      onChange(option.value);
                      setVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.optionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {active ? <Text style={styles.optionCheck}>✓</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  select: {
    width: '48.7%',
    minHeight: 51,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8F8FC',
    borderWidth: 1,
    borderColor: '#E7E9F2',
  },
  compactSelect: {
    flex: 1,
    width: undefined,
    minWidth: 58,
    maxWidth: 78,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 0,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderColor: '#CDD4E2',
  },
  caption: {
    color: '#9AA3B8',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    flex: 1,
    color: '#172033',
    fontSize: 12,
    fontWeight: '700',
  },
  compactValue: {
    textAlign: 'center',
    fontSize: 12,
  },
  chevron: {
    color: '#6556E8',
    fontSize: 15,
    marginLeft: 4,
    marginTop: -4,
  },
  compactChevron: {
    marginLeft: 2,
    color: '#65708A',
    fontSize: 13,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 32, 51, 0.38)',
    justifyContent: 'flex-end',
  },
  optionSheet: {
    maxHeight: '66%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 9,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6D9E2',
    marginBottom: 13,
  },
  sheetTitle: {
    color: '#172033',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  optionRow: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionRowActive: {
    backgroundColor: '#EFEDFF',
  },
  optionText: {
    color: '#65708A',
    fontSize: 14,
    fontWeight: '600',
  },
  optionTextActive: {
    color: '#6556E8',
    fontWeight: '800',
  },
  optionCheck: {
    color: '#6556E8',
    fontSize: 16,
    fontWeight: '900',
  },
});

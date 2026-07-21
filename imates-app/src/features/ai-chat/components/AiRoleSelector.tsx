import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AiChatRole } from '../types';

interface AiRoleSelectorProps {
  value: AiChatRole;
  disabled?: boolean;
  onChange: (value: AiChatRole) => void;
}

const ROLE_OPTIONS: Array<{
  value: AiChatRole;
  label: string;
  description: string;
}> = [
  {
    value: 'mate',
    label: '同桌',
    description: '自然交流，用启发式提示陪你思考',
  },
  {
    value: 'mentor',
    label: '课代表',
    description: '结构化讲解，帮助你梳理重点',
  },
  {
    value: 'researcher',
    label: '大神',
    description: '深入分析，展开推导和知识延伸',
  },
];

export function AiRoleSelector({
  value,
  disabled = false,
  onChange,
}: AiRoleSelectorProps) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const selected =
    ROLE_OPTIONS.find((option) => option.value === value) ||
    ROLE_OPTIONS[0];

  const selectRole = (nextValue: AiChatRole) => {
    onChange(nextValue);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          visible && styles.triggerActive,
          disabled && styles.triggerDisabled,
        ]}
        onPress={() => setVisible(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`回答方式，当前为${selected.label}`}
        accessibilityHint="打开回答方式选择"
        accessibilityState={{ expanded: visible, disabled }}
      >
        <Text style={styles.triggerValue}>{selected.label}</Text>
        <Text style={styles.chevron}>⌄</Text>
      </TouchableOpacity>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="关闭回答方式选择"
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(16, insets.bottom) },
            ]}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>选择回答方式</Text>
            <Text style={styles.sheetSubtitle}>
              可根据问题难度随时切换
            </Text>
            <View style={styles.options}>
              {ROLE_OPTIONS.map((option) => {
                const isSelected = option.value === value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected,
                    ]}
                    onPress={() => selectRole(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${option.label}，${option.description}`}
                  >
                    <View style={styles.optionCopy}>
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && styles.optionTitleSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.optionDescription}>
                        {option.description}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        isSelected && styles.radioSelected,
                      ]}
                    >
                      {isSelected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 44,
    marginRight: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B9B3F2',
    backgroundColor: '#EEEAFE',
  },
  triggerActive: {
    borderColor: '#6256D9',
    backgroundColor: '#E6E2FF',
  },
  triggerDisabled: {
    opacity: 0.45,
  },
  triggerValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#5549CB',
  },
  chevron: {
    marginLeft: 6,
    marginTop: -2,
    fontSize: 14,
    fontWeight: '700',
    color: '#6256D9',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25, 23, 45, 0.48)',
  },
  sheet: {
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#FFFFFF',
  },
  handle: {
    width: 42,
    height: 4,
    marginBottom: 20,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: '#D3D2DE',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#20243D',
  },
  sheetSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: '#74798F',
  },
  options: {
    marginTop: 18,
  },
  option: {
    minHeight: 72,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E2EB',
    backgroundColor: '#FAFAFC',
  },
  optionSelected: {
    borderColor: '#AAA2EE',
    backgroundColor: '#F1EFFF',
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D314A',
  },
  optionTitleSelected: {
    color: '#5348C9',
  },
  optionDescription: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: '#73788E',
  },
  radio: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#B7BAC7',
    backgroundColor: '#FFFFFF',
  },
  radioSelected: {
    borderColor: '#6256D9',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6256D9',
  },
});

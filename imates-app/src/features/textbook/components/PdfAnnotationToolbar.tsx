import React, { memo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type PdfAnnotationTool =
  | 'hand'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'text';

export interface PdfAnnotationToolConfig {
  color: string;
  width: number;
  fontSize: number;
  hasBackground: boolean;
}

interface PdfAnnotationToolbarProps {
  bottomInset: number;
  selectedTool: PdfAnnotationTool;
  textSelectionActive: boolean;
  textEditingActive: boolean;
  config: PdfAnnotationToolConfig;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
  onToolChange: (tool: PdfAnnotationTool) => void;
  onConfigChange: (config: PdfAnnotationToolConfig) => void;
  onUndo: () => void;
  onRedo: () => void;
}

const TOOL_ITEMS: Array<{ id: PdfAnnotationTool; label: string }> = [
  { id: 'hand', label: '手势' },
  { id: 'pen', label: '画笔' },
  { id: 'highlighter', label: '高亮' },
  { id: 'eraser', label: '橡皮' },
  { id: 'text', label: '文本' },
];

const PEN_COLORS = ['#242638', '#E34850', '#2F6FED', '#6256D9'];
const TEXT_COLORS = [...PEN_COLORS, '#FFFFFF'];
const HIGHLIGHTER_COLORS = ['#FFD84D', '#74D89A', '#68C7F4', '#F39AC1'];
const WIDTH_OPTIONS = [0.0035, 0.006, 0.01];

function PdfAnnotationToolbarComponent({
  bottomInset,
  selectedTool,
  textSelectionActive,
  textEditingActive,
  config,
  canUndo,
  canRedo,
  disabled = false,
  onToolChange,
  onConfigChange,
  onUndo,
  onRedo,
}: PdfAnnotationToolbarProps) {
  const configurable =
    !textEditingActive &&
    (textSelectionActive ||
      selectedTool === 'pen' ||
      selectedTool === 'highlighter');
  const showTextConfig = textSelectionActive;
  const colors =
    selectedTool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS;

  return (
    <View
      style={[
        styles.shell,
        { paddingBottom: Math.max(8, bottomInset) },
        disabled && styles.shellDisabled,
      ]}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      {configurable ? (
        <ScrollView
          horizontal
          style={styles.configScroll}
          contentContainerStyle={styles.configRow}
          showsHorizontalScrollIndicator={false}
        >
          {showTextConfig ? (
            <>
              <Text style={styles.configLabel}>颜色</Text>
              {TEXT_COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={({ pressed }) => [
                    styles.colorButton,
                    config.color === color && styles.colorButtonSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onConfigChange({ ...config, color })}
                  accessibilityRole="button"
                  accessibilityLabel={`选择${color}文字颜色`}
                  accessibilityState={{ selected: config.color === color }}
                >
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      color === '#FFFFFF' && styles.whiteColorSwatch,
                    ]}
                  />
                </Pressable>
              ))}
              <View style={styles.configDivider} />
              <Text style={styles.configLabel}>字号</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.fontSizeButton,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  onConfigChange({
                    ...config,
                    fontSize: Math.max(0.014, config.fontSize - 0.003),
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="减小文本字号"
              >
                <Text style={styles.fontSizeControl}>A−</Text>
              </Pressable>
              <View style={styles.fontSizeValue}>
                <Text style={styles.fontSizeValueText}>
                  {Math.round(config.fontSize * 720)}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.fontSizeButton,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  onConfigChange({
                    ...config,
                    fontSize: Math.min(0.045, config.fontSize + 0.003),
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="增大文本字号"
              >
                <Text style={styles.fontSizeControl}>A＋</Text>
              </Pressable>
              <View style={styles.configDivider} />
              <Text style={styles.configLabel}>背景</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.backgroundButton,
                  config.hasBackground && styles.backgroundButtonSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  onConfigChange({
                    ...config,
                    hasBackground: !config.hasBackground,
                  })
                }
                accessibilityRole="switch"
                accessibilityLabel="文本框背景"
                accessibilityState={{ checked: config.hasBackground }}
              >
                <Text
                  style={[
                    styles.backgroundButtonText,
                    config.hasBackground &&
                      styles.backgroundButtonTextSelected,
                  ]}
                >
                  {config.hasBackground ? '有' : '无'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.configLabel}>颜色</Text>
              {colors.map((color) => (
                <Pressable
                  key={color}
                  style={({ pressed }) => [
                    styles.colorButton,
                    config.color === color && styles.colorButtonSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onConfigChange({ ...config, color })}
                  accessibilityRole="button"
                  accessibilityLabel={`选择${color}颜色`}
                  accessibilityState={{ selected: config.color === color }}
                >
                  <View
                    style={[styles.colorSwatch, { backgroundColor: color }]}
                  />
                </Pressable>
              ))}
              <View style={styles.configDivider} />
              <Text style={styles.configLabel}>粗细</Text>
              {WIDTH_OPTIONS.map((width, index) => (
                <Pressable
                  key={width}
                  style={({ pressed }) => [
                    styles.widthButton,
                    Math.abs(config.width - width) < 0.0001 &&
                      styles.widthButtonSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onConfigChange({ ...config, width })}
                  accessibilityRole="button"
                  accessibilityLabel={`选择${index + 1}级粗细`}
                  accessibilityState={{
                    selected: Math.abs(config.width - width) < 0.0001,
                  }}
                >
                  <View
                    style={[
                      styles.widthLine,
                      {
                        height: 2 + index * 2,
                        backgroundColor: config.color,
                      },
                    ]}
                  />
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolbarContent}
      >
        {TOOL_ITEMS.map((tool) => {
          const selected = selectedTool === tool.id;
          return (
            <Pressable
              key={tool.id}
              style={({ pressed }) => [
                styles.toolButton,
                selected && styles.toolButtonSelected,
                pressed && styles.pressed,
              ]}
              onPress={() => onToolChange(tool.id)}
              accessibilityRole="button"
              accessibilityLabel={tool.label}
              accessibilityState={{ selected }}
            >
              {tool.id === 'pen' || tool.id === 'highlighter' ? (
                <View
                  style={[
                    styles.toolColor,
                    {
                      backgroundColor:
                        selected
                          ? config.color
                          : tool.id === 'highlighter'
                            ? '#FFD84D'
                            : '#242638',
                    },
                  ]}
                />
              ) : null}
              <Text
                style={[
                  styles.toolLabel,
                  selected && styles.toolLabelSelected,
                ]}
              >
                {tool.label}
              </Text>
            </Pressable>
          );
        })}

        <View style={styles.actionDivider} />
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            !canUndo && styles.actionButtonDisabled,
            pressed && canUndo && styles.pressed,
          ]}
          onPress={onUndo}
          disabled={!canUndo}
          accessibilityRole="button"
          accessibilityLabel="撤销上一步标注"
          accessibilityState={{ disabled: !canUndo }}
        >
          <Text style={styles.actionLabel}>撤销</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            !canRedo && styles.actionButtonDisabled,
            pressed && canRedo && styles.pressed,
          ]}
          onPress={onRedo}
          disabled={!canRedo}
          accessibilityRole="button"
          accessibilityLabel="重做上一步标注"
          accessibilityState={{ disabled: !canRedo }}
        >
          <Text style={styles.actionLabel}>重做</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export const PdfAnnotationToolbar = memo(PdfAnnotationToolbarComponent);

const styles = StyleSheet.create({
  shell: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDDDEA',
    backgroundColor: '#FFFFFF',
    shadowColor: '#17152A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  shellDisabled: {
    opacity: 0.46,
  },
  configScroll: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECF4',
    backgroundColor: '#FAFAFE',
  },
  configRow: {
    minWidth: '100%',
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  configLabel: {
    marginHorizontal: 5,
    fontSize: 10,
    fontWeight: '700',
    color: '#6D7188',
  },
  colorButton: {
    width: 44,
    height: 44,
    marginHorizontal: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonSelected: {
    borderColor: '#6256D9',
  },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(25, 27, 43, 0.18)',
  },
  whiteColorSwatch: {
    borderWidth: 1,
    borderColor: '#AEB2C2',
  },
  configDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    marginHorizontal: 6,
    backgroundColor: '#DCDCE8',
  },
  widthButton: {
    width: 38,
    height: 34,
    marginHorizontal: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  widthButtonSelected: {
    borderColor: '#CFCBFA',
    backgroundColor: '#F0EEFF',
  },
  widthLine: {
    width: 22,
    borderRadius: 4,
  },
  fontSizeButton: {
    width: 48,
    height: 44,
    marginHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8D5F7',
    backgroundColor: '#F5F3FF',
  },
  fontSizeControl: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5548C7',
  },
  fontSizeValue: {
    minWidth: 42,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontSizeValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#34384E',
  },
  backgroundButton: {
    minWidth: 50,
    height: 44,
    marginHorizontal: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D9DBE8',
    backgroundColor: '#FFFFFF',
  },
  backgroundButtonSelected: {
    borderColor: '#CFCBFA',
    backgroundColor: '#F0EEFF',
  },
  backgroundButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6D7188',
  },
  backgroundButtonTextSelected: {
    color: '#5548C7',
  },
  toolbarContent: {
    minWidth: '100%',
    minHeight: 56,
    paddingHorizontal: 8,
    paddingTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButton: {
    minWidth: 54,
    height: 46,
    marginHorizontal: 4,
    paddingHorizontal: 9,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toolButtonSelected: {
    borderColor: '#D5D1FA',
    backgroundColor: '#F0EEFF',
  },
  toolColor: {
    width: 18,
    height: 3,
    marginBottom: 4,
    borderRadius: 2,
  },
  toolLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: '#555A72',
  },
  toolLabelSelected: {
    color: '#5548C7',
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    marginHorizontal: 6,
    backgroundColor: '#DCDCE8',
  },
  actionButton: {
    minWidth: 50,
    height: 42,
    marginHorizontal: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5FA',
  },
  actionButtonDisabled: {
    opacity: 0.38,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F5369',
  },
  pressed: {
    opacity: 0.62,
  },
});

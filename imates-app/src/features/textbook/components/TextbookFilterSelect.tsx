import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  MotionPressable,
  textbookMotionConfig,
} from './TextbookMotion';

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
  reduceMotion?: boolean;
}

export const TextbookFilterSelect = memo(function TextbookFilterSelect({
  label,
  value,
  options,
  onChange,
  compact = false,
  reduceMotion = false,
}: TextbookFilterSelectProps) {
  const [visible, setVisible] = useState(false);
  const sheetProgress = useRef(new Animated.Value(0)).current;
  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label || '全部',
    [options, value]
  );
  const displayLabel = compact && !value ? label : selectedLabel;

  useEffect(() => {
    if (!visible) return undefined;

    sheetProgress.stopAnimation();
    if (reduceMotion) {
      sheetProgress.setValue(1);
      return undefined;
    }

    sheetProgress.setValue(0);
    const animation = Animated.timing(sheetProgress, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: textbookMotionConfig.useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, sheetProgress, visible]);

  const openSheet = useCallback(() => {
    setVisible(true);
  }, []);

  const closeSheet = useCallback(() => {
    sheetProgress.stopAnimation();
    if (reduceMotion) {
      setVisible(false);
      return;
    }

    Animated.timing(sheetProgress, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: textbookMotionConfig.useNativeDriver,
    }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [reduceMotion, sheetProgress]);

  const selectOption = useCallback(
    (optionValue: string) => {
      if (optionValue !== value) onChange(optionValue);
      closeSheet();
    },
    [closeSheet, onChange, value]
  );

  const renderOption = useCallback(
    ({ item: option }: { item: TextbookFilterOption }) => {
      const active = option.value === value;
      return (
        <MotionPressable
          style={[styles.optionRow, active && styles.optionRowActive]}
          onPress={() => selectOption(option.value)}
          reduceMotion={reduceMotion}
          pressedScale={0.985}
          accessibilityRole="radio"
          accessibilityState={{ checked: active }}
          accessibilityLabel={option.label}
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
        </MotionPressable>
      );
    },
    [reduceMotion, selectOption, value]
  );

  return (
    <>
      <MotionPressable
        style={[styles.select, compact && styles.compactSelect]}
        onPress={openSheet}
        reduceMotion={reduceMotion}
        pressedScale={0.96}
        accessibilityRole="button"
        accessibilityLabel={`${label}，当前${displayLabel}`}
        accessibilityHint="打开筛选选项"
        accessibilityState={{ expanded: visible }}
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
      </MotionPressable>

      <Modal
        transparent
        visible={visible}
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View style={styles.modalRoot}>
          <Animated.View
            pointerEvents="none"
            style={[styles.backdropVisual, { opacity: sheetProgress }]}
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeSheet}
            accessibilityRole="button"
            accessibilityLabel={`关闭${label}筛选`}
          />
          <Animated.View
            style={[
              styles.optionSheet,
              {
                transform: [
                  {
                    translateY: sheetProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  },
                ],
              },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>选择{label}</Text>
            <FlatList
              data={options}
              renderItem={renderOption}
              keyExtractor={(option) => `${label}-${option.value || 'all'}`}
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              getItemLayout={(_, index) => ({
                length: 53,
                offset: 53 * index,
                index,
              })}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </Animated.View>
        </View>
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
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropVisual: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(23, 32, 51, 0.44)',
  },
  optionSheet: {
    maxHeight: '66%',
    minHeight: 180,
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
    height: 48,
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

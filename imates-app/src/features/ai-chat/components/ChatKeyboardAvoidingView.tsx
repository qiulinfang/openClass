import React, {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

export type ChatKeyboardAvoidanceMode = 'active' | 'system';

const ANDROID_KEYBOARD_CLEARANCE = 40;

export function ChatKeyboardAvoidingView({
  children,
  mode = 'active',
}: PropsWithChildren<{ mode?: ChatKeyboardAvoidanceMode }>) {
  const containerRef = useRef<View>(null);
  const [verticalOffset, setVerticalOffset] = useState(0);
  const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);

  const measureVerticalOffset = useCallback(() => {
    containerRef.current?.measureInWindow((_x, y) => {
      const nextOffset = Math.max(0, y);
      setVerticalOffset((current) =>
        Math.abs(current - nextOffset) < 1 ? current : nextOffset
      );
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || mode !== 'active') {
      setAndroidKeyboardInset(0);
      return;
    }

    const keyboardShowSubscription = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        containerRef.current?.measureInWindow((_x, y, _width, height) => {
          const overlap = Math.max(
            0,
            y + height - event.endCoordinates.screenY
          );
          setAndroidKeyboardInset(
            overlap > 0 ? overlap + ANDROID_KEYBOARD_CLEARANCE : 0
          );
        });
      }
    );
    const keyboardHideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      () => setAndroidKeyboardInset(0)
    );

    return () => {
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
    };
  }, [mode]);

  return (
    <View
      ref={containerRef}
      collapsable={false}
      style={styles.container}
      onLayout={measureVerticalOffset}
    >
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView
          style={styles.container}
          behavior="padding"
          keyboardVerticalOffset={verticalOffset}
        >
          {children}
        </KeyboardAvoidingView>
      ) : (
        <View
          style={[
            styles.container,
            mode === 'active' && androidKeyboardInset > 0
              ? { paddingBottom: androidKeyboardInset }
              : null,
          ]}
        >
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
});

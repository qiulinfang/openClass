import React, { type PropsWithChildren } from 'react';
import {
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const SCREEN_EDGES = ['top', 'left', 'right'] as const;
const BOTTOM_BAR_EDGES = ['bottom', 'left', 'right'] as const;

export const AppSafeAreaColors = {
  bottomNavigation: '#FFFFFF',
  modalChrome: '#FFFFFF',
} as const;

export function AppSafeAreaProvider({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {children}
    </SafeAreaProvider>
  );
}

export function useAppSafeAreaInsets() {
  const measuredInsets = useSafeAreaInsets();
  const initialInsets = initialWindowMetrics?.insets;

  return {
    top: Math.max(
      measuredInsets.top,
      initialInsets?.top || 0,
      Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0
    ),
    right: Math.max(measuredInsets.right, initialInsets?.right || 0),
    bottom: Math.max(measuredInsets.bottom, initialInsets?.bottom || 0),
    left: Math.max(measuredInsets.left, initialInsets?.left || 0),
  };
}

type AppModalProps = React.ComponentProps<typeof Modal>;

export function AppModal(props: AppModalProps) {
  return (
    <Modal
      statusBarTranslucent
      navigationBarTranslucent
      {...props}
    />
  );
}

interface AppSafeAreaViewProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
}

export function AppScreenSafeArea({
  children,
  style,
}: AppSafeAreaViewProps) {
  return (
    <SafeAreaView style={style} edges={SCREEN_EDGES}>
      {children}
    </SafeAreaView>
  );
}

export function AppModalSafeArea({
  children,
  style,
}: AppSafeAreaViewProps) {
  const insets = useAppSafeAreaInsets();

  return (
    <View style={[styles.modalRoot, style]}>
      <View
        style={[
          styles.modalChrome,
          { height: insets.top },
        ]}
      />
      <View
        style={[
          styles.modalContent,
          {
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {children}
      </View>
      <View
        style={[
          styles.modalChrome,
          { height: insets.bottom },
        ]}
      />
    </View>
  );
}

interface AppBottomBarProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  contentHeight?: number;
}

export function AppBottomBar({
  children,
  style,
  contentStyle,
  contentHeight = 60,
}: AppBottomBarProps) {
  return (
    <SafeAreaView
      style={[styles.bottomBar, style]}
      edges={BOTTOM_BAR_EDGES}
    >
      <View
        style={[
          styles.bottomBarContent,
          { height: contentHeight },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  modalChrome: {
    backgroundColor: AppSafeAreaColors.modalChrome,
  },
  bottomBar: {
    backgroundColor: AppSafeAreaColors.bottomNavigation,
    overflow: 'visible',
  },
  bottomBarContent: {
    flexDirection: 'row',
    overflow: 'visible',
  },
});

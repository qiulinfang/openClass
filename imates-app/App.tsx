import React, { useState, useEffect } from 'react';
import { LoginScreen } from '@/screens/LoginScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { HomeworkSolveScreen } from '@/screens/HomeworkSolveScreen';
import { PracticeReviewScreen } from '@/screens/PracticeReviewScreen';
import { storage } from '@/services/storage';
import { authService } from '@/services/auth-service';
import { initEnvConfig } from '@/services/env-config';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DeviceEventEmitter, Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // 检查初始登录状态及监听强制下线事件
  useEffect(() => {
    const checkLoginStatus = async () => {
      // 环境必须先于登录态和所有业务接口初始化。
      // 否则已有登录态会跳过 LoginScreen，导致测试环境被错误地当成正式环境。
      await initEnvConfig();
      const token = await storage.getItem('XUEBAN_TOKEN');
      setIsLoggedIn(!!token);
    };
    checkLoginStatus();

    const logoutSubscription = DeviceEventEmitter.addListener('FORCE_LOGOUT', (data) => {
      const message = data?.message || '设备已经在其他地方登陆，请重新登录。';
      if (Platform.OS === 'web') {
        alert(message);
        handleLogout();
      } else {
        Alert.alert('登录提示', message, [
          {
            text: '确定',
            onPress: async () => {
              await handleLogout();
            },
          },
        ]);
      }
    });

    return () => {
      logoutSubscription.remove();
    };
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    await storage.removeItem('XUEBAN_TOKEN');
    await storage.removeItem('YANBAN_TOKEN');
    await authService.logout();
    setIsLoggedIn(false);
  };

  // 渲染 Loading 态以避免闪烁
  if (isLoggedIn === null) {
    return null;
  }

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home">
          {(props) => <HomeScreen {...props} onLogout={handleLogout} />}
        </Stack.Screen>
        <Stack.Screen name="HomeworkSolve" component={HomeworkSolveScreen} />
        <Stack.Screen name="PracticeReview" component={PracticeReviewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

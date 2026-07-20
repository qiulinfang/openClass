import React, { useState, useEffect } from 'react';
import { LoginScreen } from '@/screens/LoginScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DeviceEventEmitter, Alert } from 'react-native';
import { storage } from '@/services/storage';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [activeScreen, setActiveScreen] = useState<'home' | 'chat'>('home');

  // 检查初始登录状态及监听强制下线事件
  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await storage.getItem('XUEBAN_TOKEN');
      setIsLoggedIn(!!token);
    };
    checkLoginStatus();

    const logoutSubscription = DeviceEventEmitter.addListener('FORCE_LOGOUT', (data) => {
      Alert.alert('登录提示', data?.message || '设备已经在其他地方登陆，请重新登录。', [
        {
          text: '确定',
          onPress: async () => {
            await handleLogout();
          },
        },
      ]);
    });

    return () => {
      logoutSubscription.remove();
    };
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setActiveScreen('home');
  };

  const handleLogout = async () => {
    await storage.removeItem('XUEBAN_TOKEN');
    await storage.removeItem('YANBAN_TOKEN');
    setIsLoggedIn(false);
  };

  // 渲染 Loading 态以避免闪烁
  if (isLoggedIn === null) {
    return null;
  }

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }
  return activeScreen === 'chat' ? (
    <ChatScreen onBack={() => setActiveScreen('home')} />
  ) : (
    <HomeScreen
      onLogout={handleLogout}
      onNavigateToChat={() => setActiveScreen('chat')}
    />
  );
}

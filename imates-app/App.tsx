import React, { useState, useEffect } from 'react';
import { LoginScreen } from '@/screens/LoginScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { storage } from '@/services/storage';
import { authService } from '@/services/auth-service';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

  // 检查初始登录状态
  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await storage.getItem('XUEBAN_TOKEN');
      setIsLoggedIn(!!token);
    };
    checkLoginStatus();
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setActiveScreen('home');
  };

  const handleLogout = async () => {
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

  return activeScreen === 'chat' ? (
    <ChatScreen onBack={() => setActiveScreen('home')} />
  ) : (
    <HomeScreen
      onLogout={handleLogout}
      onNavigateToChat={() => setActiveScreen('chat')}
    />
  );
}

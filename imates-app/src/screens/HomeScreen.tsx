import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';

interface HomeScreenProps {
  onLogout: () => void;
  onNavigateToChat: () => void;
}

export function HomeScreen({ onLogout, onNavigateToChat }: HomeScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Card>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Text style={styles.titleText}>iMates App</Text>
          <Badge text="Hello World" style={styles.badgeMargin} />
          
          <Text style={styles.descriptionText}>
            Your React Native + TypeScript app is ready.
          </Text>

          {/* AI 助手入口按钮 */}
          <TouchableOpacity style={styles.aiButton} onPress={onNavigateToChat}>
            <Text style={styles.aiButtonText}>🤖 AI 智能伴侣聊天</Text>
          </TouchableOpacity>

          {/* 退出登录按钮 */}
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>
        </Card>
        <StatusBar style="light" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  welcomeText: {
    fontSize: 16,
    color: Colors.text.secondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  titleText: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  badgeMargin: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  aiButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 48,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  aiButtonText: {
    color: Colors.text.light,
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    height: 48,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});

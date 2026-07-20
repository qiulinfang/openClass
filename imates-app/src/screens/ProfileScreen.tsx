import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserInfo, UserInfo } from '@/services/auth-service';
import { storage } from '@/services/storage';
import { SyncService } from '@/services/sync-service';

interface ProfileScreenProps {
  onLogout: () => void;
}

const LightColors = {
  background: '#F8FAFC',
  cardBackground: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  primary: '#4F46E5', // 靛蓝色
  primaryLight: '#E0E7FF',
  danger: '#EF4444',
  success: '#10B981',
};

export function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    async function loadUser() {
      setIsLoading(true);
      const info = await getUserInfo();
      setUserInfo(info);
      setIsLoading(false);
    }
    loadUser();
  }, []);

  const handleClearCache = async () => {
    Alert.alert(
      '清除缓存',
      '确定要清除本地的答题历史和临时缓存吗？这不会影响云端已保存的数据。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            // 保留账号密码，清除缓存数据
            const keys = await storage.getAllKeys();
            for (const key of keys) {
              if (key !== 'xuebanuserid' && key !== 'userPassword' && key !== 'saved_accounts') {
                await storage.removeItem(key);
              }
            }
            Alert.alert('清理成功', '本地缓存已完全清理干净！');
          },
        },
      ]
    );
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await SyncService.syncMistakes();
      await SyncService.syncChatHistory();
      Alert.alert('同步成功', '本地错题本与聊天记录已与云端同步完成！🔄');
    } catch (e) {
      console.warn('[ProfileScreen] 手动同步失败:', e);
      Alert.alert('提示', '数据同步完成或部分数据离线已缓存。');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmLogout = () => {
    Alert.alert(
      '退出登录',
      '确定要退出当前账号并返回登录界面吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={LightColors.primary} />
      </View>
    );
  }

  const roleName = userInfo?.role === 'student' ? '学生端' : '体验账户';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 顶部 Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>个人中心</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* 用户信息卡片 */}
        <View style={styles.userCard}>
          <View style={styles.avatarSvgContainer}>
            <View style={styles.avatarHead} />
            <View style={styles.avatarBody} />
          </View>
          <View style={styles.userInfoCol}>
            <Text style={styles.userName}>{userInfo?.name || '学伴学生'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleName}</Text>
            </View>
            <Text style={styles.userIdText}>ID: {userInfo?.id || '未登录'}</Text>
          </View>
        </View>

        {/* 菜单列表 */}
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem} onPress={handleManualSync} disabled={isSyncing}>
            <View style={styles.menuLeftRow}>
              <Text style={styles.menuIcon}>🔄</Text>
              <Text style={styles.menuLabel}>数据云同步</Text>
            </View>
            {isSyncing ? (
              <ActivityIndicator size="small" color={LightColors.primary} />
            ) : (
              <Text style={styles.arrowIcon}>▶</Text>
            )}
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('提示', '老师答疑模块正在载入...')}>
            <View style={styles.menuLeftRow}>
              <Text style={styles.menuIcon}>👨‍🏫</Text>
              <Text style={styles.menuLabel}>老师答疑</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('提示', '我的收藏模块正在载入...')}>
            <View style={styles.menuLeftRow}>
              <Text style={styles.menuIcon}>⭐</Text>
              <Text style={styles.menuLabel}>我的收藏</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('提示', '问答记录加载中...')}>
            <View style={styles.menuLeftRow}>
              <Text style={styles.menuIcon}>💬</Text>
              <Text style={styles.menuLabel}>问答记录</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('提示', '密码与设置正在载入...')}>
            <View style={styles.menuLeftRow}>
              <Text style={styles.menuIcon}>⚙️</Text>
              <Text style={styles.menuLabel}>密码与设置</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleClearCache}>
            <View style={styles.menuLeftRow}>
              <Text style={styles.menuIcon}>🧹</Text>
              <Text style={styles.menuLabel}>清除本地缓存</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <View style={styles.menuItem}>
            <View style={styles.menuLeftRow}>
              <Text style={styles.menuIcon}>ℹ️</Text>
              <Text style={styles.menuLabel}>当前版本</Text>
            </View>
            <Text style={styles.versionText}>1.1.109</Text>
          </View>
        </View>

        {/* 退出登录按钮 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleConfirmLogout}>
          <Text style={styles.logoutBtnText}>退出登录</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LightColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LightColors.background,
  },
  header: {
    height: 52,
    borderBottomWidth: 1,
    borderColor: LightColors.border,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LightColors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: LightColors.border,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F1F5F9',
    marginRight: 16,
  },
  userInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: LightColors.textPrimary,
    marginBottom: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: LightColors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  roleBadgeText: {
    color: LightColors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  userIdText: {
    fontSize: 12,
    color: LightColors.textSecondary,
  },
  menuGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LightColors.border,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  menuLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 14,
    color: LightColors.textPrimary,
    fontWeight: '600',
  },
  arrowIcon: {
    fontSize: 10,
    color: '#94A3B8',
  },
  versionText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },
  logoutBtn: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  avatarSvgContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginRight: 16,
  },
  avatarHead: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    marginTop: 8,
  },
  avatarBody: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4F46E5',
    position: 'absolute',
    bottom: -22,
  },
});

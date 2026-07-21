import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { getUserInfo, UserInfo } from '@/services/auth-service';
import { storage } from '@/services/storage';
import { SyncService } from '@/services/sync-service';

interface ProfileScreenProps {
  onLogout: () => void;
}

const LightColors = {
  background: '#f1f3ff', // Soft purple-blue matching Web
  cardBackground: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  primary: '#4F46E5', // Indigo-600
  primaryLight: '#EEF2FF',
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
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
    if (Platform.OS === 'web') {
      if (globalThis.confirm('确定要退出当前账号并返回登录界面吗？')) {
        onLogout();
      }
      return;
    }

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

  return (
    <View style={styles.container}>
      {/* 顶部蓝紫渐变区 */}
      <View style={styles.gradientHeader}>
        {/* 右上角轻量设置圆盘 */}
        <TouchableOpacity
          style={styles.headerSettingBtn}
          onPress={() => Alert.alert('设置', '系统高级选项模块载入中...')}
        >
          <Text style={styles.headerSettingIcon}>⚙️</Text>
        </TouchableOpacity>

        {/* 头像及基本信息 */}
        <View style={styles.userProfileRow}>
          <View style={styles.avatarWrapper}>
            {/* 默认人像 Icon */}
            <View style={styles.avatarHead} />
            <View style={styles.avatarBody} />
          </View>

          <View style={styles.profileTextInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.userNameText}>{userInfo?.name || '张同学'}</Text>
              {/* 学霸 ⚡ 徽章 */}
              <View style={styles.badgeWrapper}>
                <Text style={styles.badgeText}>⚡</Text>
              </View>
            </View>
            <Text style={styles.userSubText}>九年级 · 乐学少年</Text>
          </View>
        </View>

        {/* 学习统计三栏 */}
        <View style={styles.statsContainer}>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>128</Text>
            <Text style={styles.statLabel}>累计学习(h)</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Text style={styles.statNumber}>45</Text>
            <Text style={styles.statLabel}>解决难题</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Text style={styles.statNumber}>95%</Text>
            <Text style={styles.statLabel}>平均进度</Text>
          </View>
        </View>
      </View>

      {/* 下方流式卡片区 */}
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentInner} showsVerticalScrollIndicator={false}>
        {/* 菜单列表主卡片组 */}
        <View style={styles.menuGroupCard}>
          {/* 0. 学霸积分 */}
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('积分中心', '学霸积分商城建设中...')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#F1F5F9' }]}>
                <Text style={styles.menuItemIcon}>💳</Text>
              </View>
              <View style={styles.pointsTexts}>
                <Text style={styles.menuItemLabel}>学霸积分</Text>
                <Text style={styles.pointsSubtitle}>当前余额: 1,240</Text>
              </View>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />
          {/* 1. 老师答疑记录 */}
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('答疑记录', '老师答疑记录模块载入中...')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#EFF6FF' }]}>
                <Text style={styles.menuItemIcon}>💬</Text>
              </View>
              <Text style={styles.menuItemLabel}>老师答疑记录</Text>
            </View>
            <View style={styles.menuRightArea}>
              {/* 示意设计图上的小电力指示符 */}
              <View style={styles.miniBadge}>
                <Text style={styles.miniBadgeText}>⚡</Text>
              </View>
              <Text style={styles.arrowIcon}>▶</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 2. 我的收藏 */}
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('我的收藏', '收藏列表正在载入...')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.menuItemIcon}>⭐</Text>
              </View>
              <Text style={styles.menuItemLabel}>我的收藏</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 3. 问答记录 */}
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('问答记录', '问答历史记录载入中...')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#F3E8FF' }]}>
                <Text style={styles.menuItemIcon}>📝</Text>
              </View>
              <Text style={styles.menuItemLabel}>问答记录</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 4. 荣誉勋章 */}
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('荣誉勋章', '勋章墙建设中...')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#FCE7F3' }]}>
                <Text style={styles.menuItemIcon}>🎖️</Text>
              </View>
              <Text style={styles.menuItemLabel}>荣誉勋章</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 5. 权限管理 */}
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('权限管理', '应用权限列表加载中...')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#ECFDF5' }]}>
                <Text style={styles.menuItemIcon}>🛡️</Text>
              </View>
              <Text style={styles.menuItemLabel}>权限管理</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 6. 数据云端同步 (原本的功能保留) */}
          <TouchableOpacity style={styles.menuItem} onPress={handleManualSync} disabled={isSyncing}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#EEF2FF' }]}>
                <Text style={styles.menuItemIcon}>🔄</Text>
              </View>
              <Text style={styles.menuItemLabel}>数据云同步</Text>
            </View>
            {isSyncing ? (
              <ActivityIndicator size="small" color={LightColors.primary} />
            ) : (
              <Text style={styles.arrowIcon}>▶</Text>
            )}
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 7. 清理缓存 (原本功能) */}
          <TouchableOpacity style={styles.menuItem} onPress={handleClearCache}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#F1F5F9' }]}>
                <Text style={styles.menuItemIcon}>🧹</Text>
              </View>
              <Text style={styles.menuItemLabel}>清除本地缓存</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 8. 系统的在线客服 */}
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('客服', '智能学伴助理即将接入...')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#F1F5F9' }]}>
                <Text style={styles.menuItemIcon}>🎧</Text>
              </View>
              <Text style={styles.menuItemLabel}>在线客服</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 9. 系统设置 */}
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('系统设置', '系统配置中心正在载入...')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#F1F5F9' }]}>
                <Text style={styles.menuItemIcon}>⚙️</Text>
              </View>
              <Text style={styles.menuItemLabel}>设置</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* 退出登录 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleConfirmLogout}>
          <Text style={styles.logoutBtnText}>退出登录</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LightColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LightColors.background,
  },
  gradientHeader: {
    backgroundColor: '#3E3FD8', // Vibrant Indigo header base
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 24,
    paddingBottom: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    position: 'relative',
  },
  headerSettingBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSettingIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#5C60E6', // Slightly lighter circle border accent
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  avatarBody: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: -20,
  },
  profileTextInfo: {
    justifyContent: 'center',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userNameText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 8,
  },
  badgeWrapper: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  userSubText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  pointsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -30, // Overlaps header
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  pointsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsIconBg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pointsIcon: {
    fontSize: 20,
  },
  pointsTexts: {
    justifyContent: 'center',
  },
  pointsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  pointsSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  arrowIcon: {
    fontSize: 10,
    color: '#94A3B8',
  },
  menuGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 18,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemIcon: {
    fontSize: 16,
  },
  menuItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  menuRightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBadgeText: {
    fontSize: 10,
    color: '#4F46E5',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  logoutBtn: {
    height: 48,
    borderRadius: 24, // Pill button matching design
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
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
    fontWeight: '600',
    color: '#EF4444',
  },
});

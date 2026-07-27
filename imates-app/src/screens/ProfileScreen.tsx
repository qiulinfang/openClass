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
import * as ImagePicker from 'expo-image-picker';
import {
  ImageManipulator,
  SaveFormat,
} from 'expo-image-manipulator';
import { getUserInfo, UserInfo } from '@/services/auth-service';
import { storage } from '@/services/storage';
import appJson from '../../app.json';

interface ProfileScreenProps {
  onLogout: () => void;
  onOpenTeacherRecords: () => void;
  onOpenFavorites: () => void;
  onOpenQuestionRecords: () => void;
  onOpenSupport: () => void;
}

const APP_VERSION = appJson.expo.version;
const AVATAR_STORAGE_KEY = 'userInfo';

const resolveAvatarUri = (userInfo: UserInfo | null): string | null => {
  const avatar = userInfo?.avatarNew || userInfo?.avatar;
  if (!avatar) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(avatar)) return avatar;
  return `https://www.imates.com.cn${avatar.startsWith('/') ? '' : '/'}${avatar}`;
};

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

export function ProfileScreen({
  onLogout,
  onOpenTeacherRecords,
  onOpenFavorites,
  onOpenQuestionRecords,
  onOpenSupport,
}: ProfileScreenProps) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    async function loadUser() {
      setIsLoading(true);
      const info = await getUserInfo();
      setUserInfo(info);
      setIsLoading(false);
    }
    loadUser();
  }, []);

  const handleChangeAvatar = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('需要相册权限', '请允许访问相册后再更换头像。');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const imageContext = ImageManipulator.manipulate(asset.uri);
      imageContext.resize({ width: 512, height: 512 });
      const renderedImage = await imageContext.renderAsync();
      const optimizedImage = await renderedImage.saveAsync({
        base64: true,
        compress: 0.72,
        format: SaveFormat.JPEG,
      });
      const avatarNew = optimizedImage.base64
        ? `data:image/jpeg;base64,${optimizedImage.base64}`
        : optimizedImage.uri;
      const nextUserInfo: UserInfo = {
        ...(userInfo || { id: '', name: '学伴用户' }),
        avatarNew,
      };

      await storage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(nextUserInfo));
      setUserInfo(nextUserInfo);
      setAvatarLoadFailed(false);
      Alert.alert('头像已更新', '新的头像已保存。');
    } catch (error) {
      console.warn('[ProfileScreen] 更换头像失败:', error);
      Alert.alert('更换失败', '暂时无法读取所选图片，请稍后重试。');
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
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={handleChangeAvatar}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="更换头像"
          >
            {resolveAvatarUri(userInfo) && !avatarLoadFailed ? (
              <Image
                source={{ uri: resolveAvatarUri(userInfo)! }}
                style={styles.avatarImage}
                resizeMode="cover"
                onError={() => setAvatarLoadFailed(true)}
                accessibilityLabel="用户头像"
              />
            ) : (
              <>
                <View style={styles.avatarHead} />
                <View style={styles.avatarBody} />
              </>
            )}
            <View style={styles.avatarEditOverlay}>
              <Text style={styles.avatarEditText}>更换</Text>
            </View>
          </TouchableOpacity>

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
      </View>

      {/* 下方流式卡片区 */}
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentInner} showsVerticalScrollIndicator={false}>
        {/* 菜单列表主卡片组 */}
        <View style={styles.menuGroupCard}>
          {/* 老师答疑记录 */}
          <TouchableOpacity style={styles.menuItem} onPress={onOpenTeacherRecords}>
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

          {/* 我的收藏 */}
          <TouchableOpacity style={styles.menuItem} onPress={onOpenFavorites}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.menuItemIcon}>⭐</Text>
              </View>
              <Text style={styles.menuItemLabel}>我的收藏</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 问答记录 */}
          <TouchableOpacity style={styles.menuItem} onPress={onOpenQuestionRecords}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#F3E8FF' }]}>
                <Text style={styles.menuItemIcon}>📝</Text>
              </View>
              <Text style={styles.menuItemLabel}>问答记录</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 在线客服 */}
          <TouchableOpacity style={styles.menuItem} onPress={onOpenSupport}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#F1F5F9' }]}>
                <Text style={styles.menuItemIcon}>🎧</Text>
              </View>
              <Text style={styles.menuItemLabel}>在线客服</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#EEF2FF' }]}>
                <Text style={styles.versionIcon}>v</Text>
              </View>
              <Text style={styles.menuItemLabel}>版本号</Text>
            </View>
            <Text style={styles.versionText}>v{APP_VERSION}</Text>
          </View>
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
    paddingBottom: 24,
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
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEditOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 18,
    backgroundColor: 'rgba(17, 24, 39, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
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
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  arrowIcon: {
    fontSize: 10,
    color: '#94A3B8',
  },
  versionText: {
    fontSize: 13,
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },
  versionIcon: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4F46E5',
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

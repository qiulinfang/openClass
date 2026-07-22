import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Card } from '@/components/Card';
import { authService, getUserId, getPassword } from '@/services/auth-service';
import { HomeworkService } from '@/services/homework-service';
import {
  AppEnvType,
  getBuildDisplayName,
  getCurrentEnvType,
  getEnvDisplayName,
  isInternalBuild,
  trySwitchEnv,
  initEnvConfig,
} from '@/services/env-config';
import { storage } from '@/services/storage';
import { formatApiError, getPublicErrorMessage } from '@/services/api-error';
import {
  isDetailedDiagnosticsEnabled,
  runLoginNetworkDiagnostics,
} from '@/services/network-diagnostics';

interface SavedAccount {
  account: string;
  password: string;
  lastUsed: number;
}

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  // 表单状态
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ account: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 历史账号状态
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showAccountsDropdown, setShowAccountsDropdown] = useState(false);

  // 环境切换及版本号点击状态
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [currentEnv, setCurrentEnv] = useState<AppEnvType>(getCurrentEnvType());
  const [versionClickCount, setVersionClickCount] = useState(0);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);

  // 环境切换弹窗状态
  const [envModalVisible, setEnvModalVisible] = useState(false);
  const [envPassword, setEnvPassword] = useState('');
  const [targetEnv, setTargetEnv] = useState<AppEnvType>(AppEnvType.RELEASE);

  // 内测/开发构建的网络诊断状态。正式构建不会显示完整技术细节。
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsReport, setDiagnosticsReport] = useState('尚未运行网络诊断');

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      await initEnvConfig();
      setCurrentEnv(getCurrentEnvType());
      await loadSavedAccounts();
      
      // 自动填充上次登录账号密码
      const lastUser = await getUserId();
      const lastPass = await getPassword();
      if (lastUser && lastPass) {
        setAccount(lastUser);
        setPassword(lastPass);
      }
    };
    init();
  }, []);

  // 加载多账号列表
  const loadSavedAccounts = async () => {
    try {
      const listJson = await storage.getItem('saved_accounts');
      if (listJson) {
        const parsed = JSON.parse(listJson) as SavedAccount[];
        setSavedAccounts(parsed.sort((a, b) => b.lastUsed - a.lastUsed));
      }
    } catch (e) {
      console.error('[LoginScreen] 加载账号列表失败:', e);
    }
  };

  // 保存多账号列表
  const saveAccountsList = async (list: SavedAccount[]) => {
    try {
      await storage.setItem('saved_accounts', JSON.stringify(list));
      setSavedAccounts(list);
    } catch (e) {
      console.error('[LoginScreen] 保存账号列表失败:', e);
    }
  };

  // 选择并填充账号
  const selectAccount = (item: SavedAccount) => {
    setAccount(item.account);
    setPassword(item.password);
    setShowAccountsDropdown(false);
    setErrors({ account: '', password: '' });
  };

  // 删除已保存的账号
  const deleteSavedAccount = async (accountName: string) => {
    const filtered = savedAccounts.filter((a) => a.account !== accountName);
    await saveAccountsList(filtered);
  };

  // 输入验证
  const validateAccount = () => {
    if (!account.trim()) {
      setErrors((prev) => ({ ...prev, account: '请输入账号' }));
      return false;
    }
    setErrors((prev) => ({ ...prev, account: '' }));
    return true;
  };

  const validatePassword = () => {
    if (!password.trim()) {
      setErrors((prev) => ({ ...prev, password: '请输入密码' }));
      return false;
    }
    setErrors((prev) => ({ ...prev, password: '' }));
    return true;
  };

  // 版本号点击环境切换彩蛋
  const handleVersionClick = () => {
    setVersionClickCount((prev) => {
      const nextCount = prev + 1;

      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }

      clickTimer.current = setTimeout(() => {
        setVersionClickCount(0);
      }, 2000);

      if (nextCount >= 5) {
        setVersionClickCount(0);
        triggerEnvSwitch();
      }
      return nextCount;
    });
  };

  // 触发环境切换弹窗配置
  const triggerEnvSwitch = () => {
    const nextEnv =
      currentEnv === AppEnvType.RELEASE
        ? AppEnvType.INTERNAL_TEST
        : AppEnvType.RELEASE;
    setTargetEnv(nextEnv);
    setEnvPassword('');
    setEnvModalVisible(true);
  };

  // 确认环境切换
  const handleEnvSwitchConfirm = async () => {
    if (targetEnv === AppEnvType.INTERNAL_TEST && envPassword !== '985211') {
      Alert.alert('提示', '密码错误，环境切换失败');
      return;
    }

    const success = await trySwitchEnv(targetEnv, envPassword);
    if (success) {
      setCurrentEnv(targetEnv);
      setEnvModalVisible(false);
      Alert.alert('成功', `环境已成功切换至: ${targetEnv === AppEnvType.RELEASE ? '正式环境' : '测试环境'}`);
    }
  };

  // 登录逻辑
  const handleLogin = async () => {
    setErrorMessage('');
    const isAccountValid = validateAccount();
    const isPasswordValid = validatePassword();

    if (!isAccountValid || !isPasswordValid) {
      return;
    }

    setIsLoading(true);
    try {
      const token = await authService.loginXueban(account, password);
      await authService.getUserInfo(token);

      // 同步登录研伴系统以提前获取 YANBAN_TOKEN
      try {
        await HomeworkService.loginYanban(account, password);
      } catch (ybError) {
        console.error('[LoginScreen] 研伴系统登录失败:', ybError);
      }

      // 多账号列表持久化
      const existingIndex = savedAccounts.findIndex((a) => a.account === account);
      let updatedAccounts = [...savedAccounts];
      if (existingIndex !== -1) {
        updatedAccounts[existingIndex].password = password;
        updatedAccounts[existingIndex].lastUsed = Date.now();
      } else {
        updatedAccounts.push({
          account,
          password,
          lastUsed: Date.now(),
        });
      }
      await saveAccountsList(updatedAccounts);

      // 登录成功回调
      onLoginSuccess();
    } catch (error: unknown) {
      const publicMessage = getPublicErrorMessage(error);
      const fullError = formatApiError(error);
      console.error('[LoginScreen] 登录失败完整信息\n' + fullError);
      setErrorMessage(publicMessage);

      if (isDetailedDiagnosticsEnabled()) {
        setDiagnosticsReport(fullError);
        setDiagnosticsVisible(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setDiagnosticsVisible(true);
    setDiagnosticsLoading(true);
    setDiagnosticsReport('正在检查登录服务器连接...');
    try {
      setDiagnosticsReport(await runLoginNetworkDiagnostics());
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const handleCopyDiagnostics = async () => {
    await Clipboard.setStringAsync(diagnosticsReport);
    Alert.alert('已复制', '诊断信息已复制到剪贴板');
  };

  const isFormValid = account.trim() !== '' && password.trim() !== '' && !errors.account && !errors.password;

  const dismissKeyboardAndDropdown = () => {
    Keyboard.dismiss();
    setShowAccountsDropdown(false);
  };

  const screenContent = (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.innerContainer}>
          <Card style={styles.loginCard}>
            <Text style={styles.title}>iMates</Text>
            <Text style={styles.subtitle}>用户登录</Text>

            {/* 账号输入框 */}
            <View style={[styles.inputWrapper, styles.accountInputWrapper]}>
              <View style={[styles.inputContainer, errors.account ? styles.inputErrorBorder : null]}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入账号"
                  placeholderTextColor="#94A3B8"
                  value={account}
                  onChangeText={(text) => {
                    setAccount(text);
                    if (errors.account) setErrors((prev) => ({ ...prev, account: '' }));
                  }}
                  onBlur={validateAccount}
                  onFocus={() => {
                    if (savedAccounts.length > 0) setShowAccountsDropdown(true);
                  }}
                />
                {savedAccounts.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowAccountsDropdown(!showAccountsDropdown)}
                    style={styles.dropdownToggle}
                  >
                    <Text style={styles.arrowIcon}>▼</Text>
                  </TouchableOpacity>
                )}
              </View>
              {errors.account ? <Text style={styles.errorText}>{errors.account}</Text> : null}

              {/* 账号下拉菜单 */}
              {showAccountsDropdown && savedAccounts.length > 0 && (
                <View style={styles.dropdownList}>
                  <FlatList
                    data={savedAccounts}
                    keyExtractor={(item) => item.account}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <View style={styles.dropdownItem}>
                        <TouchableOpacity
                          style={styles.dropdownItemTextContainer}
                          onPress={() => selectAccount(item)}
                        >
                          <Text style={styles.dropdownItemText}>{item.account}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteSavedAccount(item.account)}
                          style={styles.deleteAccountBtn}
                        >
                          <Text style={styles.deleteAccountText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                </View>
              )}
            </View>

            {/* 密码输入框 */}
            <View style={[styles.inputWrapper, styles.passwordInputWrapper]}>
              <View style={[styles.inputContainer, errors.password ? styles.inputErrorBorder : null]}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入密码"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  onBlur={validatePassword}
                  onFocus={() => setShowAccountsDropdown(false)}
                />
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            {/* 错误 Banner */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
                {isDetailedDiagnosticsEnabled() ? (
                  <TouchableOpacity onPress={() => setDiagnosticsVisible(true)}>
                    <Text style={styles.errorDetailLink}>查看完整错误</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* 登录按钮 */}
            <TouchableOpacity
              style={[styles.loginButton, !isFormValid || isLoading ? styles.loginButtonDisabled : null]}
              onPress={handleLogin}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.loginButtonText}> 登录中...</Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>登 录</Text>
              )}
            </TouchableOpacity>
          </Card>

          {isDetailedDiagnosticsEnabled() ? (
            <TouchableOpacity
              style={styles.diagnosticsButton}
              onPress={handleRunDiagnostics}
              disabled={diagnosticsLoading}
            >
              <Text style={styles.diagnosticsButtonText}>
                {diagnosticsLoading ? '诊断中...' : '网络诊断工具'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* 版本号（支持连续点击触发环境切换） */}
          <TouchableOpacity activeOpacity={0.8} onPress={handleVersionClick} style={styles.versionContainer}>
            <Text style={styles.versionText}>
              v{appVersion} · {getBuildDisplayName()}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 环境切换弹窗 */}
      <Modal
        visible={envModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEnvModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              切换到{targetEnv === AppEnvType.RELEASE ? '正式环境' : '测试环境'}
            </Text>
            <Text style={styles.modalMessage}>
              确认切换当前运行环境？
            </Text>

            {targetEnv === AppEnvType.INTERNAL_TEST && (
              <TextInput
                style={styles.modalInput}
                placeholder="请输入环境切换密码"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={envPassword}
                onChangeText={setEnvPassword}
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelBtn]}
                onPress={() => setEnvModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmBtn]}
                onPress={handleEnvSwitchConfirm}
              >
                <Text style={styles.modalConfirmText}>确认切换</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 仅开发/内测构建可见，避免正式版向普通用户暴露接口细节。 */}
      <Modal
        visible={diagnosticsVisible && isDetailedDiagnosticsEnabled()}
        transparent
        animationType="slide"
        onRequestClose={() => setDiagnosticsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.diagnosticsModalContent}>
            <Text style={styles.modalTitle}>登录网络诊断</Text>
            <Text style={styles.diagnosticsWarning}>
              报告不包含密码，但可能包含接口地址和服务器响应。
            </Text>
            <ScrollView style={styles.diagnosticsScroll}>
              <Text selectable style={styles.diagnosticsReportText}>
                {diagnosticsReport}
              </Text>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelBtn]}
                onPress={() => setDiagnosticsVisible(false)}
              >
                <Text style={styles.modalCancelText}>关闭</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmBtn]}
                onPress={handleCopyDiagnostics}
              >
                <Text style={styles.modalConfirmText}>复制报告</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  // Web 上父级 TouchableWithoutFeedback 的点击会在输入框聚焦后立即触发
  // Keyboard.dismiss，使输入框无法保持焦点。Web 直接渲染页面内容即可。
  if (Platform.OS === 'web') {
    return screenContent;
  }

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboardAndDropdown}>
      {screenContent}
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF6FF', // 浅蓝亮色背景
  },
  keyboardView: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginCard: {
    paddingVertical: 36,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  accountInputWrapper: {
    zIndex: 20,
  },
  passwordInputWrapper: {
    zIndex: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 52,
    paddingHorizontal: 16,
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    fontSize: 15,
    marginRight: 10,
    color: '#64748B',
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    height: '100%',
  },
  dropdownToggle: {
    paddingLeft: 12,
    height: '100%',
    justifyContent: 'center',
  },
  arrowIcon: {
    fontSize: 10,
    color: '#94A3B8',
  },
  dropdownList: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 150,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 100,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemTextContainer: {
    flex: 1,
  },
  dropdownItemText: {
    color: '#334155',
    fontSize: 14,
  },
  deleteAccountBtn: {
    padding: 4,
  },
  deleteAccountText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  errorBannerText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
  },
  errorDetailLink: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  loginButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    height: 50,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 12,
  },
  loginButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  versionContainer: {
    marginTop: 16,
    padding: 10,
  },
  versionText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalMessage: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 48,
    paddingHorizontal: 16,
    color: '#0F172A',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtn: {
    marginRight: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    marginLeft: 8,
    backgroundColor: '#3B82F6',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  diagnosticsButton: {
    marginTop: 18,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  diagnosticsButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },
  diagnosticsModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 560,
    maxHeight: '82%',
  },
  diagnosticsWarning: {
    color: '#B45309',
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    marginBottom: 12,
  },
  diagnosticsScroll: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    padding: 12,
  },
  diagnosticsReportText: {
    color: '#E2E8F0',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

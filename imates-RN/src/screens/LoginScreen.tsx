/**
 * 登录页面
 * 第1步：页面加载时从AsyncStorage读取已保存的账号密码
 * 第2步：用户输入账号密码并点击登录
 * 第3步：调用登录API并保存token和用户信息
 * 第4步：跳转到主应用
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useUserStore } from '../stores/userStore'
import { apiService } from '../services/apiService'
import { StorageService, StorageKeys } from '../services/storageService'

const LoginScreen: React.FC = () => {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState({ account: '', password: '' })
  const navigation = useNavigation()
  const { setUserInfo } = useUserStore()

  // 第1步：页面加载时从AsyncStorage读取已保存的账号密码
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        // 第2步：获取保存的账号
        const savedUserId = await StorageService.getItem<string>(StorageKeys.USER_ID)
        // 第3步：获取保存的密码
        const savedPassword = await StorageService.getItem<string>(StorageKeys.USER_PASSWORD)

        // 第4步：如果账号密码都存在且有效，则自动填充表单
        if (
          savedUserId &&
          savedPassword &&
          savedUserId !== 'undefined' &&
          savedPassword !== 'undefined' &&
          savedUserId.trim() !== '' &&
          savedPassword.trim() !== ''
        ) {
          setAccount(savedUserId)
          setPassword(savedPassword)
        }
      } catch (error) {
        console.error('[Login] ❌ 加载保存的凭据失败:', error)
      }
    }

    loadSavedCredentials()
  }, [])

  // 表单验证
  const validateAccount = (): boolean => {
    if (!account.trim()) {
      setErrors((prev) => ({ ...prev, account: '请输入账号' }))
      return false
    }
    setErrors((prev) => ({ ...prev, account: '' }))
    return true
  }

  const validatePassword = (): boolean => {
    if (!password.trim()) {
      setErrors((prev) => ({ ...prev, password: '请输入密码' }))
      return false
    }
    setErrors((prev) => ({ ...prev, password: '' }))
    return true
  }

  const isFormValid = account.trim() && password.trim()

  // 登录处理
  const handleLogin = async () => {
    // 清除之前的错误信息
    setErrors({ account: '', password: '' })

    // 验证表单
    const isAccountValid = validateAccount()
    const isPasswordValid = validatePassword()

    if (!isAccountValid || !isPasswordValid) {
      return
    }

    setIsLoading(true)

    try {
      // 第1步：调用登录API（内部自动保存token和用户凭据）
      const token = await apiService.loginXueban(account, password)

      // 第2步：获取用户信息（内部自动完成持久化和同步到Android）
      const userInfo = await apiService.getUserInfo(token)

      // 第3步：设置用户信息到Store
      await setUserInfo(userInfo)

      // 第4步：跳转到主应用
      navigation.navigate('Main' as never)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '登录失败，请检查网络连接'
      Alert.alert('登录失败', message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Logo和标题 */}
          <View style={styles.header}>
            <Text style={styles.logo}>📚</Text>
            <Text style={styles.title}>研伴学习助手</Text>
            <Text style={styles.subtitle}>请输入您的账号和密码开始学习之旅</Text>
          </View>

          {/* 登录表单 */}
          <View style={styles.formContainer}>
            <View style={styles.form}>
            {/* 账号输入框 */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>账号</Text>
              <TextInput
                style={[styles.input, errors.account ? styles.inputError : null]}
                placeholder="请输入账号"
                placeholderTextColor="#999"
                value={account}
                onChangeText={(text) => {
                  setAccount(text)
                  if (errors.account) {
                    setErrors((prev) => ({ ...prev, account: '' }))
                  }
                }}
                onBlur={validateAccount}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              {errors.account ? <Text style={styles.errorText}>{errors.account}</Text> : null}
            </View>

            {/* 密码输入框 */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>密码</Text>
              <TextInput
                style={[styles.input, errors.password ? styles.inputError : null]}
                placeholder="请输入密码"
                placeholderTextColor="#999"
                value={password}
                onChangeText={(text) => {
                  setPassword(text)
                  if (errors.password) {
                    setErrors((prev) => ({ ...prev, password: '' }))
                  }
                }}
                onBlur={validatePassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            {/* 登录按钮 */}
            <TouchableOpacity
              style={[styles.button, (!isFormValid || isLoading) && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={!isFormValid || isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>登录</Text>
              )}
            </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    padding: 20,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#f44336',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
  },
  button: {
    height: 50,
    backgroundColor: '#667eea',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})

export default LoginScreen

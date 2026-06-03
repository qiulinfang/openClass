<template>
  <view class="login-page">
    <!-- 登录表单容器 -->
    <view class="login-form-container">
      <view class="login-form-card">
        <view class="login-form-section">
          <form @submit.prevent="handleLogin" class="login-form">
            <!-- 用户名输入框 -->
            <view class="user-id-input-wrapper">
              <view class="login-input-container" :class="{ 'has-error': !!errors.account }">
                <image :src="usernameIcon" class="username-icon" mode="aspectFit" />
                <input
                  v-model="loginForm.account"
                  type="text"
                  placeholder="请输入账号"
                  class="login-input"
                  @blur="validateAccount"
                />
              </view>
              <view v-if="errors.account" class="input-error">{{ errors.account }}</view>
            </view>

            <!-- 密码输入框 -->
            <view class="password-input-wrapper">
              <view class="login-input-container" :class="{ 'has-error': !!errors.password }">
                <image :src="passwordIcon" class="password-icon" mode="aspectFit" />
                <input
                  v-model="loginForm.password"
                  password
                  placeholder="请输入密码"
                  class="login-input"
                  @blur="validatePassword"
                />
              </view>
              <view v-if="errors.password" class="input-error">{{ errors.password }}</view>
            </view>

            <!-- 登录按钮 -->
            <button
              class="login-button"
              :disabled="!isFormValid || isLoading"
              form-type="submit"
            >
              <view v-if="isLoading" class="button-loading">
                <view class="spinner"></view>
                <text>登录中...</text>
              </view>
              <text v-else>登 录</text>
            </button>

            <!-- 错误提示 -->
            <view v-if="errorMessage" class="error-banner">
              {{ errorMessage }}
            </view>
          </form>
        </view>
      </view>
    </view>

    <!-- 版本号显示 -->
    <view class="version-text" @click="handleVersionClick">
      <text>{{ displayVersion }}</text>
    </view>

    <!-- 环境切换对话框 -->
    <Dialog
      ref="envSwitchDialog"
      :title="dialogConfig.title"
      :confirmButtonText="dialogConfig.confirmText"
      :cancelButtonText="dialogConfig.cancelText"
      @confirm="handleEnvSwitchConfirm"
      @cancel="cancelEnvSwitchDialog"
    >
      <view class="env-switch-content">
        <text>{{ dialogConfig.message }}</text>
        <input
          v-if="dialogConfig.needPassword"
          v-model="envSwitchPassword"
          password
          placeholder="请输入密码"
          class="env-password-input"
          @confirm="handleEnvSwitchConfirm"
        />
      </view>
    </Dialog>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { authService, getUserId, getPassword, httpClient } from '../services'
import { AppEnvType, getCurrentEnvType, getEnvDisplayName, trySwitchEnv, getAppUpdateUrl } from '../config/env-config'
import Dialog from '../components/base/Dialog.vue'

// 资源路径适配 - 微信小程序建议放在 static 目录下
const usernameIcon = '/static/icons/username_icon.svg'
const passwordIcon = '/static/icons/password_icon.svg'

const loginForm = reactive({
  account: '',
  password: ''
})

const errors = reactive({
  account: '',
  password: ''
})

const isLoading = ref(false)
const errorMessage = ref('')
const versionClickCount = ref(0)
const versionClickTimer = ref<number | null>(null)
const appVersion = ref('')
const currentEnv = ref<AppEnvType>(getCurrentEnvType())

// 环境切换对话框相关
const envSwitchDialog = ref<InstanceType<typeof Dialog> | null>(null)
const envSwitchPassword = ref('')
const targetEnvType = ref<AppEnvType>(AppEnvType.RELEASE)
const dialogConfig = reactive({
  title: '环境切换',
  message: '',
  confirmText: '确认',
  cancelText: '取消',
  needPassword: false,
})

// 显示版本号（包含环境标识）
const displayVersion = computed(() => {
  const envName = getEnvDisplayName()
  return envName ? `${appVersion.value}\n${envName}` : appVersion.value
})

// 版本号存储的 key
const APP_VERSION_STORAGE_KEY = 'app_version'

// 从存储读取版本号
const loadAppVersion = (): string => {
  try {
    const savedVersion = (uni as any).getStorageSync(APP_VERSION_STORAGE_KEY)
    return savedVersion || '1.0.0'
  } catch (error) {
    console.error('[LoginView] 读取版本号失败:', error)
    return '1.0.0'
  }
}

// 保存版本号到存储
const saveAppVersion = (version: string): void => {
  try {
    (uni as any).setStorageSync(APP_VERSION_STORAGE_KEY, version)
    console.log('[LoginView] 版本号已保存:', version)
  } catch (error) {
    console.error('[LoginView] 保存版本号失败:', error)
  }
}

// 检查应用更新并同步服务器版本号
const checkAppUpdate = async () => {
  try {
    const url = getAppUpdateUrl()
    const cacheBustedUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
    const response = await httpClient.get<any>(cacheBustedUrl)
    const result = response?.data ?? response
    if (!result) {
      console.log("检查应用更新无结果");
      return
    }
    const serverVersion = (result as any).versionName || (result as any).VersionName || ''
    if (serverVersion && typeof serverVersion === 'string') {
      appVersion.value = serverVersion
      saveAppVersion(serverVersion)
      console.log('[LoginView] 检查更新成功，服务器版本号:', serverVersion)
    }
  } catch (error) {
    console.warn('[LoginView] 检查更新失败:', error)
  }
}

onMounted(async () => {
  // 获取保存的账号密码
  const savedUserId = getUserId()
  const savedPassword = getPassword()
  
  if (savedUserId && savedPassword && 
      savedUserId !== 'undefined' && savedPassword !== 'undefined' &&
      savedUserId.trim() !== '' && savedPassword.trim() !== '') {
    loginForm.account = savedUserId
    loginForm.password = savedPassword
  }

  // 加载已保存的版本号
  appVersion.value = loadAppVersion()
  
  // 检查服务器版本号
  await checkAppUpdate()
})

const validateAccount = () => {
  if (!loginForm.account.trim()) {
    errors.account = '请输入账号'
    return false
  }
  errors.account = ''
  return true
}

const validatePassword = () => {
  if (!loginForm.password.trim()) {
    errors.password = '请输入密码'
    return false
  }
  errors.password = ''
  return true
}

const isFormValid = computed(() => {
  return loginForm.account.trim() !== '' && 
         loginForm.password.trim() !== '' && 
         !errors.account && 
         !errors.password
})

// 处理版本号点击事件
const handleVersionClick = () => {
  versionClickCount.value++
  
  if (versionClickTimer.value) {
    clearTimeout(versionClickTimer.value)
  }
  
  versionClickTimer.value = setTimeout(() => {
    versionClickCount.value = 0
  }, 2000) as unknown as number
  
  if (versionClickCount.value >= 5) {
    versionClickCount.value = 0
    showEnvSwitchDialog()
  }
}

// 显示环境切换对话框
const showEnvSwitchDialog = () => {
  const currentEnvType = getCurrentEnvType()
  const targetEnv = currentEnvType === AppEnvType.RELEASE 
    ? AppEnvType.INTERNAL_TEST 
    : AppEnvType.RELEASE
  
  targetEnvType.value = targetEnv
  const targetEnvName = targetEnv === AppEnvType.RELEASE ? '正式环境' : '测试环境'
  
  if (targetEnv === AppEnvType.INTERNAL_TEST) {
    dialogConfig.title = '切换到测试环境'
    dialogConfig.message = `确认切换到${targetEnvName}？`
    dialogConfig.needPassword = true
    dialogConfig.confirmText = '确认切换'
    envSwitchPassword.value = ''
  } else {
    dialogConfig.title = '切换到正式环境'
    dialogConfig.message = `确认切换到${targetEnvName}？`
    dialogConfig.needPassword = false
    dialogConfig.confirmText = '确认切换'
  }
  
  envSwitchDialog.value?.openDialog()
}

// 处理环境切换确认
const handleEnvSwitchConfirm = () => {
  const targetEnv = targetEnvType.value
  
  if (dialogConfig.needPassword) {
    const password = envSwitchPassword.value
    const success = trySwitchEnv(targetEnv, password)
    if (success) {
      currentEnv.value = targetEnv
      ;(uni as any).reLaunch({ url: '/pages/login/login' })
    } else {
      errorMessage.value = '密码错误，切换失败'
      setTimeout(() => {
        errorMessage.value = ''
      }, 3000)
    }
  } else {
    trySwitchEnv(targetEnv)
    currentEnv.value = targetEnv
    ;(uni as any).reLaunch({ url: '/pages/login/login' })
  }
}

const cancelEnvSwitchDialog = () => {
  dialogConfig.needPassword = false
  envSwitchPassword.value = ''
  envSwitchDialog.value?.closeDialog()
}

const handleLogin = async () => {
  errorMessage.value = ''
  
  const isAccountValid = validateAccount()
  const isPasswordValid = validatePassword()
  
  if (!isAccountValid || !isPasswordValid) {
    return
  }
  
  isLoading.value = true
  
  try {
    const token = await authService.loginXueban(loginForm.account, loginForm.password)
    await authService.getUserInfo(token)
    
    // 小程序端跳转
    ;(uni as any).switchTab({
      url: '/pages/index/index'
    })
    
  } catch (error: any) {
    const message = error.message || '登录失败，请检查网络连接'
    errorMessage.value = message
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-page {
  width: 100vw;
  height: 100vh;
  background-image: url('/static/images/login_bg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  overflow: hidden;
}

.login-form-container {
  position: absolute;
  width: 600rpx;
  height: 70vh;
  right: 50rpx;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-form-card {
  width: 100%;
  background: transparent;
}

.login-form-section {
  padding: 0;
  margin-top: 92rpx;
}

.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 40rpx;
  box-sizing: border-box;
  position: relative;
}

.user-id-input-wrapper,
.password-input-wrapper {
  width: 100%;
  margin-bottom: 20rpx;
}

.login-input-container {
  display: flex;
  align-items: center;
  width: 100%;
  height: 80rpx;
  background-color: #FFFFFF;
  border-radius: 24rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.username-icon,
.password-icon {
  width: 40rpx;
  height: 40rpx;
}

.login-input-container.has-error {
  border: 2rpx solid #FF0000;
}

.login-input {
  flex: 1;
  height: 100%;
  color: #000000;
  font-size: 28rpx;
  margin-left: 16rpx;
}

.input-error {
  padding-top: 8rpx;
  padding-left: 8rpx;
  color: #FF0000;
  font-size: 24rpx;
  min-height: 32rpx;
}

.login-button {
  width: 100%;
  height: 80rpx;
  margin-top: 40rpx;
  background-color: #6e55ff;
  color: #FFFFFF;
  border-radius: 24rpx;
  font-size: 32rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.login-button::after {
  border: none;
}

.login-button[disabled] {
  opacity: 0.6;
}

.button-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.spinner {
  width: 32rpx;
  height: 32rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.3);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-banner {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  color: #ff0000;
  font-size: 28rpx;
  text-align: center;
}

.version-text {
  position: absolute;
  bottom: 32rpx;
  right: 32rpx;
  color: #ffffff;
  font-size: 28rpx;
  text-align: center;
}

.env-switch-content {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.env-password-input {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  border: 2rpx solid #d1d5db;
  border-radius: 16rpx;
  font-size: 28rpx;
}

@media (max-width: 768px) {
  .login-form-container {
    width: 90%;
    right: 5%;
  }
}
</style>

<template>
  <view class="login-page">
    <!-- 登录表单容器 -->
    <view class="login-form-container">
      <view class="login-form-card">
        <view class="login-form-section">
          <form @submit.prevent="handleLogin" class="login-form">
            <!-- 账号输入框 -->
            <view class="user-id-input-wrapper">
              <view class="login-input-container" :class="{ 'has-error': !!errors.account }">
                <text class="input-icon">👤</text>
                <input
                  v-model="loginForm.account"
                  type="text"
                  placeholder="请输入账号"
                  class="login-input"
                  @blur="validateAccount"
                  @focus="showAccountsDropdown = true"
                />
                <!-- 下拉触发箭头 -->
                <text
                  v-if="savedAccounts.length > 0"
                  class="account-dropdown-arrow"
                  @click.stop="toggleAccountsDropdown"
                >▼</text>
                
                <!-- 下拉菜单列表 -->
                <view v-if="showAccountsDropdown && savedAccounts.length > 0" class="accounts-dropdown-list">
                  <view
                    v-for="item in savedAccounts"
                    :key="item.account"
                    class="accounts-dropdown-item"
                    @click="selectAccount(item)"
                  >
                    <text class="account-name">{{ item.account }}</text>
                    <text
                      class="delete-account-btn"
                      @click.stop="deleteSavedAccount(item.account)"
                    >✕</text>
                  </view>
                </view>
              </view>
              <view v-if="errors.account" class="input-error">{{ errors.account }}</view>
            </view>

            <!-- 密码输入框 -->
            <view class="password-input-wrapper">
              <view class="login-input-container" :class="{ 'has-error': !!errors.password }">
                <text class="input-icon">🔒</text>
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
              @click="handleLogin"
            >
              <text v-if="isLoading">登录中...</text>
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

    <!-- 版本号显示 (连续点击5次触发环境切换) -->
    <view class="version-text" @click="handleVersionClick">
      {{ displayVersion }}
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { AuthService, type SavedAccount } from '@/services'
import { AppEnvType, getCurrentEnvType, getEnvDisplayName, trySwitchEnv } from '@/config/env-config'

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
const savedAccounts = ref<SavedAccount[]>([])
const showAccountsDropdown = ref(false)

// 环境切换与版本号连击触发
const appVersion = ref('v1.0.0')
const versionClickCount = ref(0)
let versionClickTimer: any = null

const displayVersion = computed(() => {
  const envName = getEnvDisplayName()
  return envName ? `${appVersion.value}\n${envName}` : appVersion.value
})

const toggleAccountsDropdown = () => {
  showAccountsDropdown.value = !showAccountsDropdown.value
}

const selectAccount = (item: SavedAccount) => {
  loginForm.account = item.account
  loginForm.password = item.password
  showAccountsDropdown.value = false
  validateAccount()
  validatePassword()
}

const deleteSavedAccount = (account: string) => {
  savedAccounts.value = AuthService.deleteSavedAccount(account)
}

// 点击版本号 5 次触发环境切换
const handleVersionClick = () => {
  versionClickCount.value++
  if (versionClickTimer) clearTimeout(versionClickTimer)

  versionClickTimer = setTimeout(() => {
    versionClickCount.value = 0
  }, 2000)

  if (versionClickCount.value >= 5) {
    versionClickCount.value = 0
    triggerEnvSwitch()
  }
}

// 触发环境切换弹窗逻辑
const triggerEnvSwitch = () => {
  const currentEnvType = getCurrentEnvType()
  const targetEnv = currentEnvType === AppEnvType.RELEASE 
    ? AppEnvType.INTERNAL_TEST 
    : AppEnvType.RELEASE
  
  const targetEnvName = targetEnv === AppEnvType.RELEASE ? '正式环境' : '测试环境'

  if (targetEnv === AppEnvType.INTERNAL_TEST) {
    // 切换到测试环境需输入暗号密码 985211
    uni.showModal({
      title: '切换到测试环境',
      content: `确认切换到${targetEnvName}？`,
      editable: true,
      placeholderText: '请输入密码 (985211)',
      success: (res) => {
        if (res.confirm) {
          const success = trySwitchEnv(targetEnv, res.content)
          if (success) {
            uni.showToast({ title: '已切换到测试环境', icon: 'success' })
            setTimeout(() => {
              // #ifdef H5
              window.location.reload()
              // #endif
              // #ifndef H5
              uni.reLaunch({ url: '/pages/login/login' })
              // #endif
            }, 1000)
          } else {
            uni.showToast({ title: '密码错误，切换失败', icon: 'none' })
          }
        }
      }
    })
  } else {
    // 切换回正式环境不需要密码
    uni.showModal({
      title: '切换到正式环境',
      content: `确认切换到${targetEnvName}？`,
      success: (res) => {
        if (res.confirm) {
          trySwitchEnv(targetEnv)
          uni.showToast({ title: '已切换到正式环境', icon: 'success' })
          setTimeout(() => {
            // #ifdef H5
            window.location.reload()
            // #endif
            // #ifndef H5
            uni.reLaunch({ url: '/pages/login/login' })
            // #endif
          }, 1000)
        }
      }
    })
  }
}

onMounted(() => {
  const initialState = AuthService.getInitialLoginState()
  loginForm.account = initialState.account
  loginForm.password = initialState.password
  savedAccounts.value = initialState.savedAccounts
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

const handleLogin = async () => {
  errorMessage.value = ''
  if (!validateAccount() || !validatePassword()) return

  isLoading.value = true

  try {
    await AuthService.login({
      account: loginForm.account,
      password: loginForm.password
    })

    uni.showToast({ title: '登录成功', icon: 'success' })

    uni.reLaunch({
      url: '/pages/index/index'
    })
  } catch (error: any) {
    errorMessage.value = error?.message || '登录失败，请检查网络'
  } finally {
    isLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  width: 100vw;
  height: 100vh;
  background-color: #4f46e5;
  background-linear-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  box-sizing: border-box;
}

.login-form-container {
  width: 85%;
  max-width: 600rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 40rpx 30rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.15);
}

.login-form-card {
  width: 100%;
}

.user-id-input-wrapper,
.password-input-wrapper {
  width: 100%;
  margin-bottom: 24rpx;
}

.login-input-container {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 80rpx;
  background-color: #f3f4f6;
  border-radius: 16rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  
  &.has-error {
    border: 1px solid #ff4d4f;
  }
}

.input-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.login-input {
  flex: 1;
  height: 100%;
  font-size: 28rpx;
  color: #333;
}

.account-dropdown-arrow {
  font-size: 20rpx;
  color: #888;
  padding: 10rpx;
}

.accounts-dropdown-list {
  position: absolute;
  top: 90rpx;
  left: 0;
  right: 0;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16rpx;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.1);
  max-height: 300rpx;
  z-index: 999;
}

.accounts-dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 20rpx;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.account-name {
  font-size: 28rpx;
  color: #333;
}

.delete-account-btn {
  font-size: 24rpx;
  color: #999;
  padding: 10rpx;
}

.input-error {
  margin-top: 6rpx;
  color: #ff4d4f;
  font-size: 24rpx;
}

.login-button {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  margin-top: 30rpx;
  background-color: #6e55ff;
  color: #ffffff;
  border-radius: 16rpx;
  font-size: 32rpx;
  font-weight: 500;
  text-align: center;

  &[disabled] {
    opacity: 0.6;
  }
}

.error-banner {
  margin-top: 20px;
  color: #ff4d4f;
  font-size: 26rpx;
  text-align: center;
}

.version-text {
  position: absolute;
  bottom: 40rpx;
  color: rgba(255, 255, 255, 0.8);
  font-size: 24rpx;
  text-align: center;
  white-space: pre-line;
}
</style>

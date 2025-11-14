<template>
  <div class="login-page">
    <!-- 登录表单容器 -->
    <div class="login-form-container">
      <div class="login-form-card">
        <div class="login-form-section">
          <form @submit.prevent="handleLogin" class="login-form">
            <!-- 用户名输入框 -->
            <div class="user-id-input-wrapper">
              <div class="login-input-container" :class="{ 'has-error': !!errors.account }">
                <img :src="usernameIcon" alt="username" class="username-icon">
                <input
                  v-model="loginForm.account"
                  type="text"
                  placeholder="请输入账号"
                  class="login-input"
                  @blur="validateAccount"
                />
              </div>
              <div v-if="errors.account" class="input-error">{{ errors.account }}</div>
            </div>

            <!-- 密码输入框 -->
            <div class="password-input-wrapper">
              <div class="login-input-container" :class="{ 'has-error': !!errors.password }">
                <img :src="passwordIcon" alt="password" class="password-icon">
                <input
                  v-model="loginForm.password"
                  type="password"
                  placeholder="请输入密码"
                  class="login-input"
                  @blur="validatePassword"
                />
              </div>
              <div v-if="errors.password" class="input-error">{{ errors.password }}</div>
            </div>

            <!-- 登录按钮 -->
            <button
              type="submit"
              class="login-button"
              :disabled="!isFormValid || isLoading"
            >
              <span v-if="isLoading" class="button-loading">
                <span class="spinner"></span>
                <span>登录中...</span>
              </span>
              <span v-else>登 录</span>
            </button>

            <!-- 错误提示 -->
            <div v-if="errorMessage" class="error-banner">
              {{ errorMessage }}
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 版本号显示 -->
    <div class="version-text" @click="handleVersionClick">
      {{ appVersion }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiService } from '../services/api-service'
import { getUserId, getPassword } from '../services/auth-storage-service'

import usernameIcon from '/icons/username_icon.svg'
import passwordIcon from '/icons/password_icon.svg'

const router = useRouter()

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
const appVersion = ref('')

// 第1步：页面加载时从统一存储读取已保存的账号密码
onMounted(() => {
  // 第2步：获取保存的账号（从统一存储）
  const savedUserId = getUserId()
  // 第3步：获取保存的密码（从统一存储）
  const savedPassword = getPassword()
  
  // 第4步：如果账号密码都存在且有效，则自动填充表单
  if (savedUserId && savedPassword && 
      savedUserId !== 'undefined' && savedPassword !== 'undefined' &&
      savedUserId.trim() !== '' && savedPassword.trim() !== '') {
    loginForm.account = savedUserId
    loginForm.password = savedPassword
  }

  // 设置版本号（可以从package.json或环境变量获取）
  appVersion.value = '1.0.0'

  // 重置点击计数（每2秒重置一次）
  setInterval(() => {
    versionClickCount.value = 0
  }, 2000)
  
  // 第5步：监听Android原生日志
  // 保存原有的回调（如果存在，可能是App.vue中设置的）
  const previousCallback = window.onAndroidLog
  window.onAndroidLog = (level: string, tag: string, message: string) => {
    // 第1步：如果有原有回调，先调用它（保持App.vue中的全局日志功能）
    if (previousCallback) {
      previousCallback(level, tag, message)
    }
    
    // 第2步：在LoginView中打印日志
    const logMessage = `[Android-${tag}] ${message}`
    
    switch (level.toUpperCase()) {
      case 'DEBUG':
        break
      case 'INFO':
        break
      case 'WARN':
        console.warn(`[LoginView] ⚠️ ${logMessage}`)
        break
      case 'ERROR':
        console.error(`[LoginView] ❌ ${logMessage}`)
        break
      default:
        break
    }
  }
})

const isFormValid = computed(() => {
  return loginForm.account.trim() && loginForm.password.trim()
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

const handleVersionClick = () => {
  versionClickCount.value++
  if (versionClickCount.value >= 5) {
    versionClickCount.value = 0
    // TODO: 实现环境切换功能（如果需要）
  }
}

const handleLogin = async () => {
  // 清除之前的错误信息
  errorMessage.value = ''
  
  // 验证表单
  const isAccountValid = validateAccount()
  const isPasswordValid = validatePassword()
  
  if (!isAccountValid || !isPasswordValid) {
    return
  }
  
  isLoading.value = true
  
  try {
    // 第1步：直接发送明文密码，与Android端LoginActivity保持一致
    // loginXueban内部已自动保存token和用户凭据到localStorage
    const token = await apiService.loginXueban(loginForm.account, loginForm.password)

    // 第2步：获取用户信息
    // getUserInfo内部已自动完成：
    // - 持久化到localStorage
    // - 同步到Android原生ViewModel
    await apiService.getUserInfo(token)
    
    // 第3步：跳转到首页（使用 replace 避免登录页留在历史记录中）
    router.replace('/app')
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '登录失败，请检查网络连接'
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
  background-image: url('/images/login_bg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  overflow: hidden;
}

.login-form-container {
  position: absolute;
  width: 33vw;
  height: 70vh;
  /* horizontal_bias="0.9" 意味着偏向右侧90% */
  /* 使用right定位，容器右边缘距离屏幕右边缘约5% */
  right: calc((100vw - 33vw) * 0.1);
  top: 50%;
  transform: translateY(-50%);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-form-card {
  width: 100%;
  background: transparent;
  box-shadow: none;
}

.login-form-section {
  padding: 0;
  margin-top: 46px;
}

.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 80px;
  box-sizing: border-box;
  position: relative;
}

.user-id-input-wrapper {
  width: 100%;
  margin-bottom: 10px;
}

.password-input-wrapper {
  width: 100%;
  margin-bottom: 10px;
}

.login-input-container {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 40px;
  background-color: #FFFFFF;
  border-radius: 12px;
  padding: 0 12px;
  box-sizing: border-box;
}

.username-icon {
  width: 20px;
  height: 20px;
}

.password-icon {
  width: 20px;
  height: 20px;
}

.login-input-container.has-error {
  border: 1px solid #FF0000;
}

.login-input {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: #000000;
  font-size: 0.9rem;
  padding: 0;
  margin-left: 8px;
}

.login-input::placeholder {
  color: #AAAAAA;
}

/* 输入框图标样式 */
.input-icon {
  color: #666666;
  font-size: 20px;
  user-select: none;
  flex-shrink: 0;
}

/* 错误提示样式 */
.input-error {
  padding-top: 4px;
  padding-left: 4px;
  color: #FF0000;
  font-size: 16px;
  min-height: 20px;
}

.login-button {
  width: 100%;
  min-height: 40px;
  margin-top: 20px;
  background-color: #6e55ff;
  border: none;
  color: #FFFFFF;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 500;
  box-sizing: border-box;
  cursor: pointer;
  transition: opacity 0.2s;
}

.login-button:hover:not(:disabled) {
  opacity: 0.9;
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
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
  position: absolute;
  bottom: -45px;
  left: 80px;
  right: 80px;
  padding: 12px;
  border-radius: 8px;
  color: #ff0000b5;
  font-size: 14px;
  text-align: center;
  z-index: 10;
}

.version-text {
  position: absolute;
  bottom: 16px;
  right: 16px;
  color: #ffffff;
  font-size: 14px;
  text-align: center;
  cursor: pointer;
  white-space: pre-line;
  user-select: none;
}

.version-text:hover {
  opacity: 0.8;
}

/* 响应式适配 */
@media (max-width: 1200px) {
  .login-form-container {
    width: 40vw;
    right: 5%;
  }
}

@media (max-width: 768px) {
  .login-form-container {
    width: 90vw;
    height: auto;
    min-height: 60vh;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .login-form {
    padding: 40px 20px;
  }

  .input-wrapper:first-child {
    margin-top: 40px;
  }
}
</style>

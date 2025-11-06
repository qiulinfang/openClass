<template>
  <div class="login-page">
    <!-- 登录表单容器 -->
    <div class="login-form-container">
      <form @submit.prevent="handleLogin" class="login-form">
        <!-- 用户名输入框 -->
        <div class="input-wrapper">
          <div class="input-container">
            <img :src="loginUserIdIconUrl" alt="用户名" class="input-icon" />
            <input
              v-model="loginForm.account"
              type="text"
              class="login-input"
              placeholder="请输入账号"
              @blur="validateAccount"
            />
          </div>
          <div v-if="errors.account" class="error-message">{{ errors.account }}</div>
        </div>

        <!-- 密码输入框 -->
        <div class="input-wrapper">
          <div class="input-container">
            <img :src="loginPasswordIconUrl" alt="密码" class="input-icon" />
            <input
              v-model="loginForm.password"
              type="password"
              class="login-input"
              placeholder="请输入密码"
              @blur="validatePassword"
            />
          </div>
          <div v-if="errors.password" class="error-message">{{ errors.password }}</div>
        </div>

        <!-- 登录按钮 -->
        <button type="submit" class="login-button" :disabled="!isFormValid || isLoading">
          {{ isLoading ? '登录中...' : '登 录' }}
        </button>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="error-banner">
          {{ errorMessage }}
        </div>
      </form>
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

// 第1步：导入登录图标图片作为模块资源，确保在webview场景下能正常加载
// 使用import方式导入，Vite会在构建时处理这些资源并生成正确的路径
import loginUserIdIconUrl from '@/assets/images/login_user_id_ico.png'
import loginPasswordIconUrl from '@/assets/images/login_password_ico.png'

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

// 第1步：页面加载时从localStorage读取已保存的账号密码
onMounted(() => {
  // 第2步：获取保存的账号
  const savedUserId = localStorage.getItem('userId')
  // 第3步：获取保存的密码
  const savedPassword = localStorage.getItem('userPassword')
  
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
        console.log(`[LoginView] 🔍 ${logMessage}`)
        break
      case 'INFO':
        console.log(`[LoginView] ℹ️ ${logMessage}`)
        break
      case 'WARN':
        console.warn(`[LoginView] ⚠️ ${logMessage}`)
        break
      case 'ERROR':
        console.error(`[LoginView] ❌ ${logMessage}`)
        break
      default:
        console.log(`[LoginView] 📝 ${logMessage}`)
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
    console.log('环境切换功能待实现')
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
    
    // 第3步：跳转到首页
    router.push('/app')
    
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
  background-image: url('/images/login_user_info_bg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 80px;
  box-sizing: border-box;
}

.input-wrapper {
  width: 100%;
  margin-bottom: 20px;
}

.input-wrapper:first-child {
  margin-top: 80px;
}

.input-container {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  width: 20px;
  height: 20px;
  z-index: 1;
  pointer-events: none;
}

.login-input {
  width: 100%;
  height: 50px;
  padding: 12px 12px 12px 40px;
  box-sizing: border-box;
  background-color: rgba(255, 255, 255, 0.5);
  border: 1px solid #555555;
  border-radius: 8px;
  color: #000000;
  font-size: 16px;
  outline: none;
}

.login-input::placeholder {
  color: #AAAAAA;
}

.login-input:focus {
  border-color: #667eea;
}

.error-message {
  color: #FF0000;
  font-size: 16px;
  margin-top: 4px;
  padding-left: 4px;
}

.login-button {
  width: 100%;
  height: auto;
  min-height: 50px;
  margin-top: 20px;
  background-image: url('/images/login_button_bg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border: none;
  color: #FFFFFF;
  border-radius: 23px;
  font-size: 27px;
  cursor: pointer;
  padding: 12px 0;
  box-sizing: border-box;
  outline: none;
}

.login-button:hover:not(:disabled) {
  opacity: 0.9;
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}


@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-banner {
  margin-top: 20px;
  padding: 12px;
  background-color: rgba(255, 0, 0, 0.1);
  border: 1px solid #FF0000;
  border-radius: 8px;
  color: #FF0000;
  font-size: 14px;
  text-align: center;
}

.version-text {
  position: absolute;
  bottom: 16px;
  right: 16px;
  color: #000000;
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

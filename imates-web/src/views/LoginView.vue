<template>
  <div class="login-page">
    <!-- 登录表单容器 -->
    <div class="login-form-container">
      <div class="login-form-card">
        <div class="login-form-section">
          <form @submit.prevent="handleLogin" class="login-form">
            <!-- 学校选择框 -->
            <div class="school-select-wrapper">
              <img :src="schoolIcon" alt="school" class="school-icon">
              <Select
                v-model="selectedSchool"
                :options="schoolOptions"
                placeholder="请选择学校"
                class="school-select-component"
              />
            </div>

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
      {{ displayVersion }}
    </div>

    <!-- 环境切换对话框 -->
    <Dialog
      ref="envSwitchDialog"
      :title="dialogConfig.title"
      :confirmButtonText="dialogConfig.confirmText"
      :cancelButtonText="dialogConfig.cancelText"
      @confirm="handleEnvSwitchConfirm"
      @cancel="cancelEnvSwitchDialog"
    >
      <div class="env-switch-content">
        <p>{{ dialogConfig.message }}</p>
        <input
          v-if="dialogConfig.needPassword"
          v-model="envSwitchPassword"
          type="password"
          placeholder="请输入密码"
          class="env-password-input"
          @keyup.enter="handleEnvSwitchConfirm"
        />
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { authService, getUserId, getPassword, httpClient } from '../services'
import { AppEnvType, getCurrentEnvType, getEnvDisplayName, trySwitchEnv, getAppUpdateUrl } from '../config/env-config'
import Dialog from '../components/base/Dialog.vue'
import Select from '@/components/base/Select.vue'
import { ZGC_JUMP_QUERY, SDSF_JUMP_QUERY, JK_JUMP_QUERY } from '@/constants/jump-configs'
import { resourceManager } from '@/services/storage/resource-storage'
import { chatStorage } from '../services/storage/chat-storage'
import type { AiGeneralSession } from '../types'

import usernameIcon from '/icons/username_icon.svg'
import passwordIcon from '/icons/password_icon.svg'
import schoolIcon from '/icons/school.svg'
import classIcon from '/icons/class.png'

const router = useRouter()

const virtualTextbookId = `${getUserId()}_35943sdfsf0640`
const virtualTextbookIdSdsf = `${getUserId()}_35943sdsf0640`

// 学校选择
const selectedSchool = ref<'zgc' | 'jk' | 'sdsf'>((localStorage.getItem('selected_school') as 'zgc' | 'jk' | 'sdsf') || 'zgc')

// 学校选项
const schoolOptions = [
  { label: '中关村一小', value: 'zgc' },
  { label: '经开二中', value: 'jk' },
  { label: '首都师范大学实验小学', value: 'sdsf' }
]

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

// 从 localStorage 读取版本号
const loadAppVersion = (): string => {
  try {
    const savedVersion = localStorage.getItem(APP_VERSION_STORAGE_KEY)
    return savedVersion || '1.0.0'
  } catch (error) {
    console.error('[LoginView] 读取版本号失败:', error)
    return '1.0.0'
  }
}

const ensureAiGeneralSession = async (userId: string) => {
  try {
    if (!userId || userId === 'undefined' || userId.trim() === '') return

    const generalSessions = await chatStorage.loadGeneralSessions()
    if (generalSessions && generalSessions.length > 0) {
      return
    }

    const rand = Math.random().toString(16).slice(2, 6)
    const sessionId = `${userId}-general-session-${Date.now()}-${rand}`
    const newSession: AiGeneralSession = {
      sessionId,
      sessionName: `AI通用会话-${rand}`,
      createTime: Date.now(),
      updateTime: Date.now(),
      msgCount: 0,
      pinned: true,
    }
    await chatStorage.saveGeneralSessions([newSession])
    console.log('[LoginView] ai-general 会话列表为空，已创建随机会话:', { sessionId })
  } catch (error) {
    console.warn('[LoginView] ensureAiGeneralSession 失败:', error)
  }
}

// 保存版本号到 localStorage
const saveAppVersion = (version: string): void => {
  try {
    localStorage.setItem(APP_VERSION_STORAGE_KEY, version)
    console.log('[LoginView] 版本号已保存到 localStorage:', version)
  } catch (error) {
    console.error('[LoginView] 保存版本号失败:', error)
  }
}

// Web 端主动检查应用更新并同步服务器版本号
const checkAppUpdate = async () => {
  try {
    const url = getAppUpdateUrl()
    const cacheBustedUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
    const response = await httpClient.get<any>(cacheBustedUrl)
    const result = response?.data ?? response
    if (!result) {
      console.log("端主动检查应用更新无结果");
      return
    }
    console.log("端主动检查应用更新并同步服务器版本号",result)
    const serverVersion = (result as any).versionName || (result as any).VersionName || ''
    if (serverVersion && typeof serverVersion === 'string') {
      appVersion.value = serverVersion
      saveAppVersion(serverVersion)
      console.log('[LoginView] Web 端检查更新成功，服务器版本号:', serverVersion)
    }
  } catch (error) {
    console.warn('[LoginView] Web 端检查更新失败:', error)
  }
}

// 页面加载时从统一存储读取已保存的账号密码
onMounted(async () => {
  // 获取保存的账号（从统一存储）
  const savedUserId = getUserId()
  // 获取保存的密码（从统一存储）
  const savedPassword = getPassword()
  
  // 如果账号密码都存在且有效，则自动填充表单
  if (savedUserId && savedPassword && 
      savedUserId !== 'undefined' && savedPassword !== 'undefined' &&
      savedUserId.trim() !== '' && savedPassword.trim() !== '') {
    loginForm.account = savedUserId
    loginForm.password = savedPassword
  }

  // 从 localStorage 加载已保存的版本号
  appVersion.value = loadAppVersion()
  console.log('[LoginView] 从 localStorage 加载版本号:', appVersion.value)

  try {
    await ensureAiGeneralSession(savedUserId || '')
  } catch (error) {
    console.warn('[LoginView] 写入 ai-general 会话列表失败:', error)
  }

  // Web 端主动调用更新接口检查服务器版本号
  await checkAppUpdate()
  
  // 监听Android原生日志
  // 保存原有的回调（如果存在，可能是App.vue中设置的）
  const previousCallback = window.onAndroidLog
  window.onAndroidLog = (level: string, tag: string, message: string) => {
    // 如果有原有回调，先调用它（保持App.vue中的全局日志功能）
    if (previousCallback) {
      previousCallback(level, tag, message)
    }
    
    // 在LoginView中打印日志
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
  
  // 清除之前的定时器
  if (versionClickTimer.value) {
    clearTimeout(versionClickTimer.value)
  }
  
  // 2秒后重置点击计数
  versionClickTimer.value = window.setTimeout(() => {
    versionClickCount.value = 0
  }, 2000)
  
  // 点击5次触发环境切换
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
  
  // 配置对话框
  if (targetEnv === AppEnvType.INTERNAL_TEST) {
    // 切换到测试环境需要密码
    dialogConfig.title = '切换到测试环境'
    dialogConfig.message = `确认切换到${targetEnvName}？`
    dialogConfig.needPassword = true
    dialogConfig.confirmText = '确认切换'
    envSwitchPassword.value = ''
  } else {
    // 切换回正式环境不需要密码
    dialogConfig.title = '切换到正式环境'
    dialogConfig.message = `确认切换到${targetEnvName}？`
    dialogConfig.needPassword = false
    dialogConfig.confirmText = '确认切换'
  }
  
  // 打开对话框
  envSwitchDialog.value?.openDialog()
}

// 处理环境切换确认
const handleEnvSwitchConfirm = () => {
  const targetEnv = targetEnvType.value
  const targetEnvName = targetEnv === AppEnvType.RELEASE ? '正式环境' : '测试环境'
  
  // 如果需要密码验证
  if (dialogConfig.needPassword) {
    const password = envSwitchPassword.value
    const success = trySwitchEnv(targetEnv, password)
    if (success) {
      currentEnv.value = targetEnv
      window.location.reload()
    } else {
      errorMessage.value = '密码错误，切换失败'
      setTimeout(() => {
        errorMessage.value = ''
      }, 3000)
    }
  } else {
    // 不需要密码，直接切换
    trySwitchEnv(targetEnv)
    currentEnv.value = targetEnv
    window.location.reload()
  }
}

// 取消环境切换对话框，重置临时状态
const cancelEnvSwitchDialog = () => {
  dialogConfig.needPassword = false
  envSwitchPassword.value = ''
  envSwitchDialog.value?.closeDialog()
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
    const token = await authService.loginXueban(loginForm.account, loginForm.password)

    await authService.getUserInfo(token)

    await ensureAiGeneralSession(getUserId() || loginForm.account)

    // 持久化保存选择的学校
    localStorage.setItem('selected_school', selectedSchool.value)

    // 根据学校选择跳转到不同的页面
    if (selectedSchool.value === 'jk') {
      // 经开二中
      await router.replace({
        name: 'pdfViewerJk',
        query: {
          ...JK_JUMP_QUERY,
          isImage: 'true',
          imageMimeType: 'image/png',
          imageFileName: 'class.png',
        },
      })
    } else if (selectedSchool.value === 'sdsf') {
      // 首都师范
      await router.replace({
        name: 'pdfViewerSdsf',
        query: {
          ...SDSF_JUMP_QUERY,
          isImage: 'true',
          imageMimeType: 'image/png',
          imageFileName: 'class.png',
          openMiniClass: 'true',
        },
      })
    } else {
      // 中关村一小
      await router.replace({
        name: 'pdfViewerZgc',
        query: {
          ...ZGC_JUMP_QUERY,
          isImage: 'true',
          imageMimeType: 'image/png',
          imageFileName: 'class.png',
        },
      })
    }
    
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

.school-select-wrapper {
  width: 100%;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  background-color: #FFFFFF;
  border-radius: 12px;
  padding: 0 12px;
  box-sizing: border-box;
  height: 40px;
}

.school-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.school-select-component {
  flex: 1;
  margin-left: 8px;
}

/* 覆盖 Select 组件的默认样式以适配登录表单 */
.school-select-component :deep(.select-trigger) {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0;
}

.school-select-component :deep(.select-label) {
  color: #000000;
  font-size: 0.9rem;
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

/* 环境切换对话框样式 */
.env-switch-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.env-switch-content p {
  margin: 0;
  color: #4b5563;
  font-size: 15px;
}

.env-password-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.env-password-input:focus {
  border-color: #6e55ff;
  box-shadow: 0 0 0 3px rgba(110, 85, 255, 0.1);
}

.env-password-input::placeholder {
  color: #9ca3af;
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

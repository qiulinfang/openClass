<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="login-page">
        <div class="login-container">
          <q-card class="login-card" flat>
            <q-card-section class="login-header">
                <div class="text-center">
                <div class="app-logo">
                  <q-icon name="school" size="4rem" color="white" class="q-mb-md" />
                </div>
                <div class="text-h4 text-weight-bold text-white q-mb-sm">研伴学习助手</div>
                <div class="text-subtitle1 text-white text-opacity-80">请输入您的账号和密码开始学习之旅</div>
              </div>
            </q-card-section>
            
            <q-card-section>
              <q-form @submit.prevent="handleLogin" class="login-form">
                <div class="q-mb-lg">
                  <q-input
                    v-model="loginForm.account"
                    label="账号"
                    outlined
                    :error="!!errors.account"
                    :error-message="errors.account"
                    placeholder="请输入账号"
                    @blur="validateAccount"
                    :rules="[val => !!val || '请输入账号']"
                    class="q-mb-sm"
                  >
                    <template v-slot:prepend>
                      <q-icon name="person" />
                    </template>
                  </q-input>
                </div>
                
                <div class="q-mb-lg">
                  <q-input
                    v-model="loginForm.password"
                    label="密码"
                    type="password"
                    outlined
                    :error="!!errors.password"
                    :error-message="errors.password"
                    placeholder="请输入密码"
                    @blur="validatePassword"
                    :rules="[val => !!val || '请输入密码']"
                    class="q-mb-sm"
                  >
                    <template v-slot:prepend>
                      <q-icon name="lock" />
                    </template>
                  </q-input>
                </div>
                
                <q-btn
                  type="submit"
                  label="登录"
                  color="primary"
                  size="lg"
                  class="full-width q-py-sm"
                  :loading="isLoading"
                  :disable="!isFormValid"
                  unelevated
                  rounded
                />
                
                <q-banner
                  v-if="errorMessage"
                  class="q-mt-md"
                  dense
                  type="negative"
                  rounded
                >
                  <template v-slot:avatar>
                    <q-icon name="error" />
                  </template>
                  {{ errorMessage }}
                </q-banner>
              </q-form>
            </q-card-section>
          </q-card>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { apiService } from '../services/api-service'

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
    // 直接发送明文密码，与Android端LoginActivity保持一致
    const token = await apiService.loginXueban(loginForm.account, loginForm.password)
    // 保存到本地存储
    localStorage.setItem('XUEBAN_TOKEN', token)
    localStorage.setItem('userId', loginForm.account)
    localStorage.setItem('userPassword', loginForm.password)

    // 获取用户信息
    const userInfo = await apiService.getUserInfo(token)
    localStorage.setItem('userInfo', JSON.stringify(userInfo))
    
    // 跳转到首页
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
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.login-page::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(180deg); }
}

.login-container {
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
}

.login-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.login-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2.5rem 2rem;
  position: relative;
}

.login-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 20px;
  background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.1));
}

.app-logo {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.login-form {
  padding: 2rem;
}
</style>
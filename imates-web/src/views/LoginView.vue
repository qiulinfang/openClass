<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="login-page">
        <div class="login-container">
          <q-card class="login-card" flat>
            <q-card-section class="login-header">
              <div class="text-center">
                <q-icon name="school" size="4rem" color="primary" class="q-mb-md" />
                <div class="text-h4 text-weight-bold text-primary q-mb-sm">研伴登录</div>
                <div class="text-subtitle1 text-grey-7">请输入您的账号和密码</div>
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
    const token = await apiService.login(loginForm.account, loginForm.password)
    
    // 获取用户信息
    const userInfo = await apiService.getUserInfo(token)
    
    // 保存到本地存储
    localStorage.setItem('token', token)
    localStorage.setItem('userInfo', JSON.stringify(userInfo))
    localStorage.setItem('userId', loginForm.account)
    localStorage.setItem('userPassword', loginForm.password)
    
    // 跳转到知识图谱页面
    router.push('/knowledge-graph')
    
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
}

.login-container {
  width: 100%;
  max-width: 400px;
}

.login-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.login-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
}

.login-form {
  padding: 0;
}
</style>
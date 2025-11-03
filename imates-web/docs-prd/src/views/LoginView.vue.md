# LoginView.vue PRD 文档

## 📋 概述

**文件路径**：`src/views/LoginView.vue`  
**文件类型**：`Vue 组件`  
**主要职责**：用户登录页面，处理用户认证和账号密码管理

## 🎯 功能需求

### 1. 核心功能
- **用户登录**：通过账号密码登录系统
- **表单验证**：验证账号和密码是否填写
- **自动填充**：页面加载时自动填充已保存的账号密码
- **错误提示**：显示登录失败的错误信息
- **加载状态**：显示登录过程中的加载状态

### 2. 功能边界
- **负责的功能**：
  - 登录表单展示和验证
  - 调用登录 API
  - 自动填充已保存的账号密码
  - 错误信息展示
- **不负责的功能**：
  - API 调用逻辑（由 api-service 负责）
  - 用户信息持久化（由 userStore 负责）
  - 路由跳转（由 router 负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { ref, reactive, computed, onMounted } from 'vue'
  import { useRouter } from 'vue-router'
  import { apiService } from '../services/api-service'
  ```
- **被依赖**：
  - `src/router/index.ts`：路由配置中使用

### 2. 关键代码逻辑

#### 登录流程
```typescript
const handleLogin = async () => {
  // 第1步：清除之前的错误信息
  errorMessage.value = ''
  
  // 第2步：验证表单
  const isAccountValid = validateAccount()
  const isPasswordValid = validatePassword()
  
  if (!isAccountValid || !isPasswordValid) {
    return
  }
  
  // 第3步：设置加载状态
  isLoading.value = true
  
  try {
    // 第4步：调用登录API（内部自动保存token和用户凭据）
    const token = await apiService.loginXueban(loginForm.account, loginForm.password)
    
    // 第5步：获取用户信息（内部自动持久化和同步到Android）
    await apiService.getUserInfo(token)
    
    // 第6步：跳转到首页
    router.push('/app')
  } catch (error: unknown) {
    // 第7步：显示错误信息
    const message = error instanceof Error ? error.message : '登录失败，请检查网络连接'
    errorMessage.value = message
  } finally {
    // 第8步：清除加载状态
    isLoading.value = false
  }
}
```

#### 自动填充逻辑
```typescript
onMounted(() => {
  // 第1步：获取保存的账号
  const savedUserId = localStorage.getItem('userId')
  // 第2步：获取保存的密码
  const savedPassword = localStorage.getItem('userPassword')
  
  // 第3步：如果账号密码都存在且有效，则自动填充表单
  if (savedUserId && savedPassword && 
      savedUserId !== 'undefined' && savedPassword !== 'undefined' &&
      savedUserId.trim() !== '' && savedPassword.trim() !== '') {
    loginForm.account = savedUserId
    loginForm.password = savedPassword
  }
})
```

### 3. 表单验证
- **账号验证**：检查是否为空
- **密码验证**：检查是否为空
- **表单验证状态**：使用 `isFormValid` 计算属性控制登录按钮状态

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：Vue 3 + Quasar 组件
- **React Native 实现**：React + React Native Paper 组件

### 2. 需要的第三方库
- `react-native-paper`：UI 组件库（Button, TextInput, Card）
- `@react-navigation/native`：导航库（已在基础设施中安装）

### 3. 迁移步骤
1. **创建 LoginScreen 组件**：
   - 使用 `React.FC` 创建函数组件
   - 使用 `useState` 管理表单状态和错误信息
   - 使用 `useEffect` 处理自动填充逻辑

2. **实现表单验证**：
   - 使用 `useState` 管理验证错误
   - 创建验证函数 `validateAccount` 和 `validatePassword`

3. **实现登录逻辑**：
   - 创建 `handleLogin` 异步函数
   - 调用 API Service 的 `loginXueban` 方法
   - 调用 API Service 的 `getUserInfo` 方法
   - 使用 React Navigation 跳转到主应用

4. **处理自动填充**：
   - 使用 `useEffect` 在组件挂载时读取 AsyncStorage
   - 自动填充账号密码到表单

5. **样式适配**：
   - 使用 `StyleSheet.create` 创建样式
   - 使用 `LinearGradient` 实现渐变背景（需要 `react-native-linear-gradient`）

### 4. 注意事项
- **AsyncStorage 异步操作**：所有存储操作都是异步的，需要使用 `await`
- **导航跳转**：使用 React Navigation 的 `navigation.navigate` 方法
- **错误处理**：需要处理网络错误和 API 错误
- **加载状态**：使用 `ActivityIndicator` 显示加载状态

## 📝 迁移代码示例

### Vue 实现
```vue
<template>
  <q-page class="login-page">
    <q-card class="login-card" flat>
      <q-form @submit.prevent="handleLogin">
        <q-input v-model="loginForm.account" label="账号" />
        <q-input v-model="loginForm.password" label="密码" type="password" />
        <q-btn type="submit" label="登录" :loading="isLoading" />
      </q-form>
    </q-card>
  </q-page>
</template>
```

### React Native 实现
```typescript
import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { TextInput, Button, Card, ActivityIndicator } from 'react-native-paper'
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

  // 自动填充
  useEffect(() => {
    const loadSavedCredentials = async () => {
      const savedUserId = await StorageService.getItem<string>(StorageKeys.USER_ID)
      const savedPassword = await StorageService.getItem<string>(StorageKeys.USER_PASSWORD)
      
      if (savedUserId && savedPassword) {
        setAccount(savedUserId)
        setPassword(savedPassword)
      }
    }
    loadSavedCredentials()
  }, [])

  const handleLogin = async () => {
    // 验证表单
    if (!validateForm()) return

    setIsLoading(true)
    try {
      const token = await apiService.loginXueban(account, password)
      const userInfo = await apiService.getUserInfo(token)
      setUserInfo(userInfo)
      navigation.navigate('Main' as never)
    } catch (error) {
      Alert.alert('登录失败', error instanceof Error ? error.message : '请检查网络连接')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <TextInput label="账号" value={account} onChangeText={setAccount} />
        <TextInput label="密码" value={password} onChangeText={setPassword} secureTextEntry />
        <Button mode="contained" onPress={handleLogin} loading={isLoading}>
          登录
        </Button>
      </Card>
    </View>
  )
}
```

## ⚠️ 迁移风险

### 高风险项
- **自动填充逻辑**：AsyncStorage 是异步的，需要正确处理时序 - **解决方案**：使用 `useEffect` 和 `async/await`
- **样式适配**：渐变背景需要使用第三方库 - **解决方案**：使用 `react-native-linear-gradient` 或简化背景样式
- **错误提示**：React Native 没有 `q-banner` 组件 - **解决方案**：使用 `Alert` 或自定义提示组件

## 🧪 测试要点

### 功能测试
- 测试正常登录流程
- 测试账号密码自动填充
- 测试表单验证
- 测试错误提示显示
- 测试加载状态显示
- 测试网络错误处理

## 📚 参考资源

- [React Native Paper 文档](https://callstack.github.io/react-native-paper/)
- [React Navigation 文档](https://reactnavigation.org/)
- [AsyncStorage 文档](https://react-native-async-storage.github.io/async-storage/)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队

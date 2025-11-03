# React Native 与原生通信说明

## 📖 快速回答：纯RN应用还需要桥接吗？

**答案**：**不需要！**

⚠️ **本项目被设计为纯RN应用，不需要桥接！**

纯RN应用可以直接使用：
- ✅ AsyncStorage 存储数据
- ✅ RN 的 Toast 或 Alert 显示提示
- ✅ RN 组件库实现功能
- ✅ HTTP 客户端调用 API

**只有在以下情况才需要桥接**：
- ❌ RN 嵌入到现有 Android 应用中
- ❌ 需要调用原生后台服务或系统 API
- ❌ 需要与原生 ViewModel 集成

### ✅ 本项目的设计：纯RN应用（不需要桥接）

本 RN 应用设计为：
- ✅ **完全独立**：不需要与原生代码交互
- ✅ **只使用 RN 内置能力**：AsyncStorage、Camera、网络请求等
- ✅ **不访问系统级功能**：不需要调用原生 API
- ✅ **不与原生应用集成**：不是嵌入到现有原生应用中

**示例**：
```typescript
// 纯RN应用，不需要桥接
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Camera } from 'react-native-camera'

// 直接使用 RN 的库，无需桥接
await AsyncStorage.setItem('token', token)
```

### ❌ 需要桥接的情况

即使看起来是"纯RN"应用，以下场景仍需要桥接：

#### 1. **与原生应用集成**
```typescript
// 场景：RN 嵌入到现有 Android 应用中
// 需要：将 RN 的状态同步到原生 ViewModel
await AndroidBridgeService.syncUserInfo(userId, token, password)
```

#### 2. **调用原生系统功能**
```typescript
// 场景：需要调用原生特有的功能
// 例如：原生后台服务、消息推送、系统通知
AndroidBridge.showNotification(message, 'info')
```

#### 3. **性能优化**
```typescript
// 场景：计算密集型任务需要原生层处理
// 例如：图像处理、加密解密、大数据计算
const result = await NativeImageProcessor.process(image)
```

#### 4. **访问 RN 库不支持的功能**
```typescript
// 场景：某些系统 API RN 库不支持
// 例如：特定的硬件功能、系统设置等
NativeSystemSettings.setBrightness(50)
```

### 🎯 本项目实现方式（纯RN应用）

本项目作为纯RN应用，**不使用桥接**，而是直接使用：

1. **数据存储**：使用 AsyncStorage
   ```typescript
   // 直接使用 AsyncStorage，不需要桥接
   await StorageService.setItem(StorageKeys.XUEBAN_TOKEN, token)
   await StorageService.setItem(StorageKeys.USER_ID, userId)
   ```

2. **用户提示**：使用 RN 的 Alert 或 Toast（如 react-native-toast-message）
   ```typescript
   // 使用 RN 库，不需要原生 Toast
   Alert.alert('提示', '登录成功')
   ```

3. **API 调用**：直接使用 HTTP 客户端
   ```typescript
   // 直接调用 API，不需要桥接
   const response = await httpClient.post(url, data)
   ```

**桥接代码保留**：
- `androidBridgeService.ts` 保留作为可选功能（已注释说明）
- 如果将来需要与原生应用集成，可以取消注释使用

### 📝 总结

| 应用类型 | 是否需要桥接 | 说明 |
|---------|------------|------|
| **纯独立RN应用** | ❌ **不需要** | 只使用 RN 库，不访问原生功能 |
| **RN嵌入原生应用** | ✅ **需要** | 需要与原生代码交互、状态同步 |
| **需要系统级功能** | ✅ **需要** | 调用原生 API、后台服务等 |
| **性能优化需求** | ✅ **可能需要** | 计算密集型任务可能需要原生层 |

**关键判断**：如果你只是：
- 使用 AsyncStorage 存储数据 ✅
- 调用 HTTP API ✅
- 使用 RN 组件库 ✅
- 不访问原生代码 ✅

那么**不需要桥接**，直接使用 RN 提供的 API 即可！

---

## 1. React Native 和原生的关系

### 1.1 架构关系

```
┌─────────────────────────────────────────────────┐
│           React Native 应用层                    │
│  ┌──────────────────────────────────────────┐   │
│  │  TypeScript/JavaScript 代码                │   │
│  │  - 业务逻辑                                │   │
│  │  - UI 组件                                │   │
│  │  - 状态管理                                │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                    ↕ (Bridge 桥接层)
┌─────────────────────────────────────────────────┐
│          原生层 (Android/iOS)                    │
│  ┌──────────────────────────────────────────┐   │
│  │  Java/Kotlin (Android) 或 Swift/OC (iOS) │   │
│  │  - 原生 UI 组件                           │   │
│  │  - 系统 API 调用                          │   │
│  │  - 本地存储                                │   │
│  │  - ViewModel (状态管理)                    │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 1.2 关系说明

1. **React Native 应用层**：
   - 使用 TypeScript/JavaScript 编写
   - 运行在 JavaScript 引擎中（Hermes/V8）
   - 负责业务逻辑和 UI 渲染

2. **原生层**：
   - Android: Java/Kotlin 代码
   - iOS: Swift/Objective-C 代码
   - 可以访问系统 API、硬件功能等

3. **Bridge 桥接层**：
   - 负责 React Native 和原生之间的通信
   - 通过 Native Modules 实现双向通信

### 1.3 为什么需要原生层？

1. **访问系统功能**：相机、相册、文件系统、网络等
2. **性能优化**：某些计算密集型任务
3. **平台特定功能**：推送通知、后台服务等
4. **状态共享**：与原生应用的其他部分共享数据（如 ViewModel）

## 2. 保存 Token 是什么意思？

### 2.1 Token 的作用

Token（令牌）是用户身份验证的凭证，类似于"身份证"：
- 登录成功后，服务器返回一个 token
- 后续 API 请求需要携带 token 证明身份
- Token 通常有过期时间

### 2.2 在 React Native 中保存 Token

保存 token 就是将 token **持久化存储**到设备的本地存储中：

```typescript
// 登录成功后，保存 token
await StorageService.setItem(StorageKeys.XUEBAN_TOKEN, token)
```

### 2.3 存储位置和方式

#### 方式 1: AsyncStorage（React Native 层面）

```typescript
// 文件: src/services/storageService.ts
// 使用 AsyncStorage 存储（类似浏览器的 localStorage）
await AsyncStorage.setItem('XUEBAN_TOKEN', token)

// 存储位置：
// Android: SharedPreferences 或 SQLite
// iOS: UserDefaults 或 SQLite
```

**特点**：
- ✅ 仅 React Native 应用可以访问
- ✅ 应用卸载后数据丢失
- ✅ 读取速度快
- ✅ 适合存储小量数据（token、用户信息等）

#### 方式 2: 原生存储（Android SharedPreferences）

```java
// 文件: AndroidBridgeModule.java
// 如果需要在原生层也保存，可以同步到原生
SharedPreferences prefs = getReactApplicationContext()
    .getSharedPreferences("UserPrefs", Context.MODE_PRIVATE);
prefs.edit().putString("XUEBAN_TOKEN", token).apply();
```

### 2.4 保存 Token 的完整流程

```
1. 用户输入账号密码
   ↓
2. 调用登录 API
   POST /admin/login
   ↓
3. 服务器返回 token
   { "token": "abc123..." }
   ↓
4. 保存 token 到 AsyncStorage ⭐
   await StorageService.setItem('XUEBAN_TOKEN', token)
   ↓
5. 后续请求自动携带 token
   HTTP Header: { "sa-token": "abc123..." }
```

### 2.5 代码示例

```typescript
// 文件: src/services/apiService.ts

async loginXueban(account: string, password: string): Promise<string> {
  // 1. 发送登录请求
  const response = await this.httpClient.post<LoginResponse>(url, {
    account,
    password,
  })

  const token = response.data.data.token

  // 2. 保存 token 到 AsyncStorage ⭐
  await StorageService.setItem(StorageKeys.XUEBAN_TOKEN, token)
  await StorageService.setItem(StorageKeys.USER_ID, account)
  await StorageService.setItem(StorageKeys.USER_PASSWORD, password)

  return token
}
```

## 3. 同步到原生是什么意思？

### 3.1 为什么需要同步到原生？

在我们的项目中，存在两个层面的状态：

1. **React Native 层面**：使用 AsyncStorage 存储 token
2. **原生层面**：使用 ViewModel/SharedPreferences 管理状态

如果原生代码（如后台服务、消息监听）需要访问 token，就必须**同步到原生**。

### 3.2 同步的含义

**同步**是指将 React Native 中的数据**传递**给原生层，让原生层也能访问和使用这些数据。

```
React Native 层                   原生层
┌─────────────┐                  ┌─────────────┐
│ AsyncStorage│  ──同步──→       │ ViewModel   │
│ token: "abc"│                  │ token: "abc"│
└─────────────┘                  └─────────────┘
```

### 3.3 同步的完整流程

```
1. React Native 保存 token
   AsyncStorage.setItem('XUEBAN_TOKEN', token)
   ↓
2. 调用 AndroidBridgeService.syncUserInfo() ⭐
   AndroidBridgeService.syncUserInfo(userId, token, password)
   ↓
3. 通过 Bridge 传递给原生
   NativeModules.AndroidBridge.syncUserInfo(...)
   ↓
4. 原生层接收并保存到 ViewModel
   userInfoViewModel.token.postValue(token)
   ↓
5. 原生代码可以访问 token（如后台服务）
   String token = viewModel.token.getValue();
```

### 3.4 代码实现

#### 3.4.1 React Native 层（TypeScript）

```typescript
// 文件: src/services/androidBridgeService.ts

static async syncUserInfo(
  userId: string,
  token: string,
  password?: string
): Promise<boolean> {
  // 1. 检查 Android Bridge 是否可用
  if (!this.isAvailable() || !AndroidBridge.syncUserInfo) {
    return false
  }

  // 2. 调用原生方法同步用户信息 ⭐
  await AndroidBridge.syncUserInfo(userId, token, password || '')
  
  return true
}
```

#### 3.4.2 原生层（Java）

```java
// 文件: android/src/main/java/com/imates/AndroidBridgeModule.java

@ReactMethod
public void syncUserInfo(String userId, String token, String password, Promise promise) {
  try {
    Log.d(MODULE_NAME, "同步用户信息: userId=" + userId + ", token=" + token);
    
    // ⭐ 同步到原生 ViewModel（关键步骤）
    // UserInfoViewModel userInfoViewModel = getViewModel();
    // userInfoViewModel.userId.postValue(userId);
    // userInfoViewModel.token.postValue(token);
    // userInfoViewModel.password.postValue(password);
    
    // 返回同步结果
    WritableMap result = Arguments.createMap();
    result.putBoolean("success", true);
    promise.resolve(result);
  } catch (Exception e) {
    promise.reject("SYNC_ERROR", e.getMessage(), e);
  }
}
```

### 3.5 使用场景

同步到原生主要用于以下场景：

1. **后台服务**：原生后台服务需要 token 来调用 API
2. **消息推送**：推送服务需要用户信息
3. **状态共享**：原生 UI（如通知栏）需要显示用户信息
4. **跨模块通信**：多个原生模块需要共享 token

### 3.6 代码示例（完整流程）

```typescript
// 文件: src/services/apiService.ts

async getUserInfo(token: string): Promise<UserInfo> {
  // 1. 调用 API 获取用户信息
  const response = await this.httpClient.get<ApiResponse<UserInfo>>(url)
  const userInfo = response.data

  // 2. 持久化到 AsyncStorage（React Native 层）
  await StorageService.setItem('userInfo', JSON.stringify(userInfo))

  // 3. 同步到 Android 原生 ViewModel ⭐
  const userId = await StorageService.getItem<string>(StorageKeys.USER_ID)
  const userPassword = await StorageService.getItem<string>(StorageKeys.USER_PASSWORD)

  if (userId && token) {
    // 关键：同步到原生，让原生代码也能访问
    await AndroidBridgeService.syncUserInfo(userId, token, userPassword || '')
  }

  return userInfo
}
```

## 4. 总结

### 4.1 三个概念的关系

```
┌─────────────────────────────────────────────┐
│          React Native 应用                  │
│                                             │
│  1. 保存 Token                              │
│     ↓                                       │
│     AsyncStorage.setItem('TOKEN', token)    │
│     (React Native 本地存储)                 │
│                                             │
│  2. 同步到原生                              │
│     ↓                                       │
│     AndroidBridgeService.syncUserInfo()     │
│     ↓                                       │
│     通过 Bridge 传递给原生                  │
│     ↓                                       │
│  原生层接收并保存到 ViewModel               │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.2 关键区别

| 操作 | 保存 Token | 同步到原生 |
|------|-----------|-----------|
| **目的** | 在 RN 层持久化存储 | 让原生层也能访问 |
| **存储位置** | AsyncStorage (RN) | ViewModel/SharedPreferences (原生) |
| **访问方式** | `StorageService.getItem()` | `viewModel.token.getValue()` |
| **使用场景** | RN 组件中使用 | 原生代码中使用 |

### 4.3 实际应用

在我们的登录流程中：

```typescript
// 登录流程
1. apiService.loginXueban(account, password)
   → 保存 token 到 AsyncStorage ✅

2. apiService.getUserInfo(token)
   → 保存用户信息到 AsyncStorage ✅
   → 同步到 Android ViewModel ✅（关键！）

3. 原生后台服务可以访问 token
   → String token = viewModel.token.getValue() ✅
```

---

**总结**：
- **保存 Token**：在 React Native 层持久化存储，供 RN 代码使用
- **同步到原生**：将数据传递给原生层，供原生代码使用
- **两者配合**：确保 RN 和原生都能访问用户信息，实现跨层通信

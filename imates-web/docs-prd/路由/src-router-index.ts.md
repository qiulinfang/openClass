# router/index.ts PRD 文档

## 📋 概述

**文件路径**：`src/router/index.ts`  
**文件类型**：`Vue Router 路由配置`  
**主要职责**：管理应用的路由配置、路由守卫和页面导航

## 🎯 功能需求

### 1. 核心功能
- **路由配置**：定义所有页面的路由路径和组件映射
- **路由守卫**：检查登录状态，保护需要认证的路由
- **路由重定向**：处理旧路由到新路由的重定向
- **嵌套路由**：支持主应用下的子路由配置

### 2. 功能边界
- **负责**：
  - 路由定义和配置
  - 登录状态检查
  - 路由重定向逻辑
- **不负责**：
  - 具体的页面组件实现
  - 用户认证逻辑（由 userStore 负责）
  - 路由参数验证（由页面组件负责）

### 3. 输入输出
- **输入**：路由跳转请求（通过 `router.push()` 或导航链接）
- **输出**：路由跳转结果（成功或重定向到登录页）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { createRouter, createWebHashHistory } from 'vue-router'
  import MainView from '@/views/MainView.vue'
  import ExerciseSolveView from '@/views/ExerciseSolveView.vue'
  // ... 其他视图组件
  ```
- **被依赖**：
  - `src/main.ts`：在应用启动时注册路由
  - `src/App.vue`：使用 `<router-view>` 显示路由组件
  - 各个视图组件：通过路由导航访问

### 2. 关键代码逻辑

#### 路由配置结构
```typescript
const router = createRouter({
  history: createWebHashHistory(), // Hash模式，适配Android WebView
  routes: [
    {
      path: '/',
      redirect: '/login' // 默认重定向到登录页
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/app',
      component: MainView,
      redirect: '/app/my-profile',
      children: [
        // 子路由配置
      ]
    }
  ]
})
```

#### 路由守卫逻辑
```typescript
router.beforeEach((to, from, next) => {
  // 第1步：检查token
  const token = localStorage.getItem('XUEBAN_TOKEN')
  const isLoggedIn = !!token
  
  // 第2步：登录页直接放行
  if (to.name === 'login' || to.path === '/login') {
    next()
    return
  }
  
  // 第3步：保护需要认证的路由
  if (to.path.startsWith('/app')) {
    if (!isLoggedIn) {
      next({ name: 'login' }) // 重定向到登录页
      return
    }
  }
  
  // 第4步：已登录，正常访问
  next()
})
```

### 3. 数据流
- **路由跳转流程**：
  1. 用户触发导航（点击链接或调用 `router.push()`）
  2. 路由守卫检查登录状态
  3. 如果已登录，跳转到目标路由
  4. 如果未登录，重定向到登录页
  5. 路由组件渲染到 `<router-view>`

### 4. 路由列表
- `/`：根路径，重定向到登录页
- `/login`：登录页
- `/app`：主应用容器，包含以下子路由：
  - `/app/exercise-solve`：习题解答
  - `/app/knowledge-graph`：知识图谱
  - `/app/my-profile`：个人资料（默认路由）
  - `/app/my-resources`：我的资源
  - `/app/feedback`：反馈
  - `/app/pdf-viewer`：PDF查看器
  - `/app/html-viewer`：HTML查看器
  - `/app/video-viewer`：视频查看器
  - `/app/find-exercise`：找题
  - `/app/learning`：学习
  - `/app/drawing-board`：画板

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：使用 Vue Router，基于 `createWebHashHistory` 实现路由
- **React Native 实现**：使用 React Navigation，基于原生导航栈实现路由

### 2. 需要的第三方库
- `@react-navigation/native`：React Navigation 核心库
- `@react-navigation/native-stack`：原生栈导航器
- `@react-navigation/bottom-tabs`：底部标签导航器（可选）
- `react-native-screens`：原生屏幕支持
- `react-native-safe-area-context`：安全区域支持

### 3. 迁移步骤
1. **安装依赖**：
   ```bash
   yarn add @react-navigation/native @react-navigation/native-stack
   yarn add react-native-screens react-native-safe-area-context
   ```

2. **创建导航配置**：
   - 创建 `src/navigation/AppNavigator.tsx`
   - 定义导航栈和路由类型

3. **实现路由守卫**：
   - 使用 `NavigationContainer` 的 `onReady` 回调
   - 或者使用自定义的导航包装组件

4. **迁移路由配置**：
   - 将 Vue Router 的路由配置转换为 React Navigation 的导航配置
   - 处理嵌套路由（使用 Stack Navigator）

5. **更新组件引用**：
   - 将 Vue 组件转换为 React Native 组件
   - 使用 `navigation.navigate()` 替代 `router.push()`

### 4. 注意事项
- **Hash模式**：Vue Router 使用 Hash 模式是为了适配 Android WebView，React Native 不需要
- **路由参数**：React Navigation 使用 `route.params` 传递参数，而非 Vue Router 的 `$route.query`
- **路由守卫**：React Navigation 没有类似 Vue Router 的 `beforeEach`，需要使用自定义逻辑
- **嵌套路由**：React Navigation 支持嵌套导航器，但结构与 Vue Router 不同
- **默认路由**：React Navigation 使用 `initialRouteName` 而非 `redirect`

### 5. 迁移代码示例

#### Vue Router 实现
```typescript
router.push({ name: 'exerciseSolve', query: { id: '123' } })
```

#### React Navigation 实现
```typescript
navigation.navigate('ExerciseSolve', { id: '123' })
```

## ⚠️ 迁移风险

### 高风险项
- **路由守卫**：React Navigation 没有内置的路由守卫机制，需要自定义实现 - **解决方案**：在 NavigationContainer 外层包装认证检查组件
- **嵌套路由**：Vue Router 的嵌套路由结构与 React Navigation 不同 - **解决方案**：使用 Stack Navigator 嵌套实现
- **路由参数**：参数传递方式不同 - **解决方案**：统一使用 route.params 访问参数

### 低风险项
- **路由重定向**：可以通过 `initialRouteName` 和条件渲染实现
- **路由历史**：React Navigation 自动管理导航历史

## 🧪 测试要点

### 功能测试
- 测试登录状态检查是否正常工作
- 测试未登录用户访问受保护路由是否重定向到登录页
- 测试已登录用户访问各个路由是否正常
- 测试路由重定向是否正常工作

### 边界测试
- 测试 token 过期时的路由行为
- 测试 token 为空字符串时的路由行为
- 测试访问不存在的路由时的行为

## 📚 参考资源

- [React Navigation 官方文档](https://reactnavigation.org/)
- [Vue Router 官方文档](https://router.vuejs.org/)
- [React Native 导航最佳实践](https://reactnavigation.org/docs/getting-started)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队


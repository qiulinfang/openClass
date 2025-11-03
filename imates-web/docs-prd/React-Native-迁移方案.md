# imates-web 迁移到 React Native 整体方案

## 📋 概述

本文档描述将 imates-web（Vue 3 + WebView）迁移到 React Native 的整体方案。

## 🎯 迁移目标

### 1. 技术栈迁移
- **框架**：Vue 3 → React
- **UI 库**：Quasar → React Native 组件库
- **状态管理**：Pinia → Redux/Zustand
- **路由**：Vue Router → React Navigation
- **原生交互**：Android Bridge → React Native Modules

### 2. 平台支持
- **当前**：Android WebView
- **目标**：Android + iOS（可选）

### 3. 性能目标
- 启动时间：< 2 秒
- 页面切换：流畅（60fps）
- 内存占用：优化 30%

## 📊 迁移策略

### 1. 分层迁移

#### Phase 1：基础设施（P0）
- ✅ 项目初始化
- ✅ 路由配置
- ✅ 状态管理
- ✅ 网络请求
- ✅ 数据存储

#### Phase 2：核心功能（P0）
- ✅ 用户认证
- ✅ 习题解答
- ✅ AI 聊天基础功能

#### Phase 3：重要功能（P1）
- ✅ 知识图谱
- ✅ 资源查看（PDF/视频）
- ✅ 消息流式渲染

#### Phase 4：增强功能（P2）
- ⚠️ 动画效果
- ⚠️ 调试工具
- ⚠️ 性能优化

### 2. 模块迁移优先级

| 模块 | 优先级 | 预计工作量 | 依赖项 |
|-----|-------|-----------|--------|
| 用户认证 | P0 | 2 天 | 无 |
| 路由导航 | P0 | 3 天 | 无 |
| 状态管理 | P0 | 2 天 | 无 |
| 网络请求 | P0 | 2 天 | 无 |
| 数据存储 | P0 | 3 天 | 无 |
| 习题解答 | P0 | 5 天 | 路由、状态管理 |
| AI 聊天 | P0 | 7 天 | 网络请求、状态管理 |
| 知识图谱 | P1 | 10 天 | 状态管理、画布渲染 |
| PDF 查看 | P1 | 5 天 | 文件系统 |
| 视频播放 | P1 | 3 天 | 媒体库 |
| 数学公式 | P1 | 7 天 | 自定义组件 |
| 调试工具 | P2 | 3 天 | 开发工具 |

## 🔧 技术选型

### 1. 状态管理
**推荐**：Zustand
- 轻量级
- 学习成本低
- TypeScript 支持好
- 迁移成本低

**备选**：Redux Toolkit
- 生态丰富
- 适合大型应用
- 学习成本较高

### 2. UI 组件库
**推荐**：React Native Paper
- Material Design 风格
- 与 Quasar 风格相近
- 组件丰富
- 文档完善

**备选**：NativeBase
- 跨平台一致性好
- 组件丰富

### 3. 路由导航
**推荐**：React Navigation
- 官方推荐
- 生态完善
- 性能好
- TypeScript 支持

### 4. 数据存储
**推荐**：AsyncStorage（简单数据）+ Realm（复杂数据）
- AsyncStorage：轻量级键值存储
- Realm：复杂查询、关系型数据

**备选**：SQLite（需要复杂查询时）

### 5. 网络请求
**推荐**：Axios（已有）+ React Query（缓存）
- Axios：HTTP 客户端
- React Query：数据缓存和同步

### 6. 画布绘制
**推荐**：react-native-svg
- 性能好
- API 清晰
- 适合知识图谱

**备选**：react-native-canvas（需要 Canvas API 时）

### 7. PDF 查看
**推荐**：react-native-pdf
- 功能完善
- 性能好
- 支持大文件

### 8. 数学公式
**方案 A**：使用 WebView 嵌入 MathLive（快速方案）
**方案 B**：使用 react-native-math-view（需要适配）
**方案 C**：自定义组件（长期方案）

## 📝 依赖库迁移对照表

### 核心框架
| Vue 依赖 | React Native 替代 | 说明 |
|---------|------------------|------|
| `vue` | `react` | 框架核心 |
| `vue-router` | `@react-navigation/native` | 路由导航 |
| `pinia` | `zustand` | 状态管理 |

### UI 组件
| Quasar 组件 | React Native 替代 | 说明 |
|------------|-----------------|------|
| `q-btn` | `Button` from `react-native-paper` | 按钮 |
| `q-input` | `TextInput` from `react-native-paper` | 输入框 |
| `q-dialog` | `Dialog` from `react-native-paper` | 对话框 |
| `q-list` | `FlatList` / `SectionList` | 列表 |
| `q-card` | `Card` from `react-native-paper` | 卡片 |
| `q-spinner` | `ActivityIndicator` | 加载指示器 |

### 业务功能
| Vue 依赖 | React Native 替代 | 说明 |
|---------|------------------|------|
| `mathlive` | WebView 或自定义组件 | 数学公式 |
| `fabric` | `react-native-svg` | 画布绘制 |
| `pdfjs-dist` | `react-native-pdf` | PDF 查看 |
| `@tiptap/vue-3` | `react-native-rich-text-editor` | 富文本 |
| `@better-scroll/core` | `ScrollView` / `FlatList` | 滚动优化 |
| `localforage` | `@react-native-async-storage/async-storage` | 数据存储 |

### 原生交互
| Capacitor/Android Bridge | React Native 替代 | 说明 |
|------------------------|-----------------|------|
| `@capacitor/camera` | `react-native-image-picker` | 相机 |
| `@capacitor/filesystem` | `react-native-fs` | 文件系统 |
| `@capacitor/preferences` | `@react-native-async-storage/async-storage` | 偏好设置 |
| `AndroidBridge` | Native Modules | 原生通信 |

## 🚀 迁移步骤详解

### Step 1：项目初始化（Week 1）

#### 1.1 创建 React Native 项目
```bash
npx react-native init ImatesApp --template react-native-template-typescript
```

#### 1.2 安装核心依赖
```bash
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npm install react-native-paper react-native-vector-icons
npm install zustand
npm install axios @tanstack/react-query
npm install @react-native-async-storage/async-storage
```

#### 1.3 配置项目结构
```
src/
├── navigation/      # 路由配置
├── screens/         # 页面组件
├── components/      # 可复用组件
├── stores/          # 状态管理
├── services/        # 业务服务
├── utils/           # 工具函数
├── types/           # 类型定义
└── styles/          # 样式定义
```

### Step 2：基础设施迁移（Week 2）

#### 2.1 路由配置
- 创建导航栈
- 配置路由参数
- 实现路由守卫

#### 2.2 状态管理
- 迁移 Pinia stores 到 Zustand
- 实现状态持久化
- 配置中间件

#### 2.3 网络请求
- 封装 Axios 实例
- 实现请求拦截器
- 配置错误处理

#### 2.4 数据存储
- 封装 AsyncStorage API
- 实现数据迁移逻辑
- 配置存储清理

### Step 3：核心功能迁移（Week 3-4）

#### 3.1 用户认证
- 实现登录页面
- 实现 token 管理
- 实现路由守卫

#### 3.2 习题解答
- 实现习题列表页面
- 实现 AI 解答功能
- 实现相似题推荐

#### 3.3 AI 聊天基础
- ✅ AI通用聊天Store迁移完成（aiGeneralChatStore）
- ⏳ 实现聊天界面（ChatScreen）
- ⏳ 实现消息渲染（ChatMessage）
- ⏳ 实现流式响应处理

### Step 4：重要功能迁移（Week 5-6）

#### 4.1 知识图谱
- 使用 react-native-svg 绘制图谱
- 实现节点交互
- 实现拖拽功能

#### 4.2 资源查看
- 集成 react-native-pdf
- 实现视频播放
- 实现 HTML 查看

#### 4.3 消息增强
- 实现图片消息
- 实现语音消息
- 实现富文本消息

### Step 5：优化和测试（Week 7-8）

#### 5.1 性能优化
- 优化列表渲染
- 实现图片懒加载
- 优化内存使用

#### 5.2 测试
- 单元测试
- 集成测试
- E2E 测试

#### 5.3 文档
- 更新开发文档
- 更新 API 文档
- 编写迁移指南

## ⚠️ 关键注意事项

### 1. 异步初始化
React Native 中所有初始化操作都需要处理异步：
```typescript
useEffect(() => {
  async function init() {
    await initializeApp()
  }
  init()
}, [])
```

### 2. 平台差异处理
```typescript
import { Platform } from 'react-native'

if (Platform.OS === 'android') {
  // Android 特定代码
} else if (Platform.OS === 'ios') {
  // iOS 特定代码
}
```

### 3. 样式适配
React Native 不支持 CSS，需要使用 StyleSheet：
```typescript
import { StyleSheet } from 'react-native'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
})
```

### 4. 原生模块通信
需要创建 Native Modules 替代 Android Bridge：
```typescript
// android/src/main/java/.../ChatModule.java
public class ChatModule extends ReactContextBaseJavaModule {
  @ReactMethod
  public void sendChatRequest(String requestId, String message) {
    // 实现原生方法
  }
}
```

### 5. 性能考虑
- 使用 `FlatList` 替代 `ScrollView` 渲染长列表
- 使用 `React.memo` 优化组件渲染
- 使用 `useMemo` 和 `useCallback` 优化计算

## 📊 迁移进度跟踪

### 里程碑 1：项目初始化 ✅
- [x] 创建 React Native 项目
- [x] 配置开发环境
- [x] 安装核心依赖

### 里程碑 2：基础设施 ✅
- [x] 路由配置完成（React Navigation）
- [x] 状态管理迁移完成（Zustand：questionStore, userStore）
- [x] 网络请求封装完成（apiService, httpClient）
- [x] 数据存储迁移完成（storageService, AsyncStorage）

### 里程碑 3：核心功能 🔄
- [x] 用户认证迁移完成（LoginScreen, userStore）
- [x] 习题解答迁移完成（QuestionList, questionStore）
- [x] AI通用聊天Store迁移完成（aiGeneralChatStore）
- [ ] AI聊天UI组件完成（ChatScreen, ChatMessage, ChatInput）
- [ ] 其他Chat Stores迁移（aiExerciseChatStore, aiTextbookChatStore, teacherChatStore）

### 里程碑 4：重要功能 ⏳
- [ ] 知识图谱迁移完成
- [ ] 资源查看迁移完成
- [ ] 消息增强功能完成

### 里程碑 5：优化测试 ⏳
- [ ] 性能优化完成
- [ ] 测试覆盖完成
- [ ] 文档更新完成

## 📚 参考资源

- [React Native 官方文档](https://reactnative.dev/)
- [React Navigation 文档](https://reactnavigation.org/)
- [Zustand 文档](https://github.com/pmndrs/zustand)
- [React Native Paper 文档](https://callstack.github.io/react-native-paper/)

---

**文档版本**：v1.1  
**创建日期**：2025-01-XX  
**最后更新**：2025-01-27  
**维护者**：开发团队

---

## 📝 已完成工作记录

### ✅ 已完成功能（2025-01-27）

#### 1. 基础设施层
- **项目初始化** ✅
  - React Native TypeScript 项目创建
  - 核心依赖安装（React Navigation, Zustand, Axios, AsyncStorage）
  - 项目结构搭建

- **路由导航** ✅
  - React Navigation 配置
  - 导航栈和路由类型定义
  - 路由守卫实现

- **状态管理** ✅
  - `questionStore`：题目列表管理、选择、删除、置顶
  - `userStore`：用户认证状态管理
  - Zustand Store 持久化

- **网络请求** ✅
  - `apiService`：API 请求封装
  - `httpClient`：HTTP 客户端配置
  - 请求/响应拦截器
  - 错误处理机制

- **数据存储** ✅
  - `storageService`：AsyncStorage 封装
  - 数据持久化策略
  - 存储清理逻辑

#### 2. 核心功能层
- **用户认证** ✅
  - `LoginScreen`：登录页面实现
  - Token 管理和存储
  - 登录状态检查

- **习题解答** ✅
  - `QuestionList`：题目列表组件
    - 题目搜索功能
    - 题目选择与高亮
    - 操作按钮（AI、拍作业、微课、置顶、删除）
    - 空状态和加载状态
  - `questionStore`：题目状态管理
    - 题目列表获取（本地优先）
    - 题目选择与索引管理
    - 题目删除与置顶
    - 题目去重算法

#### 3. UI 组件
- **QuestionList 组件** ✅
  - 搜索栏实现（带搜索图标和清除按钮）
  - 题目卡片列表
  - 选中状态高亮
  - 操作按钮组（带图标：AI 🤖、拍照 📷、微课 🎥、置顶 ⬆️、删除 🗑️）
  - 响应式布局
  - 优化样式（阴影、圆角、颜色主题）
  - 优化交互（按钮反馈、空状态图标）

### 🔄 进行中功能

- 无

### 📋 待完成功能

#### 1. AI 聊天功能（P0）
- Chat Stores 迁移
  - `aiGeneralChatStore`
  - `aiExerciseChatStore`
  - `aiTextbookChatStore`
  - `teacherChatStore`
- ChatScreen 组件
  - 消息列表渲染
  - 输入框组件
  - 流式响应处理
  - 语音和图片功能

#### 2. 知识图谱（P1）
- 图谱渲染组件
- 节点交互
- 拖拽功能

#### 3. 资源查看（P1）
- PDF 查看器
- 视频播放器
- HTML 查看器

---

### 📊 迁移进度统计

- **基础设施**：100% ✅ (4/4)
- **核心功能**：67% 🔄 (2/3)
  - 用户认证 ✅
  - 习题解答 ✅
  - AI 聊天 ⏳
- **重要功能**：0% ⏳ (0/3)
- **增强功能**：0% ⏳ (0/3)

**总体进度**：约 40%



## 📝 已完成工作记录

### ✅ 已完成功能（2025-01-27）

#### 1. 基础设施层
- **项目初始化** ✅
  - React Native TypeScript 项目创建
  - 核心依赖安装（React Navigation, Zustand, Axios, AsyncStorage）
  - 项目结构搭建

- **路由导航** ✅
  - React Navigation 配置
  - 导航栈和路由类型定义
  - 路由守卫实现

- **状态管理** ✅
  - `questionStore`：题目列表管理、选择、删除、置顶
  - `userStore`：用户认证状态管理
  - Zustand Store 持久化

- **网络请求** ✅
  - `apiService`：API 请求封装
  - `httpClient`：HTTP 客户端配置
  - 请求/响应拦截器
  - 错误处理机制

- **数据存储** ✅
  - `storageService`：AsyncStorage 封装
  - 数据持久化策略
  - 存储清理逻辑

#### 2. 核心功能层
- **用户认证** ✅
  - `LoginScreen`：登录页面实现
  - Token 管理和存储
  - 登录状态检查

- **习题解答** ✅
  - `QuestionList`：题目列表组件
    - 题目搜索功能
    - 题目选择与高亮
    - 操作按钮（AI、拍作业、微课、置顶、删除）
    - 空状态和加载状态
  - `questionStore`：题目状态管理
    - 题目列表获取（本地优先）
    - 题目选择与索引管理
    - 题目删除与置顶
    - 题目去重算法

#### 3. UI 组件
- **QuestionList 组件** ✅
  - 搜索栏实现（带搜索图标和清除按钮）
  - 题目卡片列表
  - 选中状态高亮
  - 操作按钮组（带图标：AI 🤖、拍照 📷、微课 🎥、置顶 ⬆️、删除 🗑️）
  - 响应式布局
  - 优化样式（阴影、圆角、颜色主题）
  - 优化交互（按钮反馈、空状态图标）

### 🔄 进行中功能

- 无

### 📋 待完成功能

#### 1. AI 聊天功能（P0）
- Chat Stores 迁移
  - `aiGeneralChatStore`
  - `aiExerciseChatStore`
  - `aiTextbookChatStore`
  - `teacherChatStore`
- ChatScreen 组件
  - 消息列表渲染
  - 输入框组件
  - 流式响应处理
  - 语音和图片功能

#### 2. 知识图谱（P1）
- 图谱渲染组件
- 节点交互
- 拖拽功能

#### 3. 资源查看（P1）
- PDF 查看器
- 视频播放器
- HTML 查看器

---

### 📊 迁移进度统计

- **基础设施**：100% ✅ (4/4)
- **核心功能**：67% 🔄 (2/3)
  - 用户认证 ✅
  - 习题解答 ✅
  - AI 聊天 ⏳
- **重要功能**：0% ⏳ (0/3)
- **增强功能**：0% ⏳ (0/3)

**总体进度**：约 40%


# package.json PRD 文档

## 📋 概述

**文件路径**：`imates-web/package.json`  
**文件类型**：项目配置文件  
**主要职责**：定义项目依赖、脚本命令、项目元信息

## 🎯 功能需求

### 1. 项目基本信息
- 项目名称：`exerciseSolve`
- 项目版本：`0.0.0`
- Node.js 版本要求：`>=22.11.0`
- 项目类型：私有模块

### 2. 脚本命令

#### 开发环境
- `dev`：启动开发服务器（Vite）
- `dev:webview`：启动 WebView 开发模式

#### 构建命令
- `build`：构建生产版本（包含类型检查）
- `build-only`：仅构建，不进行类型检查
- `build:webview`：构建 WebView 页面
- `build:full`：构建完整应用

#### 部署命令
- `deploy`：一键部署（构建 + 部署到 Android）
- `deploy:exercise`：部署习题解答页面
- `deploy:find`：部署习题查找页面

#### 测试命令
- `test:unit`：单元测试（Vitest）
- `test:e2e`：端到端测试（Playwright）
- `test:sourcemap`：测试 SourceMap

#### 代码质量
- `lint`：ESLint 检查并修复
- `format`：Prettier 格式化
- `type-check`：TypeScript 类型检查

## 🔧 技术实现

### 1. 核心依赖（dependencies）

#### Vue 生态
```json
{
  "vue": "^3.5.18",              // Vue 3 框架
  "vue-router": "^4.5.1",       // 路由管理
  "pinia": "^3.0.3"             // 状态管理
}
```

#### UI 框架
```json
{
  "quasar": "^2.18.2",          // Quasar UI 组件库
  "@quasar/extras": "^1.17.0"   // Quasar 图标和字体
}
```

#### 原生交互
```json
{
  "@capacitor/core": "^7.4.4",
  "@capacitor/android": "^7.4.4",
  "@capacitor/app": "^7.1.0",
  "@capacitor/camera": "^7.0.2",
  "@capacitor/device": "^7.0.2",
  "@capacitor/filesystem": "^7.1.4",
  "@capacitor/keyboard": "^7.0.3",
  "@capacitor/preferences": "^7.0.2",
  "@capacitor/status-bar": "^7.0.3"
}
```

#### 富文本编辑
```json
{
  "@tiptap/core": "^3.4.2",
  "@tiptap/vue-3": "^3.4.2",
  "@tiptap/starter-kit": "^3.4.2",
  "@tiptap/extension-*": "...",
  "quill": "^2.0.2"
}
```

#### 数学公式
```json
{
  "mathlive": "^0.107.0",        // 数学公式编辑器
  "markdown-it": "^14.1.0",       // Markdown 解析
  "markdown-it-mathjax3": "^4.3.2" // 数学公式渲染
}
```

#### 画布和图形
```json
{
  "fabric": "^6.7.1"             // 画布操作（知识图谱）
}
```

#### 数据存储
```json
{
  "localforage": "^1.10.0"       // IndexedDB 封装
}
```

#### 滚动优化
```json
{
  "@better-scroll/core": "^2.5.1",
  "@better-scroll/pull-down": "^2.5.1"
}
```

#### 其他工具
```json
{
  "crypto-js": "^4.2.0",         // 加密工具
  "pdfjs-dist": "^5.4.296",      // PDF 渲染
  "vuedraggable": "^4.1.0"       // 拖拽功能
}
```

### 2. 开发依赖（devDependencies）

#### 构建工具
```json
{
  "vite": "^7.0.6",
  "@vitejs/plugin-vue": "^6.0.1",
  "@vitejs/plugin-vue-jsx": "^5.0.1",
  "@quasar/vite-plugin": "^1.10.0"
}
```

#### TypeScript
```json
{
  "typescript": "~5.8.0",
  "vue-tsc": "^3.0.4",
  "@types/node": "^22.16.5"
}
```

#### 测试框架
```json
{
  "vitest": "^3.2.4",
  "@vue/test-utils": "^2.4.6",
  "@playwright/test": "^1.54.1"
}
```

#### 代码质量
```json
{
  "eslint": "^9.31.0",
  "@vue/eslint-config-typescript": "^14.6.0",
  "prettier": "3.6.2"
}
```

## 🔄 迁移到 React Native

### 1. 依赖替换对照表

| Vue 依赖 | React Native 替代 | 说明 |
|---------|------------------|------|
| `vue` | `react` | 框架核心 |
| `vue-router` | `@react-navigation/native` | 路由导航 |
| `pinia` | `zustand` / `redux` | 状态管理 |
| `quasar` | `react-native-paper` / `native-base` | UI 组件库 |
| `@tiptap/vue-3` | `react-native-rich-text-editor` | 富文本编辑 |
| `mathlive` | 需要自定义或 WebView | 数学公式编辑 |
| `fabric` | `react-native-svg` | 画布绘制 |
| `localforage` | `@react-native-async-storage/async-storage` | 数据存储 |
| `@better-scroll/core` | `react-native-scroll-view` | 滚动优化 |
| `pdfjs-dist` | `react-native-pdf` | PDF 查看 |
| `vuedraggable` | `react-native-draggable` | 拖拽功能 |

### 2. Capacitor 替换

Capacitor 相关依赖需要替换为 React Native 原生模块：

```json
{
  // 移除
  "@capacitor/core": "...",
  "@capacitor/android": "...",
  
  // 替换为
  "@react-native-community/async-storage": "...",
  "react-native-camera": "...",
  "react-native-fs": "...",
  "react-native-keyboard-aware-scroll-view": "..."
}
```

### 3. 脚本命令迁移

#### 开发命令
```json
{
  // 当前
  "dev": "vite --host 0.0.0.0",
  
  // 迁移后
  "dev": "react-native start",
  "dev:android": "react-native run-android",
  "dev:ios": "react-native run-ios"
}
```

#### 构建命令
```json
{
  // 当前
  "build": "vite build",
  
  // 迁移后
  "build:android": "cd android && ./gradlew assembleRelease",
  "build:ios": "cd ios && xcodebuild ..."
}
```

### 4. 新增依赖

React Native 项目需要添加的依赖：

```json
{
  "react": "^18.2.0",
  "react-native": "^0.72.0",
  "@react-navigation/native": "^6.0.0",
  "@react-navigation/stack": "^6.0.0",
  "@react-navigation/bottom-tabs": "^6.0.0",
  "react-native-gesture-handler": "^2.0.0",
  "react-native-reanimated": "^3.0.0",
  "react-native-safe-area-context": "^4.0.0",
  "zustand": "^4.0.0",
  "react-native-paper": "^5.0.0",
  "react-native-svg": "^13.0.0",
  "react-native-pdf": "^6.0.0",
  "@react-native-async-storage/async-storage": "^1.19.0"
}
```

## ⚠️ 注意事项

### 1. Node.js 版本
- 当前要求：`>=22.11.0`
- React Native 建议：`>=18.0.0`
- 需要统一版本要求

### 2. 构建工具变化
- 当前使用 Vite（Web 打包工具）
- React Native 使用 Metro（React Native 打包工具）
- 构建配置需要完全重写

### 3. 类型检查
- 当前使用 `vue-tsc`
- React Native 使用 `tsc` 即可
- TypeScript 配置需要调整

### 4. 测试框架
- Vitest 可以保留（用于工具函数测试）
- Playwright 需要替换为 React Native 测试工具
- 需要添加 Jest（React Native 默认测试框架）

## 📝 迁移步骤

1. **备份当前配置**
   ```bash
   cp package.json package.json.backup
   ```

2. **初始化 React Native 项目**
   ```bash
   npx react-native init ImatesApp --template react-native-template-typescript
   ```

3. **逐步迁移依赖**
   - 先迁移核心依赖（React、React Native）
   - 再迁移业务依赖（状态管理、UI 组件）
   - 最后迁移工具依赖

4. **更新脚本命令**
   - 修改 `package.json` 中的 scripts
   - 测试每个命令是否正常工作

5. **验证依赖兼容性**
   - 检查依赖版本冲突
   - 验证类型定义是否完整

## 📚 参考资源

- [React Native 官方文档](https://reactnative.dev/)
- [React Navigation 文档](https://reactnavigation.org/)
- [React Native 依赖库](https://reactnative.directory/)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队


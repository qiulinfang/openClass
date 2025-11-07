# Web应用就绪检测问题分析与修复

## 问题描述

Android端的`MainWebViewActivity`一直在重复输出以下日志：
```
Web应用未就绪，稍后重试
重试初始化Web应用
```

即使Web应用已经打开并正常运行，检测仍然失败，导致不断重试。

## 问题原因分析

### 1. Android端检测逻辑

Android端在`MainWebViewActivity.java`的`checkWebAppReady()`方法中使用以下JavaScript代码检测Vue应用是否就绪：

```java
String jsCode = 
    "if (typeof window !== 'undefined' && window.Vue && window.Vue.version) {" +
    "  'ready';" +
    "} else {" +
    "  'not_ready';" +
    "}";
```

### 2. Vue 3的变化

在Vue 2中，Vue构造函数会自动挂载到`window.Vue`对象上，但在Vue 3中：
- Vue 3不会自动将Vue构造函数挂载到`window`对象
- `createApp()`返回的是应用实例，不是Vue构造函数
- 因此`window.Vue`始终为`undefined`，导致检测一直失败

### 3. 检测失败的影响

- Android端无法正确识别Vue应用已就绪
- 导致以下初始化操作无法执行：
  - `initMessagingManagerOnStartup()` - 消息管理器初始化
  - `startFloatingFabServiceWhenReady()` - 悬浮FAB按钮服务启动
  - `startFloatingRobotServiceWhenReady()` - 浮动机器人服务启动
- 不断重试检测，浪费资源

## 解决方案

### 方案选择

**方案1：在Vue应用启动后将Vue挂载到window对象（推荐）**
- 优点：改动最小，只需修改Vue入口文件
- 缺点：需要在window对象上添加属性
- 实现：在应用挂载后，将Vue版本信息挂载到`window.Vue`

**方案2：修改Android端检测逻辑**
- 优点：不需要修改Vue代码
- 缺点：需要找到其他可靠的检测方式（如检查DOM元素、检查特定全局变量等）
- 实现：修改`checkWebAppReady()`方法，使用其他检测方式

**最终选择：方案1**，因为：
1. 改动最小，只需修改Vue入口文件
2. Android端的检测逻辑已经写好了，保持一致性
3. 不影响现有功能

### 实现步骤

#### 1. 修改`main-webview.ts`

在应用挂载后，将Vue版本信息挂载到`window.Vue`：

```typescript
import { createApp, version as vueVersion } from 'vue'
// ... 其他导入

async function createWebViewApp() {
  // ... 应用初始化代码
  
  // 挂载应用
  app.mount('#app')
  
  // 将Vue挂载到window对象，供Android端检测应用是否就绪
  // Android端通过 window.Vue && window.Vue.version 来检测Vue应用是否就绪
  if (typeof window !== 'undefined') {
    (window as any).Vue = {
      version: vueVersion
    }
    console.log('[APP] Vue已挂载到window对象，版本:', vueVersion)
  }
}
```

#### 2. 修改`main.ts`

同样在应用挂载后，将Vue版本信息挂载到`window.Vue`：

```typescript
import { createApp, version as vueVersion } from 'vue'
// ... 其他导入

app.mount('#app')

// 将Vue挂载到window对象，供Android端检测应用是否就绪
// Android端通过 window.Vue && window.Vue.version 来检测Vue应用是否就绪
if (typeof window !== 'undefined') {
  (window as any).Vue = {
    version: vueVersion
  }
  console.log('[APP] Vue已挂载到window对象，版本:', vueVersion)
}
```

## 修改文件清单

1. `imates-web/src/main-webview.ts` - WebView专用入口文件
2. `imates-web/src/main.ts` - 主入口文件

## 验证方法

1. 重新构建Vue应用
2. 将构建后的文件复制到Android项目的`assets/webapp`目录
3. 运行Android应用
4. 查看logcat日志，应该看到：
   - `Web应用已就绪`（而不是`Web应用未就绪，稍后重试`）
   - 不再重复重试
   - 后续初始化操作正常执行

## 注意事项

1. 需要在应用挂载**之后**才挂载Vue到window对象，确保应用已经完全初始化
2. 两个入口文件都需要修改，确保无论使用哪个入口文件都能正常工作
3. 挂载的Vue对象只需要包含`version`属性，满足Android端的检测需求即可

## 相关代码位置

- Android端检测逻辑：`app/src/main/java/com/cosinetech/imates/ui/webview/MainWebViewActivity.java:589-606`
- Vue入口文件：`imates-web/src/main-webview.ts`、`imates-web/src/main.ts`


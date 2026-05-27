# Web 面试题 - 移动端混合开发 (Capacitor)

> 本面试题基于项目实际代码，深入探讨技术实现细节与业务难点。

## 1. Capacitor 核心原理

### Q1: Capacitor 和 Cordova 有什么区别？为什么项目选择 Capacitor？
- **架构**:
  - Cordova: Webview 作为容器，插件通过 Bridge 调用原生。
  - Capacitor: 每个平台都是原生项目的一部分，Web 代码打包到 `assets` 目录。
- **优势**:
  - 更易调试（可以直接在 Android Studio/Xcode 中调试）。
  - 更现代的 API（Promise, ES Modules）。
  - 更好的 TypeScript 支持。
  - 自动生成图标和启动画面。

### Q2: Capacitor 的插件机制是什么？如何编写一个自定义插件？
- **结构**: 
  - JavaScript 端：定义调用接口。
  - 原生端：实现具体功能（Swift/Kotlin）。
- **通信**: 通过 `Capacitor.Plugins` 全局对象调用。
- **自定义插件**: 需要实现 `CapacitorPlugin` 注解的方法。

### Q3: 项目中 Webview 和原生是如何通信的？请详细说明 JS Bridge 的实现原理。
- **Web -> Native**:
  - `window.Capacitor.NativeCallback` 发送消息。
  - 消息包含 pluginId, methodName, callbackId, options。
- **Native -> Web**:
  - 原生通过 `webView.evaluateJavaScript` 执行 JS 代码。
  - 通过 `window.Capacitor.trigger` 触发事件。

## 2. 离线与存储

### Q4: 项目中的离线资源管理是如何实现的？请结合 `ResourceManager` 说明。
- **架构**:
  - 元数据存储在 `textbooks` 表。
  - 二进制文件存储在 `textbook_files` 表（分离存储）。
- **用户隔离**: 使用 `userId` 作为数据库名前缀。
- **降级策略**: 索引查询失败时降级到全表扫描。

### Q5: IndexedDB 的性能瓶颈是什么？项目中如何优化大量数据的读写？
- **瓶颈**: 
  - 事务锁竞争。
  - 大对象序列化开销。
- **优化**:
  - **分离存储**: 元数据和文件分离，避免大对象影响查询。
  - **批量操作**: 使用 `putAll` 批量写入。
  - **按需加载**: 不一次性加载所有数据，需要时再读取。

### Q6: `localforage` 相比原生 IndexedDB 有什么优势？项目中如何使用？
- **优势**: 
  - 统一的 API，支持 Promise。
  - 自动选择最佳存储引擎（IndexedDB -> WebSQL -> LocalStorage）。
  - 简单易用的序列化/反序列化。
- **使用**: 
  ```typescript
  import localforage from 'localforage'
  const store = localforage.createInstance({ name: 'myapp' })
  await store.setItem('key', data)
  const data = await store.getItem('key')
  ```

## 3. 资源加载与缓存

### Q7: 项目中如何实现资源的下载和断点续传？
- **下载**: 使用 `fetch` 的 `ReadableStream`，边下载边写入。
- **断点续传**: 使用 HTTP Range 请求获取剩余部分。
- **校验**: 下载完成后计算 MD5，与服务器返回的 checksum 比对。

### Q8: 什么是 Service Worker？项目中是否使用？有什么优缺点？
- **作用**: 拦截网络请求，实现离线缓存。
- **优点**: 
  - 完全离线可用。
  - 精细的缓存控制。
- **缺点**: 
  - 兼容性问题（iOS Safari 支持有限）。
  - 调试困难。
- **项目实践**: 本项目使用 Capacitor 的本地服务器方案，更可靠。

### Q9: 项目中如何处理资源更新？增量更新是如何实现的？
- **策略**: 
  - 服务端返回资源版本号和变更列表。
  - 客户端对比本地版本，下载增量包。
  - 替换本地文件，更新版本号。

## 4. 性能优化

### Q10: 移动端 Webview 的性能瓶颈是什么？项目中如何优化首屏加载？
- **瓶颈**:
  - JS 解析和执行耗时。
  - Webview 预热需要时间。
  - 首次渲染需要等待资源加载。
- **优化**:
  - **资源内联**: 关键 CSS 内联到 HTML。
  - **骨架屏**: 提前展示 UI 结构。
  - **预加载**: 使用 `<link rel="preload">` 预加载关键资源。
  - **Webview 预热**: 在 Splash 阶段预加载 Webview。

### Q11: 项目中如何处理 Android 和 iOS 的兼容性问题？
- **策略**:
  - 使用 `Capacitor.isNativePlatform()` 判断平台。
  - CSS 使用 `-webkit-` 前缀。
  - 避免使用 iOS 不支持的 API（如 WebGL 2.0 部分特性）。

### Q12: 什么是 V8 引擎的 JIT 编译？项目中如何优化 JS 执行效率？
- **JIT**: Just-In-Time 编译，将热点代码编译为机器码。
- **优化**:
  - 减少原型链查找，使用 `const` 声明。
  - 避免频繁的对象属性增删。
  - 使用 WebAssembly 处理计算密集型任务。

## 5. 安全与权限

### Q13: 项目中如何处理权限申请？用户拒绝后如何引导？
- **权限类型**: 相机、麦克风、存储、位置等。
- **处理**:
  - 使用 `@capacitor-community/barcode-scanner` 等插件。
  - 用户拒绝后展示说明弹窗，引导到系统设置。
- **最佳实践**: 首次使用时申请，而非应用启动时。

### Q14: 项目中如何保证数据传输的安全性？
- **HTTPS**: 所有网络请求使用 HTTPS。
- **Token 验证**: 使用 JWT 或自定义 Token 方案。
- **数据加密**: 敏感数据使用 CryptoJS 加密存储。

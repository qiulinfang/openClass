# WebView 开发面试题

### Q1: WebView 与原生应用通信的常用方式有哪些？
- **JSBridge (核心机制)**:
  - **注入 API**: 原生通过 `addJavascriptInterface` (Android) 或 `WKUserScript` (iOS) 向 JS 环境注入全局对象。
  - **URL Schema 拦截**: JS 触发特定格式的 URL 跳转（如 `imates://camera?id=123`），原生层拦截请求并执行逻辑。
  - **消息处理**: iOS 使用 `window.webkit.messageHandlers`，Android 现代做法是使用自定义的 `WebChromeClient.onJsPrompt`。
- **原生调用 JS**: 原生直接执行 JS 字符串，如 `webView.evaluateJavascript("callback('data')")`。

### Q2: WebView 常见的性能优化手段有哪些？
- **加载优化**:
  - **容器预热**: 在应用启动或空闲时预先初始化 WebView 实例，减少首次打开的白屏时间。
  - **离线包 (Offline Package)**: 将 HTML/JS/CSS/图片等静态资源打包下载到本地，拦截 WebView 请求并重定向到本地文件。
  - **预加载**: 在列表页预先加载详情页的 URL 数据。
- **渲染优化**:
  - **硬件加速**: 开启 WebView 的硬件加速以提升滚动和动画性能。
  - **图片延迟加载**: 对于非视口区域的图片使用懒加载。
- **资源缓存**: 合理配置 `Cache-Control` 和使用 Service Worker 进行精细化缓存控制。

### Q3: 如何处理 WebView 中的白屏问题？
- **原因分析**:
  - 网络错误或服务器响应慢。
  - 资源加载阻塞（如大体积 JS 运行）。
  - WebView 渲染进程崩溃（OOM）。
- **监控与防护**:
  - **白屏检测**: 通过定时检查 DOM 节点是否存在或使用 `requestAnimationFrame` 记录首屏时间。
  - **容错处理**: 监听 `onReceivedError` 或 `onRenderProcessGone`，在白屏时展示本地兜底页或自动重试。
  - **分段加载**: 先渲染基础 HTML 骨架，异步加载动态内容。

### Q4: WebView 中的安全性问题及防范措施？
- **远程代码执行**: 
  - Android 4.2 以下 `addJavascriptInterface` 存在漏洞，应使用 `@JavascriptInterface` 注解。
- **域名白名单**: 
  - 限制 JSBridge 仅在信任的域名下生效，防止第三方非法网页调用原生权限（如摄像头、定位）。
- **HTTPS 强校验**: 
  - 禁止 WebView 加载非法证书或明文 HTTP 链接。
- **XSS 防护**: 
  - 在 JSBridge 传输数据时进行严格的字符过滤和转义。

### Q5: 在本项目中，WebView 是如何处理 MPA（多页应用）路由跳转的？
- **路径兼容**: 
  - 处理以 `/` 开头的相对路径，自动补全基础域名（如 `https://www.imates.com.cn/openClass`）。
- **拦截控制**: 
  - 通过 `shouldOverrideUrlLoading` 拦截 URL。
  - 如果是内链，则在当前 WebView 加载；如果是特定业务逻辑（如打开 PDF、打开扫码），则跳转到相应的原生 Activity。
- **状态保持**: 
  - 在页面跳转时，通过 URL 参数或 `sessionStorage` 传递必要的用户认证（Token）和业务状态。

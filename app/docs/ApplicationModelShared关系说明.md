# ApplicationModelShared、WebAppInterface 和 MainWebViewActivity 关系说明

## 📋 概述

这三个类构成了 Android 应用的核心架构，它们之间的关系如下：

```
ApplicationModelShared (Application)
    ↓ (应用启动时初始化)
MainWebViewActivity (Activity)
    ↓ (创建并绑定)
WebAppInterface (JavaScript 桥接)
    ↓ (暴露给 WebView)
JavaScript (Vue.js 前端)
```

---

## 1. ApplicationModelShared

### 定义
- **类型**: `Application` 类（继承自 `android.app.Application`）
- **作用**: 应用的全局单例，生命周期贯穿整个应用
- **位置**: `com.cosinetech.imates.ApplicationModelShared`

### 主要职责

#### 1.1 应用启动时的全局初始化
```java
@Override
public void onCreate() {
    super.onCreate();
    appInstance = this;
    
    // ✅ 关键：初始化应用环境配置（必须在其他初始化之前）
    AppEnvConfig.checkAndUpdateVersion(this);
    // 这会调用 ApiUrl.switchEnv() 设置 RabbitMQ 配置
    // MQ_HOST_BASE = "www.imates.com.cn"
    // MQ_HOST_PORT = 5673
    
    // 启用 WebView 调试
    WebView.setWebContentsDebuggingEnabled(true);
    
    // 初始化 Glide 图片加载库
    Glide.get(this);
    
    // 拷贝资源文件
    AssetsCopyUtils.copyAssetsToDocuments(this);
    
    // 初始化屏幕投屏相关服务
    UdpForwarderManager.getInstance().start();
    H264MpegTSStreamerManager.getInstance();
    H264IFrameCache.getInstance();
    
    // 初始化 Kiosk 模式管理器
    KioskManager.getInstance().initialize(this);
    
    // 启动监控服务
    startAppMonitorService();
}
```

#### 1.2 生命周期管理
- 监听所有 Activity 的生命周期
- 当所有 Activity 销毁时，清理资源

#### 1.3 提供全局单例访问
```java
public static ApplicationModelShared getInstance() {
    return appInstance;
}
```

#### 1.4 ViewModel 存储
- 实现 `ViewModelStoreOwner` 接口
- 为应用提供全局 ViewModel 存储空间

---

## 2. MainWebViewActivity

### 定义
- **类型**: `AppCompatActivity`（Activity）
- **作用**: 主 WebView 容器，承载整个 Vue.js 前端应用
- **位置**: `com.cosinetech.imates.ui.webview.MainWebViewActivity`

### 主要职责

#### 2.1 创建和管理 WebView
```java
private void initWebView() {
    webView = findViewById(R.id.main_webview);
    
    // 配置 WebView
    WebViewConfig.configureWebView(webView, this);
    
    // ✅ 关键：创建 WebAppInterface 并绑定到 WebView
    webAppInterface = new WebAppInterface(this);
    webAppInterface.setExerciseBridge(this);
    webAppInterface.setImageLaunchers(imagePickLauncher, imageCaptureLauncher);
    webAppInterface.setCameraPermissionLauncher(cameraPermissionLauncher);
    webAppInterface.setAudioPermissionLauncher(audioPermissionLauncher);
    webAppInterface.setWebView(webView);
    
    // 将 WebAppInterface 暴露给 JavaScript，命名为 "AndroidBridge"
    webView.addJavascriptInterface(webAppInterface, "AndroidBridge");
    
    // 设置 WebViewClient
    webView.setWebViewClient(new MainWebViewClient());
}
```

#### 2.2 加载 Vue.js 前端应用
```java
private void loadWebApp() {
    // 默认加载本地打包的 Vue.js 应用
    webAppUrl = "file:///android_asset/webapp/index.html";
    webView.loadUrl(webAppUrl);
}
```

#### 2.3 处理 Activity Result
- 图片选择、拍照、权限请求等结果处理
- 通过 `ActivityResultLauncher` 传递给 `WebAppInterface`

#### 2.4 监听键盘事件
- 检测键盘弹出/隐藏
- 通过 JavaScript 事件通知前端

#### 2.5 预初始化 MessagingManager
```java
private void initMessagingManagerOnStartup() {
    String userId = AppUtils.getUserId();
    if (userId != null && !userId.isEmpty()) {
        // 通过 WebAppInterface 初始化 RabbitMQ 连接
        webAppInterface.initTeacherMessageListener();
    }
}
```

---

## 3. WebAppInterface

### 定义
- **类型**: JavaScript 桥接类（使用 `@JavascriptInterface` 注解）
- **作用**: Java 和 JavaScript 之间的通信桥梁
- **位置**: `com.cosinetech.imates.ui.webview.common.WebAppInterface`

### 主要职责

#### 3.1 暴露 Java 方法给 JavaScript
```java
@JavascriptInterface
public String sendTextMessageToTeacher(String content, String sessionId, String subject) {
    // 前端调用：window.AndroidBridge.sendTextMessageToTeacher(...)
    // 实现发送消息给老师的逻辑
}
```

#### 3.2 主要功能模块

##### 3.2.1 消息发送功能
- `sendTextMessageToTeacher()` - 发送文本消息
- `sendVoiceMessageToTeacher()` - 发送语音消息
- `sendImageMessageToTeacher()` - 发送图片消息

##### 3.2.2 RabbitMQ 消息监听
- `initTeacherMessageListener()` - 初始化消息监听器
- 接收老师回复的消息并转发给前端

##### 3.2.3 图片处理
- `pickImage()` - 选择图片
- `captureImage()` - 拍照
- `handleImagePickResult()` - 处理图片选择结果

##### 3.2.4 语音处理
- `startRecording()` - 开始录音
- `stopRecording()` - 停止录音
- `playAudio()` - 播放音频

#### 3.3 使用 ApplicationModelShared 的配置
```java
// WebAppInterface 通过 ApplicationModelShared 获取的配置
// 这些配置在 ApplicationModelShared.onCreate() 中已经初始化
ApiUrl.MQ_HOST_BASE  // RabbitMQ 主机地址
ApiUrl.MQ_HOST_PORT  // RabbitMQ 端口号
```

---

## 🔄 三者关系图

```
┌─────────────────────────────────────────────────────────┐
│  ApplicationModelShared (Application)                   │
│  - 应用启动时初始化全局配置                               │
│  - AppEnvConfig.checkAndUpdateVersion()                 │
│  - 设置 ApiUrl.MQ_HOST_BASE 和 MQ_HOST_PORT            │
│  - 初始化其他全局服务                                     │
└─────────────────────────────────────────────────────────┘
                          ↓
                          │ (应用启动)
                          │
┌─────────────────────────────────────────────────────────┐
│  MainWebViewActivity (Activity)                         │
│  - onCreate() 时创建 WebView                            │
│  - 创建 WebAppInterface 实例                            │
│  - 将 WebAppInterface 绑定到 WebView                    │
│  - 加载 Vue.js 前端应用                                  │
└─────────────────────────────────────────────────────────┘
                          ↓
                          │ (创建并绑定)
                          │
┌─────────────────────────────────────────────────────────┐
│  WebAppInterface (JavaScript Bridge)                    │
│  - 暴露方法给 JavaScript (window.AndroidBridge)         │
│  - 处理前端请求（发送消息、选择图片等）                   │
│  - 使用 ApplicationModelShared 初始化的配置            │
│  - 通过 RabbitMQ 发送/接收消息                           │
└─────────────────────────────────────────────────────────┘
                          ↓
                          │ (JavaScript 调用)
                          │
┌─────────────────────────────────────────────────────────┐
│  Vue.js 前端 (JavaScript)                                │
│  - window.AndroidBridge.sendTextMessageToTeacher()      │
│  - window.AndroidBridge.pickImage()                     │
│  - 接收来自 WebAppInterface 的消息                       │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 关键调用链示例

### 示例 1: 发送消息给老师

```
1. Vue.js 前端调用
   window.AndroidBridge.sendTextMessageToTeacher(content, sessionId, subject)
   
2. WebAppInterface.sendTextMessageToTeacher() 被调用
   - 验证用户登录
   - 检查 MessagingManager 是否初始化
   - 如果未初始化，自动初始化（使用 ApplicationModelShared 设置的配置）
   
3. MessagingManager.sendMessageToTeacher()
   - 使用 ApiUrl.MQ_HOST_BASE 和 MQ_HOST_PORT（已在 ApplicationModelShared 中设置）
   - 通过 RabbitMQ 发送消息
   
4. 返回结果给前端
   - 成功：返回 messageId
   - 失败：返回错误信息
```

### 示例 2: 应用启动流程

```
1. 应用启动
   ApplicationModelShared.onCreate()
   ├─ AppEnvConfig.checkAndUpdateVersion(this)
   │   └─ ApiUrl.switchEnv() 设置 RabbitMQ 配置
   ├─ 初始化其他全局服务
   └─ 保存 appInstance

2. MainWebViewActivity.onCreate()
   ├─ 创建 WebView
   ├─ 创建 WebAppInterface(this)
   ├─ 绑定到 WebView: webView.addJavascriptInterface(webAppInterface, "AndroidBridge")
   └─ 加载 Vue.js 应用: webView.loadUrl("file:///android_asset/webapp/index.html")

3. Vue.js 应用加载完成
   MainWebViewActivity.onWebAppReady()
   └─ initMessagingManagerOnStartup()
       └─ webAppInterface.initTeacherMessageListener()
           └─ 使用 ApplicationModelShared 设置的配置初始化 RabbitMQ
```

---

## 🔑 关键点总结

### 1. ApplicationModelShared 的作用
- ✅ **全局配置初始化**：在应用启动时设置 RabbitMQ 配置（HOST 和 PORT）
- ✅ **生命周期管理**：管理应用级别的资源
- ✅ **单例访问**：提供全局实例访问

### 2. MainWebViewActivity 的作用
- ✅ **WebView 容器**：承载 Vue.js 前端应用
- ✅ **创建桥接**：创建 `WebAppInterface` 并绑定到 WebView
- ✅ **生命周期管理**：管理 Activity 级别的资源

### 3. WebAppInterface 的作用
- ✅ **JavaScript 桥接**：连接 Java 和 JavaScript
- ✅ **功能实现**：实现消息发送、图片选择等功能
- ✅ **使用配置**：使用 `ApplicationModelShared` 初始化的配置

### 4. 配置传递链
```
ApplicationModelShared.onCreate()
    ↓
AppEnvConfig.checkAndUpdateVersion()
    ↓
ApiUrl.switchEnv()
    ↓
设置 ApiUrl.MQ_HOST_BASE 和 MQ_HOST_PORT
    ↓
WebAppInterface.sendTextMessageToTeacher()
    ↓
RabbitMQManager.initialize() 使用这些配置
```

---

## 🐛 常见问题

### Q1: 为什么 RabbitMQ 连接失败？
**A**: 检查 `ApplicationModelShared.onCreate()` 是否调用了 `AppEnvConfig.checkAndUpdateVersion(this)`。如果没有，`ApiUrl.MQ_HOST_BASE` 和 `MQ_HOST_PORT` 可能为 `null` 或 `0`。

### Q2: WebAppInterface 如何获取 Context？
**A**: `WebAppInterface` 通过构造函数接收 `Context`，在 `MainWebViewActivity` 中创建时传入 `this`（Activity 本身就是 Context）。

### Q3: 如何访问 ApplicationModelShared？
**A**: 通过静态方法 `ApplicationModelShared.getInstance()` 获取全局实例。

### Q4: 为什么 WebAppInterface 可以使用 ApiUrl 的配置？
**A**: `ApiUrl` 的静态字段在 `ApplicationModelShared.onCreate()` 中已经被初始化，`WebAppInterface` 可以直接访问。

---

## 📚 相关文件

- `ApplicationModelShared.java` - 应用全局类
- `MainWebViewActivity.java` - 主 WebView Activity
- `WebAppInterface.java` - JavaScript 桥接类
- `AppEnvConfig.java` - 环境配置管理
- `ApiUrl.java` - API URL 和 RabbitMQ 配置
- `MessagingManager.java` - RabbitMQ 消息管理
- `RabbitMQManager.java` - RabbitMQ 连接管理


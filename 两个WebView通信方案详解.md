# 应用内 WebView 与悬浮窗 WebView 通信方案详解

## 通信架构概览

```
┌─────────────────────────────────────────────────────────┐
│                 应用内 WebView                           │
│  (MainWebViewActivity)                                    │
│                                                           │
│  JavaScript ↔ AndroidBridge (WebAppInterface)            │
└────────────────┬─────────────────────────────────────────┘
                 │
                 │ 通过共享通信管理器
                 │
┌────────────────▼─────────────────────────────────────────┐
│            WebViewCommunicationManager                    │
│            (共享单例/服务管理器)                          │
│  • 管理两个 WebView 的引用                                 │
│  • 提供双向通信方法                                        │
│  • 事件分发与回调                                          │
└────────────────┬─────────────────────────────────────────┘
                 │
                 │ 通过共享通信管理器
                 │
┌────────────────▼─────────────────────────────────────────┐
│             悬浮窗 WebView                                │
│  (FloatingWebViewService)                                │
│                                                           │
│  JavaScript ↔ FloatingAndroidBridge (WebViewInterface)   │
└──────────────────────────────────────────────────────────┘
```

## 方案一：共享通信管理器（推荐）⭐

### 1.1 架构设计

创建一个单例管理器，同时持有两个 WebView 的引用，并提供双向通信方法。

### 1.2 实现代码

#### Step 1: 创建共享通信管理器

```java
package com.cosinetech.imates.ui.webview.communication;

import android.app.Activity;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;
import java.util.concurrent.ConcurrentHashMap;
import java.util.ArrayList;
import java.util.List;

/**
 * WebView 通信管理器
 * 管理应用内 WebView 和悬浮窗 WebView 之间的通信
 */
public class WebViewCommunicationManager {
    private static final String TAG = "WebViewCommManager";
    private static WebViewCommunicationManager instance;
    
    // 应用内 WebView 引用
    private WebView mainWebView;
    private Context mainContext;
    
    // 悬浮窗 WebView 引用
    private WebView floatingWebView;
    private Context floatingContext;
    
    // 消息队列（用于存储未连接的 WebView 的消息）
    private final ConcurrentHashMap<String, List<Message>> messageQueues = new ConcurrentHashMap<>();
    
    // 消息监听器
    private final List<MessageListener> listeners = new ArrayList<>();
    
    // UI 线程 Handler
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    
    /**
     * 消息结构
     */
    public static class Message {
        public String type;           // 消息类型
        public String action;          // 动作
        public JSONObject data;        // 数据
        public String from;            // 来源: "main" | "floating"
        public long timestamp;         // 时间戳
        
        public Message(String type, String action, JSONObject data, String from) {
            this.type = type;
            this.action = action;
            this.data = data;
            this.from = from;
            this.timestamp = System.currentTimeMillis();
        }
    }
    
    /**
     * 消息监听器接口
     */
    public interface MessageListener {
        void onMessage(Message message);
    }
    
    private WebViewCommunicationManager() {
    }
    
    public static synchronized WebViewCommunicationManager getInstance() {
        if (instance == null) {
            instance = new WebViewCommunicationManager();
        }
        return instance;
    }
    
    /**
     * 注册应用内 WebView
     */
    public void registerMainWebView(WebView webView, Context context) {
        this.mainWebView = webView;
        this.mainContext = context;
        Log.d(TAG, "✅ 注册应用内 WebView");
        
        // 发送队列中的消息
        processQueuedMessages("floating");
    }
    
    /**
     * 注册悬浮窗 WebView
     */
    public void registerFloatingWebView(WebView webView, Context context) {
        this.floatingWebView = webView;
        this.floatingContext = context;
        Log.d(TAG, "✅ 注册悬浮窗 WebView");
        
        // 发送队列中的消息
        processQueuedMessages("main");
    }
    
    /**
     * 向应用内 WebView 发送消息
     */
    public void sendToMainWebView(String type, String action, JSONObject data) {
        if (mainWebView != null && mainContext != null) {
            sendJavaScript(mainWebView, mainContext, type, action, data);
        } else {
            // WebView 未连接，存入队列
            queueMessage("main", type, action, data);
            Log.w(TAG, "⚠️ 应用内 WebView 未连接，消息已入队");
        }
    }
    
    /**
     * 向悬浮窗 WebView 发送消息
     */
    public void sendToFloatingWebView(String type, String action, JSONObject data) {
        if (floatingWebView != null && floatingContext != null) {
            sendJavaScript(floatingWebView, floatingContext, type, action, data);
        } else {
            // WebView 未连接，存入队列
            queueMessage("floating", type, action, data);
            Log.w(TAG, "⚠️ 悬浮窗 WebView 未连接，消息已入队");
        }
    }
    
    /**
     * 发送 JavaScript 消息
     */
    private void sendJavaScript(WebView webView, Context context, 
            String type, String action, JSONObject data) {
        mainHandler.post(() -> {
            try {
                String dataStr = data != null ? data.toString() : "{}";
                String script = String.format(
                    "if (window.onWebViewMessage) {" +
                    "  window.onWebViewMessage(%s, %s, %s);" +
                    "}",
                    escapeJavaScript(type),
                    escapeJavaScript(action),
                    escapeJavaScript(dataStr)
                );
                
                if (context instanceof Activity) {
                    ((Activity) context).runOnUiThread(() -> {
                        webView.evaluateJavascript(script, null);
                    });
                } else {
                    mainHandler.post(() -> {
                        webView.evaluateJavascript(script, null);
                    });
                }
                
                Log.d(TAG, "📤 发送消息: " + type + "/" + action);
            } catch (Exception e) {
                Log.e(TAG, "❌ 发送消息失败", e);
            }
        });
    }
    
    /**
     * 处理队列中的消息
     */
    private void processQueuedMessages(String target) {
        List<Message> queue = messageQueues.get(target);
        if (queue != null && !queue.isEmpty()) {
            Log.d(TAG, "📬 处理队列中的 " + queue.size() + " 条消息");
            for (Message msg : queue) {
                if ("main".equals(target)) {
                    sendToMainWebView(msg.type, msg.action, msg.data);
                } else {
                    sendToFloatingWebView(msg.type, msg.action, msg.data);
                }
            }
            queue.clear();
        }
    }
    
    /**
     * 将消息存入队列
     */
    private void queueMessage(String target, String type, String action, JSONObject data) {
        messageQueues.computeIfAbsent(target, k -> new ArrayList<>())
            .add(new Message(type, action, data, "main".equals(target) ? "floating" : "main"));
    }
    
    /**
     * 注销 WebView
     */
    public void unregisterMainWebView() {
        this.mainWebView = null;
        this.mainContext = null;
        Log.d(TAG, "❌ 注销应用内 WebView");
    }
    
    public void unregisterFloatingWebView() {
        this.floatingWebView = null;
        this.floatingContext = null;
        Log.d(TAG, "❌ 注销悬浮窗 WebView");
    }
    
    /**
     * 添加消息监听器
     */
    public void addMessageListener(MessageListener listener) {
        listeners.add(listener);
    }
    
    /**
     * 移除消息监听器
     */
    public void removeMessageListener(MessageListener listener) {
        listeners.remove(listener);
    }
    
    private String escapeJavaScript(String str) {
        return "\"" + str.replace("\\", "\\\\")
                       .replace("\"", "\\\"")
                       .replace("\n", "\\n")
                       .replace("\r", "\\r") + "\"";
    }
}
```

#### Step 2: 在应用内 WebView 的 JavaScriptInterface 中添加通信方法

```java
// 在 WebAppInterface.java 中添加

import com.cosinetech.imates.ui.webview.communication.WebViewCommunicationManager;
import org.json.JSONObject;

public class WebAppInterface {
    // ... 现有代码 ...
    
    private WebViewCommunicationManager commManager;
    
    public WebAppInterface(Context c) {
        mContext = c;
        commManager = WebViewCommunicationManager.getInstance();
        
        // 注册应用内 WebView（在 setWebView 中调用）
    }
    
    public void setWebView(WebView webView) {
        this.webView = webView;
        
        // 注册到通信管理器
        if (commManager != null) {
            commManager.registerMainWebView(webView, mContext);
        }
    }
    
    /**
     * 向悬浮窗 WebView 发送消息
     */
    @JavascriptInterface
    public void sendToFloatingWindow(String type, String action, String dataJson) {
        try {
            JSONObject data = dataJson != null && !dataJson.isEmpty() 
                ? new JSONObject(dataJson) : new JSONObject();
            
            commManager.sendToFloatingWebView(type, action, data);
            Log.d(TAG, "📤 [Main] 发送消息到悬浮窗: " + type + "/" + action);
        } catch (Exception e) {
            Log.e(TAG, "❌ [Main] 发送消息失败", e);
        }
    }
    
    /**
     * 接收来自悬浮窗的消息（由通信管理器调用）
     */
    public void onMessageFromFloating(String type, String action, JSONObject data) {
        // 这个方法会被通信管理器调用
        // 实际的消息分发通过 JavaScript 回调完成
    }
}
```

#### Step 3: 在悬浮窗 WebView 的 JavaScriptInterface 中添加通信方法

```java
// 在 FloatingWebViewService.java 中

public class FloatingWebViewService extends Service {
    private WebView webView;
    private WebViewCommunicationManager commManager;
    
    @SuppressLint("SetJavaScriptEnabled")
    private void createFloatingWebView() {
        // ... 创建悬浮窗的代码 ...
        
        // 获取 WebView 并配置
        webView = floatingWebViewContainer.findViewById(R.id.webview);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        
        // 获取通信管理器
        commManager = WebViewCommunicationManager.getInstance();
        
        // 添加 JavaScript 接口
        webView.addJavascriptInterface(new FloatingWebViewInterface(), "FloatingBridge");
        
        // 注册悬浮窗 WebView
        commManager.registerFloatingWebView(webView, this);
        
        // 加载内容
        webView.loadUrl("https://example.com/floating.html");
    }
    
    /**
     * 悬浮窗 WebView 的 JavaScript 接口
     */
    public class FloatingWebViewInterface {
        /**
         * 向应用内 WebView 发送消息
         */
        @JavascriptInterface
        public void sendToMainWebView(String type, String action, String dataJson) {
            try {
                JSONObject data = dataJson != null && !dataJson.isEmpty() 
                    ? new JSONObject(dataJson) : new JSONObject();
                
                commManager.sendToMainWebView(type, action, data);
                Log.d(TAG, "📤 [Floating] 发送消息到主应用: " + type + "/" + action);
            } catch (Exception e) {
                Log.e(TAG, "❌ [Floating] 发送消息失败", e);
            }
        }
        
        /**
         * 关闭悬浮窗
         */
        @JavascriptInterface
        public void closeWindow() {
            runOnUiThread(() -> closeFloatingWebView());
        }
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        if (commManager != null) {
            commManager.unregisterFloatingWebView();
        }
        closeFloatingWebView();
    }
    
    private void runOnUiThread(Runnable runnable) {
        new Handler(Looper.getMainLooper()).post(runnable);
    }
}
```

#### Step 4: JavaScript 端使用示例

**应用内 WebView 的 JavaScript:**

```javascript
// 监听来自悬浮窗的消息
window.onWebViewMessage = function(type, action, data) {
    console.log('[Main] 收到消息:', type, action, data);
    
    try {
        const messageData = typeof data === 'string' ? JSON.parse(data) : data;
        
        switch (type) {
            case 'chat':
                if (action === 'new_message') {
                    handleNewMessage(messageData);
                }
                break;
                
            case 'update':
                if (action === 'status_change') {
                    updateStatus(messageData);
                }
                break;
                
            default:
                console.warn('[Main] 未知消息类型:', type);
        }
    } catch (error) {
        console.error('[Main] 处理消息失败:', error);
    }
};

// 向悬浮窗发送消息
function sendToFloatingWindow(type, action, data) {
    if (window.AndroidBridge && window.AndroidBridge.sendToFloatingWindow) {
        window.AndroidBridge.sendToFloatingWindow(type, action, JSON.stringify(data));
    } else {
        console.warn('[Main] AndroidBridge 未初始化');
    }
}

// 使用示例
function notifyFloatingWindowNewChat(message) {
    sendToFloatingWindow('chat', 'new_message', {
        id: message.id,
        content: message.content,
        timestamp: Date.now()
    });
}
```

**悬浮窗 WebView 的 JavaScript:**

```javascript
// 监听来自主应用的消息
window.onWebViewMessage = function(type, action, data) {
    console.log('[Floating] 收到消息:', type, action, data);
    
    try {
        const messageData = typeof data === 'string' ? JSON.parse(data) : data;
        
        switch (type) {
            case 'chat':
                if (action === 'message_sent') {
                    updateMessageStatus(messageData);
                }
                break;
                
            case 'sync':
                if (action === 'state_update') {
                    syncState(messageData);
                }
                break;
                
            default:
                console.warn('[Floating] 未知消息类型:', type);
        }
    } catch (error) {
        console.error('[Floating] 处理消息失败:', error);
    }
};

// 向主应用发送消息
function sendToMainWebView(type, action, data) {
    if (window.FloatingBridge && window.FloatingBridge.sendToMainWebView) {
        window.FloatingBridge.sendToMainWebView(type, action, JSON.stringify(data));
    } else {
        console.warn('[Floating] FloatingBridge 未初始化');
    }
}

// 使用示例
function notifyMainAppMessageRead(messageId) {
    sendToMainWebView('chat', 'message_read', {
        messageId: messageId,
        timestamp: Date.now()
    });
}

// 关闭悬浮窗
function closeFloatingWindow() {
    if (window.FloatingBridge && window.FloatingBridge.closeWindow) {
        window.FloatingBridge.closeWindow();
    }
}
```

### 1.3 优点

- ✅ **双向通信**: 支持两个 WebView 之间的双向消息传递
- ✅ **解耦设计**: 两个 WebView 不需要直接持有对方的引用
- ✅ **消息队列**: 支持在 WebView 未连接时缓存消息
- ✅ **类型安全**: 通过消息类型和动作进行分类
- ✅ **易于扩展**: 可以轻松添加新的消息类型

### 1.4 使用场景示例

```javascript
// 场景1: 应用内发送聊天消息，通知悬浮窗更新
function sendChatMessage(content) {
    // 发送到服务器
    api.sendMessage(content).then(() => {
        // 通知悬浮窗更新
        sendToFloatingWindow('chat', 'message_sent', {
            content: content,
            timestamp: Date.now()
        });
    });
}

// 场景2: 悬浮窗接收到新消息，通知主应用
function onNewMessageReceived(message) {
    // 更新悬浮窗 UI
    updateFloatingUI(message);
    
    // 通知主应用
    sendToMainWebView('chat', 'new_message', message);
}

// 场景3: 同步状态
function syncUserStatus(status) {
    sendToFloatingWindow('sync', 'user_status', {
        isOnline: status.online,
        lastActive: status.lastActive
    });
}
```

---

## 方案二：BroadcastReceiver 广播通信

### 2.1 实现原理

通过 Android 的 BroadcastReceiver 机制，在两个 WebView 之间发送广播消息。

### 2.2 实现代码

```java
// 在 AndroidManifest.xml 中注册
<receiver android:name=".ui.webview.communication.WebViewBroadcastReceiver"
    android:exported="false">
    <intent-filter>
        <action android:name="com.cosinetech.imates.WEBVIEW_MESSAGE" />
    </intent-filter>
</receiver>

// WebViewBroadcastReceiver.java
public class WebViewBroadcastReceiver extends BroadcastReceiver {
    private static final String TAG = "WebViewBroadcast";
    private WebView webView;
    private Context context;
    
    public void setWebView(WebView webView, Context context) {
        this.webView = webView;
        this.context = context;
    }
    
    @Override
    public void onReceive(Context context, Intent intent) {
        String type = intent.getStringExtra("type");
        String action = intent.getStringExtra("action");
        String data = intent.getStringExtra("data");
        String source = intent.getStringExtra("source");
        
        // 避免自己接收自己的消息
        if ("main".equals(source) && this.webView == getMainWebView()) {
            return;
        }
        if ("floating".equals(source) && this.webView == getFloatingWebView()) {
            return;
        }
        
        // 发送到 WebView
        String script = String.format(
            "if (window.onWebViewMessage) {" +
            "  window.onWebViewMessage('%s', '%s', %s);" +
            "}",
            type, action, data
        );
        
        if (context instanceof Activity) {
            ((Activity) context).runOnUiThread(() -> {
                webView.evaluateJavascript(script, null);
            });
        }
    }
}

// 发送广播
public void sendBroadcastMessage(String type, String action, JSONObject data, String source) {
    Intent intent = new Intent("com.cosinetech.imates.WEBVIEW_MESSAGE");
    intent.putExtra("type", type);
    intent.putExtra("action", action);
    intent.putExtra("data", data.toString());
    intent.putExtra("source", source);
    context.sendBroadcast(intent);
}
```

### 2.3 优缺点

**优点**:
- ✅ 解耦，不需要直接引用
- ✅ Android 原生机制，稳定可靠

**缺点**:
- ❌ 性能相对较低（广播机制开销）
- ❌ 需要注册 BroadcastReceiver
- ❌ 可能被系统或其他应用拦截

---

## 方案三：SharedPreferences 轮询（不推荐）

### 3.1 实现原理

通过 SharedPreferences 存储消息，另一个 WebView 定时轮询读取。

### 3.2 实现代码

```java
// 写入消息
public void saveMessage(String type, String action, JSONObject data) {
    SharedPreferences prefs = context.getSharedPreferences("webview_comm", Context.MODE_PRIVATE);
    String key = "message_" + System.currentTimeMillis();
    prefs.edit()
        .putString(key + "_type", type)
        .putString(key + "_action", action)
        .putString(key + "_data", data.toString())
        .commit();
}

// JavaScript 定时轮询
setInterval(() => {
    if (window.AndroidBridge && window.AndroidBridge.checkNewMessages) {
        const messages = window.AndroidBridge.checkNewMessages();
        if (messages && messages.length > 0) {
            messages.forEach(msg => {
                handleMessage(msg);
            });
        }
    }
}, 500); // 每 500ms 轮询一次
```

### 3.3 优缺点

**优点**:
- ✅ 实现简单

**缺点**:
- ❌ 性能差（定时轮询）
- ❌ 实时性差（有延迟）
- ❌ 需要手动清理旧消息
- ❌ 不适合频繁通信

---

## 方案四：EventBus（可选方案）

### 4.1 实现原理

使用 EventBus（如 Google 的 EventBus 或 RxJava）实现事件分发。

### 4.2 实现代码

```java
// 添加依赖: implementation 'org.greenrobot:eventbus:3.3.1'

// 定义消息事件
public class WebViewMessageEvent {
    public String type;
    public String action;
    public JSONObject data;
    public String source; // "main" | "floating"
}

// 发送事件
EventBus.getDefault().post(new WebViewMessageEvent("chat", "new_message", data, "main"));

// 接收事件
@Subscribe(threadMode = ThreadMode.MAIN)
public void onWebViewMessage(WebViewMessageEvent event) {
    // 避免自己接收自己的消息
    if (isSelfEvent(event)) {
        return;
    }
    
    // 发送到 WebView
    sendToWebView(event);
}
```

### 4.3 优缺点

**优点**:
- ✅ 解耦，易于扩展
- ✅ 支持线程切换
- ✅ 性能较好

**缺点**:
- ❌ 需要引入第三方库
- ❌ 增加项目依赖

---

## 性能对比

| 方案 | 实时性 | 性能 | 实现复杂度 | 推荐度 |
|------|--------|------|-----------|--------|
| 共享管理器 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| BroadcastReceiver | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| SharedPreferences | ⭐ | ⭐ | ⭐ | ⭐ |
| EventBus | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

## 推荐方案总结

### 🏆 最佳方案：共享通信管理器（方案一）

**适用场景**:
- ✅ 需要双向实时通信
- ✅ 消息频率较高
- ✅ 需要消息队列支持
- ✅ 需要类型化的消息系统

**实现要点**:
1. 创建单例通信管理器
2. 两个 WebView 分别注册到管理器
3. 通过管理器转发消息
4. JavaScript 端实现统一的消息监听接口

### 📝 完整使用流程

```javascript
// 1. 应用内 WebView 初始化时
window.onWebViewMessage = function(type, action, data) {
    // 处理来自悬浮窗的消息
};

// 2. 悬浮窗 WebView 初始化时
window.onWebViewMessage = function(type, action, data) {
    // 处理来自主应用的消息
};

// 3. 发送消息
// 从主应用发送到悬浮窗
window.AndroidBridge.sendToFloatingWindow('chat', 'new_message', JSON.stringify(data));

// 从悬浮窗发送到主应用
window.FloatingBridge.sendToMainWebView('chat', 'message_read', JSON.stringify(data));
```

## 注意事项

1. **线程安全**: 所有 WebView 操作必须在主线程
2. **内存管理**: 及时注销 WebView 引用，避免内存泄漏
3. **消息格式**: 统一消息格式（type/action/data）
4. **错误处理**: 添加异常处理和日志记录
5. **生命周期**: 在 WebView 销毁时清理通信管理器

## 扩展功能

### 1. 消息确认机制

```java
// 添加消息 ID 和确认机制
public void sendMessageWithAck(String messageId, String type, String action, JSONObject data) {
    // 发送消息
    sendMessage(type, action, data);
    
    // 等待确认
    waitForAck(messageId, 5000, () -> {
        // 超时重发或失败处理
    });
}
```

### 2. 消息持久化

```java
// 重要消息持久化到数据库
public void sendPersistentMessage(String type, String action, JSONObject data) {
    // 保存到数据库
    saveToDatabase(type, action, data);
    
    // 发送消息
    sendMessage(type, action, data);
}
```

### 3. 消息优先级

```java
// 添加优先级队列
private PriorityQueue<Message> highPriorityQueue = new PriorityQueue<>();

public void sendHighPriorityMessage(String type, String action, JSONObject data) {
    highPriorityQueue.offer(new Message(type, action, data, HIGH_PRIORITY));
    processPriorityQueue();
}
```

---

## 总结

**推荐使用方案一（共享通信管理器）**，它提供了：
- ✅ 双向实时通信
- ✅ 消息队列支持
- ✅ 类型化的消息系统
- ✅ 良好的扩展性
- ✅ 无需第三方依赖

这个方案最适合应用内 WebView 和悬浮窗 WebView 之间的通信需求。


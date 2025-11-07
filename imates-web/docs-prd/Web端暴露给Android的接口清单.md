# Web端暴露给Android的接口清单

## 📋 概述

Web端通过两种方式与Android原生端通信：

1. **Android调用Web的接口**：通过`window.AndroidBridge`对象暴露的方法（Android端通过`addJavascriptInterface`注入）
2. **Web设置的回调函数**：Web端在`window`对象上设置的全局回调函数（Android端通过`evaluateJavascript`调用）

---

## 🔧 方式一：Android调用Web的接口（window.AndroidBridge）

这些接口由Android端通过`addJavascriptInterface`注入到`window.AndroidBridge`对象，Web端可以直接调用。

### 1. 基础功能

| 接口名称 | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `showToast(message: string)` | `message`: 提示消息 | `void` | 显示Android原生Toast |
| `showNotification(message: string, type: string)` | `message`: 通知内容<br>`type`: 通知类型(success/error/warning/info) | `void` | 显示Android原生通知 |
| `getUserToken()` | 无 | `string` | 获取用户Token |
| `getUserInfo()` | 无 | `JSONString` | 获取用户信息（JSON格式） |
| `syncUserInfo(userId, token, password)` | `userId`: 用户ID<br>`token`: Token<br>`password`: 密码（可选） | `JSONString` | 同步Web端用户信息到Android原生ViewModel |
| `exitActivity()` | 无 | `void` | 退出当前Activity |

### 2. 语音录制相关功能

| 接口名称 | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `startVoiceRecording()` | 无 | `string` | 开始录音，返回JSON格式结果 |
| `stopVoiceRecording()` | 无 | `string` | 停止录音，返回JSON格式结果（包含语音文件路径） |
| `cancelVoiceRecording()` | 无 | `string` | 取消录音，返回JSON格式结果 |
| `playVoiceMessage(filePath)` | `filePath`: 语音文件路径 | `string` | 播放语音消息，返回JSON格式结果 |
| `stopVoicePlayback()` | 无 | `string` | 停止播放语音，返回JSON格式结果 |
| `sendVoiceMessage(filePath, duration, chatId)` | `filePath`: 语音文件路径<br>`duration`: 时长<br>`chatId`: 会话ID | `string` | 发送语音消息，返回JSON格式结果 |
| `getVoiceRecordingStatus()` | 无 | `string` | 获取录音状态（JSON格式：isRecording, isPlaying, currentFile） |

### 3. 图片相关功能

| 接口名称 | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `selectImageFromGallery()` | 无 | `string` | 从相册选择图片，返回JSON格式结果 |
| `captureImageFromCamera()` | 无 | `string` | 拍照获取图片，返回JSON格式结果 |
| `showImagePickerDialog()` | 无 | `string` | 显示图片选择对话框（相册/拍照），返回JSON格式结果 |
| `sendImageMessage(filePath, chatId)` | `filePath`: 图片文件路径<br>`chatId`: 会话ID | `string` | 发送图片消息，返回JSON格式结果 |
| `compressImage(filePath, quality)` | `filePath`: 图片文件路径<br>`quality`: 压缩质量(0-100) | `string` | 压缩图片，返回JSON格式结果 |
| `deleteImageFile(filePath)` | `filePath`: 图片文件路径 | `string` | 删除图片文件，返回JSON格式结果 |
| `loadImageFileToBase64(filePath)` | `filePath`: 图片文件路径 | `string` | 将图片文件转换为Base64，返回JSON格式结果 |
| `checkImageResult()` | 无 | `string` | 检查拍照结果，返回JSON格式结果 |

### 4. 相机流相关功能

| 接口名称 | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `startCameraStream(width, height, frameRate, bitrate)` | `width`: 宽度<br>`height`: 高度<br>`frameRate`: 帧率<br>`bitrate`: 比特率 | `string` | 启动相机流，返回JSON格式结果 |
| `stopCameraStream()` | 无 | `string` | 停止相机流，返回JSON格式结果 |
| `isCameraStreamRunning()` | 无 | `string` | 检查相机流是否运行中，返回JSON格式结果 |

### 5. 老师对话功能（RabbitMQ）

| 接口名称 | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `createTeacherChatSession(aiSessionId, aiSessionName, subject)` | `aiSessionId`: AI会话ID<br>`aiSessionName`: AI会话名称<br>`subject`: 科目 | `string` | 创建老师对话会话，返回JSON格式结果 |
| `sendTextMessageToTeacher(content, sessionId, subject)` | `content`: 消息内容<br>`sessionId`: 会话ID<br>`subject`: 科目 | `string` | 发送文本消息给老师，返回JSON格式结果 |
| `sendVoiceMessageToTeacher(voicePath, duration, sessionId, subject)` | `voicePath`: 语音文件路径<br>`duration`: 时长<br>`sessionId`: 会话ID<br>`subject`: 科目 | `string` | 发送语音消息给老师，返回JSON格式结果 |
| `sendPictureToTeacher(imagePath, sessionId, subject)` | `imagePath`: 图片文件路径<br>`sessionId`: 会话ID<br>`subject`: 科目 | `string` | 发送图片消息给老师，返回JSON格式结果 |
| `forwardAiChatToTeacher(selectedMessagesData, teacherSessionId)` | `selectedMessagesData`: 选中的消息数据（JSON字符串）<br>`teacherSessionId`: 老师会话ID | `string` | 转发AI对话记录给老师，返回JSON格式结果 |
| `getTeacherChatHistory(sessionId)` | `sessionId`: 会话ID | `string` | 获取老师会话的消息历史，返回JSON数组 |
| `checkTeacherSessionExists(sessionId)` | `sessionId`: 会话ID | `string` | 检查老师会话是否存在，返回JSON格式结果 |
| `getCurrentSessionMessageCount(sessionId)` | `sessionId`: 会话ID | `string` | 获取当前会话的消息数量，返回JSON格式结果 |
| `initTeacherMessageListener()` | 无 | `string` | 初始化老师消息监听器，返回JSON格式结果 |
| `cleanupTeacherMessageListener()` | 无 | `string` | 清理老师消息监听器，返回JSON格式结果 |
| `isMessagingManagerInitialized()` | 无 | `boolean` | 检查消息管理器是否已初始化 |
| `isMessagingManagerConnecting()` | 无 | `boolean` | 检查消息管理器是否正在连接 |

### 6. 课堂功能（屏幕投屏）

| 接口名称 | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `joinClassroom(studentId, studentName, isGuest)` | `studentId`: 学生ID<br>`studentName`: 学生姓名<br>`isGuest`: 是否为游客模式 | `string` | 加入课堂，返回JSON格式结果 |
| `exitClassroom()` | 无 | `string` | 退出课堂，返回JSON格式结果 |
| `getClassroomStatus()` | 无 | `string` | 获取课堂状态，返回JSON格式结果 |
| `startScreenProjection()` | 无 | `string` | 开始屏幕投屏，返回JSON格式结果 |
| `stopScreenProjection()` | 无 | `string` | 停止屏幕投屏，返回JSON格式结果 |
| `takeSnapshot(commandId)` | `commandId`: 命令ID | `string` | 截图，返回JSON格式结果 |
| `setClassroomMode(classMode)` | `classMode`: 课堂模式状态 | `string` | 设置课堂模式，返回JSON格式结果 |
| `isInClassroom()` | 无 | `boolean` | 检查是否在课堂中 |
| `isProjecting()` | 无 | `boolean` | 检查是否正在投屏 |

### 7. 其他功能

| 接口名称 | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `startPhotoSearch(subject)` | `subject`: 科目 | `void` | 启动拍照搜题功能 |
| `startExerciseSolve()` | 无 | `void` | 启动习题解答页面 |
| `startExerciseSolveWebView()` | 无 | `void` | 启动习题解答WebView页面 |
| `finishActivity()` | 无 | `void` | 结束当前Activity |
| `showToastMessage(message)` | `message`: 提示消息 | `void` | 显示Toast消息 |
| `logMessage(level, message)` | `level`: 日志级别<br>`message`: 日志消息 | `void` | 记录日志到Android Logcat |
| `log(message)` | `message`: 日志消息 | `void` | 记录日志到Android Logcat |
| `disableNativeKeyboard()` | 无 | `string` | 禁用原生键盘弹出 |
| `enableNativeKeyboard()` | 无 | `string` | 启用原生键盘弹出 |
| `setConfig(config)` | `config`: 配置对象（JSON字符串） | `void` | 设置Web应用配置 |

---

## 📡 方式二：Web设置的回调函数（Android调用）

这些回调函数由Web端在`window`对象上设置，Android端通过`evaluateJavascript`调用。

### 1. 基础事件回调

| 回调函数名称 | 参数 | 说明 |
|------------|------|------|
| `window.onAndroidReady()` | 无 | Android准备就绪回调 |
| `window.onExerciseDeleted(exerciseId)` | `exerciseId`: 题目ID | 题目删除回调 |
| `window.onQuestionAdded(questionData)` | `questionData`: 题目数据（对象） | 题目添加回调 |
| `window.onProgressSaved(progressData)` | `progressData`: 进度数据（对象） | 进度保存回调 |
| `window.onDataUpdate(type, data)` | `type`: 数据类型<br>`data`: 数据（对象） | 数据更新回调 |
| `window.onExerciseListUpdated(questions)` | `questions`: 题目列表（数组） | 题目列表更新回调 |
| `window.onLoadingStateChanged(isLoading)` | `isLoading`: 是否加载中（布尔值） | 加载状态变化回调 |
| `window.onSubjectChanged(subjectName)` | `subjectName`: 科目名称（字符串） | 科目变化回调 |

### 2. 语音相关回调

| 回调函数名称 | 参数 | 说明 |
|------------|------|------|
| `window.onVoiceRecognitionResult(text)` | `text`: 识别的文本（字符串） | 语音识别结果回调 |
| `window.onVoicePlaybackCompleted(filePath)` | `filePath`: 语音文件路径（字符串） | 语音播放完成回调 |

### 3. 图片相关回调

| 回调函数名称 | 参数 | 说明 |
|------------|------|------|
| `window.onImageSelected(imageInfo)` | `imageInfo`: 图片信息（对象） | 图片选择完成回调 |
| `window.onImageCaptured(imageInfo)` | `imageInfo`: 图片信息（对象） | 拍照完成回调 |
| `window.onPhotoSearchResult(success, questionData)` | `success`: 是否成功（布尔值）<br>`questionData`: 题目数据（对象，可选） | 拍照搜题结果回调 |

### 4. 老师对话相关回调

| 回调函数名称 | 参数 | 说明 |
|------------|------|------|
| `window.onTeacherMessage(message)` | `message`: 消息对象 | 收到老师消息回调 |
| `window.onTeacherMessageReceived(messageData)` | `messageData`: 消息数据（对象） | 收到老师消息回调（别名） |
| `window.onStreamResponse(requestId, chunk, isComplete)` | `requestId`: 请求ID<br>`chunk`: 数据块（字符串）<br>`isComplete`: 是否完成（布尔值） | 流式响应回调 |
| `window.onChatResponse(requestId, response)` | `requestId`: 请求ID<br>`response`: 响应对象 | 完整响应回调 |
| `window.handleNativeChatResponse(requestId, jsonResponse)` | `requestId`: 请求ID<br>`jsonResponse`: JSON响应字符串 | 原生聊天响应回调 |
| `window.handleNativeStreamResponse(requestId, chunk, isComplete)` | `requestId`: 请求ID<br>`chunk`: 数据块（字符串）<br>`isComplete`: 是否完成（布尔值） | 原生流式响应回调 |

### 5. 课堂相关回调

| 回调函数名称 | 参数 | 说明 |
|------------|------|------|
| `window.onClassroomJoined(status)` | `status`: 课堂状态（对象） | 课堂加入完成回调 |
| `window.onClassroomExited()` | 无 | 课堂退出完成回调 |
| `window.onClassroomStatusChanged(status)` | `status`: 课堂状态（对象） | 课堂状态变化回调 |
| `window.onScreenProjectionStarted()` | 无 | 屏幕投屏开始回调 |
| `window.onScreenProjectionStopped()` | 无 | 屏幕投屏停止回调 |
| `window.onSnapshotTaken(imageData)` | `imageData`: 截图数据（对象） | 截图完成回调 |
| `window.onClassroomError(error)` | `error`: 错误信息（字符串） | 课堂错误回调 |

### 6. localStorage相关回调

| 回调函数名称 | 参数 | 返回值 | 说明 |
|------------|------|--------|------|
| `window.onGetLocalStorage(key)` | `key`: localStorage的key（字符串） | `string \| null` | 获取指定key的localStorage值，不存在返回null |
| `window.onGetAllLocalStorage()` | 无 | `string` | 获取所有localStorage数据，返回JSON字符串 |

### 7. 其他回调

| 回调函数名称 | 参数 | 说明 |
|------------|------|------|
| `window.onAndroidLog(level, tag, message)` | `level`: 日志级别<br>`tag`: 日志标签<br>`message`: 日志消息 | Android日志回调 |
| `window.onImagePickResult(success, imageUri)` | `success`: 是否成功（布尔值）<br>`imageUri`: 图片URI（字符串） | 图片选择结果回调 |
| `window.onImageCaptureResult(success, filePath, width, height, fileSize)` | `success`: 是否成功（布尔值）<br>`filePath`: 文件路径（字符串，可选）<br>`width`: 宽度（数字，可选）<br>`height`: 高度（数字，可选）<br>`fileSize`: 文件大小（数字，可选） | 拍照结果回调 |
| `window.onKeyboardClose()` | 无 | 键盘关闭回调 |

---

## 🔄 通信流程示例

### 示例1：Android调用Web接口

```javascript
// Web端调用Android接口
const token = window.AndroidBridge.getUserToken()
const userInfo = JSON.parse(window.AndroidBridge.getUserInfo())

// 发送消息给老师
const result = window.AndroidBridge.sendTextMessageToTeacher(
  "你好老师",
  "session123",
  "数学"
)
```

### 示例2：Android调用Web回调（无返回值）

```java
// Android端调用Web回调
String jsCode = "if(window.onTeacherMessageReceived){" +
                "  window.onTeacherMessageReceived(" + jsonData + ");" +
                "}";
webView.evaluateJavascript(jsCode, null);
```

```javascript
// Web端设置回调
window.onTeacherMessageReceived = (messageData) => {
  console.log('收到老师消息:', messageData)
  // 处理消息...
}
```

### 示例3：Android调用Web回调获取localStorage（有返回值）

```java
// Android端调用Web回调获取localStorage值
// 方式1：获取单个key的值
String key = "userToken";
String jsCode = String.format(
    "if(window.onGetLocalStorage){" +
    "  window.onGetLocalStorage('%s');" +
    "} else { null; }",
    key
);
webView.evaluateJavascript(jsCode, new ValueCallback<String>() {
    @Override
    public void onReceiveValue(String value) {
        // value是JSON字符串，需要解析
        // 注意：如果值为null，返回的是字符串"null"
        if (value != null && !value.equals("null")) {
            // 移除JSON字符串的引号
            String cleanValue = value.replaceAll("^\"|\"$", "");
            Log.d(TAG, "获取localStorage[" + key + "] = " + cleanValue);
        } else {
            Log.d(TAG, "localStorage[" + key + "] 不存在");
        }
    }
});

// 方式2：获取所有localStorage数据
String jsCodeAll = "if(window.onGetAllLocalStorage){" +
                   "  window.onGetAllLocalStorage();" +
                   "} else { '{}'; }";
webView.evaluateJavascript(jsCodeAll, new ValueCallback<String>() {
    @Override
    public void onReceiveValue(String jsonStr) {
        try {
            // 移除JSON字符串的引号并转义
            String cleanJson = jsonStr.replaceAll("^\"|\"$", "")
                                     .replace("\\\"", "\"")
                                     .replace("\\\\", "\\");
            JSONObject storage = new JSONObject(cleanJson);
            Log.d(TAG, "获取所有localStorage，共" + storage.length() + "项");
            // 遍历所有key-value
            Iterator<String> keys = storage.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String value = storage.getString(key);
                Log.d(TAG, "  " + key + " = " + value);
            }
        } catch (JSONException e) {
            Log.e(TAG, "解析localStorage数据失败", e);
        }
    }
});
```

```javascript
// Web端已设置的回调（在main.ts中）
window.onGetLocalStorage = (key: string): string | null => {
  return localStorage.getItem(key)
}

window.onGetAllLocalStorage = (): string => {
  const storage: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      storage[key] = localStorage.getItem(key) || ''
    }
  }
  return JSON.stringify(storage)
}
```

---

## 📝 注意事项

1. **接口可用性检查**：调用`window.AndroidBridge`的方法前，应先检查`window.AndroidBridge`是否存在
2. **JSON格式**：大部分接口返回的是JSON字符串，需要`JSON.parse()`解析
3. **异步操作**：某些操作（如图片选择、拍照）是异步的，通过回调函数返回结果
4. **线程安全**：Android端调用Web回调时，确保在主线程执行
5. **错误处理**：建议对所有接口调用进行try-catch错误处理
6. **localStorage回调返回值**：`evaluateJavascript`返回的值是JSON字符串格式，需要移除引号并处理转义字符

---

## 🛠️ Android端工具类

为了方便Android端使用localStorage回调，项目中提供了`LocalStorageHelper`工具类：

### LocalStorageHelper使用示例

```java
// 创建工具类实例
LocalStorageHelper helper = new LocalStorageHelper(webView);

// 方式1：获取单个key的值
helper.getItem("userToken", new LocalStorageHelper.ItemCallback() {
    @Override
    public void onResult(String value) {
        if (value != null) {
            Log.d(TAG, "userToken = " + value);
            // 使用value...
        } else {
            Log.d(TAG, "userToken不存在");
        }
    }
});

// 方式2：获取所有localStorage数据
helper.getAllItems(new LocalStorageHelper.AllItemsCallback() {
    @Override
    public void onResult(JSONObject storage) {
        try {
            Log.d(TAG, "获取所有localStorage，共" + storage.length() + "项");
            
            // 获取特定key的值
            if (storage.has("userToken")) {
                String token = storage.getString("userToken");
                Log.d(TAG, "userToken = " + token);
            }
            
            // 遍历所有key-value
            Iterator<String> keys = storage.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String value = storage.getString(key);
                Log.d(TAG, key + " = " + value);
            }
        } catch (JSONException e) {
            Log.e(TAG, "处理localStorage数据失败", e);
        }
    }
});
```

### LocalStorageHelper工具类位置

- **文件路径**：`app/src/main/java/com/cosinetech/imates/ui/webview/common/LocalStorageHelper.java`
- **功能**：封装了localStorage回调的调用逻辑，处理JSON字符串解析和转义字符
- **特点**：
  - 自动处理JSON字符串的引号和转义字符
  - 提供类型安全的回调接口
  - 包含错误处理和日志记录
  - 支持获取单个key或所有localStorage数据

---

## 🔗 相关文档

- [Android原生启动流程时序图.md](./Android原生启动流程时序图.md)
- [Android和Web端教师会话管理流程分析.md](./Android和Web端教师会话管理流程分析.md)
- [Web应用就绪检测问题分析与修复.md](./Web应用就绪检测问题分析与修复.md)


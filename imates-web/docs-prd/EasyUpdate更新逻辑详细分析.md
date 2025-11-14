# EasyUpdate 更新逻辑详细分析

## 一、概述

项目中使用了 **EasyUpdate**（基于 XUpdate 的简化封装）来实现应用更新功能。更新检查逻辑在三个不同的 Activity 中实现，但实现方式略有不同。

## 二、技术栈

### 2.1 核心依赖

- **XUpdate 2.1.2**：Android 应用更新框架
- **EasyUpdate 1.0.1**：XUpdate 的简化封装 API
- **OkHttp**：用于 HTTP 请求（MainWebViewActivity 中使用）
- **Handler + Runnable**：用于定时检查机制

### 2.2 更新接口 URL

根据环境配置不同：

- **正式环境（RELEASE）**：`https://www.imates.com.cn/bj101/appupdate.json`
- **测试环境（INTERNAL_TEST）**：`https://www.imates.com.cn/appupdate_test.json`

## 三、三种更新检查实现方式

### 3.1 MainWebViewActivity - HTTP请求 + EasyUpdate 方式

**位置**：`app/src/main/java/com/cosinetech/imates/ui/webview/MainWebViewActivity.java`

#### 3.1.1 实现特点

- 使用 OkHttp 先发送 HTTP 请求获取更新信息
- 解析 JSON 响应，提取版本号
- 将版本号发送到 Web 端（通过 CustomEvent）
- 然后调用 EasyUpdate.update() 执行更新检查

#### 3.1.2 代码实现

```java
// 更新检查的 Runnable，每 60 秒执行一次检查
private final Runnable mCheckUpdateRunnable = new Runnable() {
    @Override
    public void run() {
        String updateUrl = ApiUrl.URL_APP_UPDATE;
        
        // 每次检查都发送HTTP请求，判断是否需要更新
        checkUpdateWithHttpRequest(updateUrl);
        
        // 每 60 秒执行一次检查
        mCheckUpdateHandler.postDelayed(this, 60000);
    }
};
```

#### 3.1.3 更新检查流程

1. **初始化**：Activity 创建后 10 秒执行首次检查
   ```java
   private void initUpdateCheck() {
       // 启动后10秒执行首次更新检查
       mCheckUpdateHandler.postDelayed(mCheckUpdateRunnable, 10000);
   }
   ```

2. **HTTP 请求检查**：`checkUpdateWithHttpRequest()` 方法
   - 创建 OkHttp 客户端（超时时间 10 秒）
   - 发送 GET 请求到更新接口
   - 解析响应 JSON，提取 `VersionName`
   - 通过 `dispatchAppVersionEvent()` 发送版本号到 Web 端
   - 在主线程调用 `EasyUpdate.update()` 执行更新

3. **版本号通知**：将服务器版本号发送到 Web 端
   ```java
   // 发送版本号到Web端
   dispatchAppVersionEvent(serverVersion);
   
   // 调用EasyUpdate执行更新
   EasyUpdate.create(MainWebViewActivity.this, updateUrl)
           .isAutoMode(false)
           .update();
   ```

#### 3.1.4 关键代码片段

```256:320:app/src/main/java/com/cosinetech/imates/ui/webview/MainWebViewActivity.java
private void checkUpdateWithHttpRequest(String updateUrl) {
    // 创建OkHttp客户端
    OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build();
    
    // 创建请求
    Request request = new Request.Builder()
            .url(updateUrl)
            .get()
            .build();
    
    // 发送异步请求
    client.newCall(request).enqueue(new Callback() {
        @Override
        public void onFailure(Call call, IOException e) {
            // HTTP请求失败，静默处理
        }

        @Override
        public void onResponse(Call call, Response response) throws IOException {
            try {
                // 获取响应信息
                int statusCode = response.code();
                String statusMessage = response.message();
                
                // 读取响应体
                String responseBody = "";
                if (response.body() != null) {
                    responseBody = response.body().string();
                }
                
                // 解析响应JSON，提取版本号
                if (statusCode == 200 && responseBody != null && !responseBody.isEmpty()) {
                    try {
                        org.json.JSONObject jsonObj = new org.json.JSONObject(responseBody);
                        String serverVersion = jsonObj.optString("VersionName", "");
                        if (!serverVersion.isEmpty()) {
                            // 发送版本号到Web端
                            dispatchAppVersionEvent(serverVersion);
                            Log.d(TAG, "服务器版本: " + serverVersion);
                            
                            // 直接调用EasyUpdate.update()，内部会自动比较版本号并决定是否更新
                            runOnUiThread(() -> {
                                EasyUpdate.create(MainWebViewActivity.this, updateUrl)
                                        .isAutoMode(false)
                                        .update();
                            });
                        }
                    } catch (org.json.JSONException e) {
                        Log.e(TAG, "解析更新响应JSON失败", e);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "处理更新响应失败", e);
            } finally {
                if (response.body() != null) {
                    response.body().close();
                }
            }
        }
    });
}
```

#### 3.1.5 特点分析

**优点**：
- ✅ 可以获取服务器版本号并通知 Web 端
- ✅ 有详细的错误处理和日志记录
- ✅ 使用 OkHttp 可以自定义超时时间

**缺点**：
- ❌ 每次检查都会发送 HTTP 请求（没有防重复请求机制）
- ❌ 会发送两次请求（一次 OkHttp，一次 EasyUpdate 内部）
- ❌ 代码复杂度较高

### 3.2 LoginActivity - 定时器 + EasyUpdate 方式

**位置**：`app/src/main/java/com/cosinetech/imates/ui/activities/LoginActivity.java`

#### 3.2.1 实现特点

- 使用 Handler + Runnable 实现定时检查
- 每 60 秒检查一次，但只有当距离上次更新检查时间超过 1 小时时才真正发起请求
- 直接调用 EasyUpdate.update()，不进行额外的 HTTP 请求

#### 3.2.2 代码实现

```61:73:app/src/main/java/com/cosinetech/imates/ui/activities/LoginActivity.java
private final Runnable mCheckUpdateRunnable = new Runnable() {
    @Override
    public void run() {
        long tick = System.currentTimeMillis();
        if(tick - mCheckUpdateTick >= 3600000) {
            mCheckUpdateTick = tick;
            EasyUpdate.create(LoginActivity.this, ApiUrl.URL_APP_UPDATE)
                    .isAutoMode(false)
                    .update();
        }
        mCheckUpdateHandler.postDelayed(this, 60000); // 每60秒执行一次
    }
};
```

#### 3.2.3 更新检查流程

1. **初始化**：Activity 创建时初始化时间戳并启动定时器
   ```java
   mCheckUpdateTick = System.currentTimeMillis();
   mCheckUpdateHandler.postDelayed(mCheckUpdateRunnable, 60000);
   ```

2. **定时检查**：
   - 每 60 秒执行一次 Runnable
   - 计算当前时间与上次更新检查时间的差值
   - 如果差值 >= 1 小时（3600000 毫秒），执行更新检查并更新时间戳
   - 如果差值 < 1 小时，跳过本次检查

3. **执行更新**：直接调用 EasyUpdate.update()
   - EasyUpdate 内部会发送 HTTP 请求
   - 解析 JSON 响应
   - 比较版本号
   - 如果需要更新，显示更新对话框

#### 3.2.4 特点分析

**优点**：
- ✅ 有防重复请求机制（1 小时内只请求一次）
- ✅ 代码简洁，直接使用 EasyUpdate API
- ✅ 减少服务器压力

**缺点**：
- ❌ 无法获取版本号信息（不能通知 Web 端）
- ❌ 首次检查需要等待 1 小时（如果 Activity 刚创建）

### 3.3 KnowledgeGraphActivity - 定时器 + EasyUpdate 方式（带立即检查）

**位置**：`app/src/main/java/com/cosinetech/imates/ui/activities/KnowledgeGraphActivity.java`

#### 3.3.1 实现特点

- 与 LoginActivity 类似的定时器机制
- **特殊点**：在 `miscellaneousInitialization()` 方法中会立即执行一次更新检查
- 然后启动定时器，每 60 秒检查一次（但 1 小时内只真正请求一次）

#### 3.3.2 代码实现

```52:64:app/src/main/java/com/cosinetech/imates/ui/activities/KnowledgeGraphActivity.java
private final Runnable mCheckUpdateRunnable = new Runnable() {
    @Override
    public void run() {
        long tick = System.currentTimeMillis();
        if(tick - mCheckUpdateTick >= 3600000) {
            mCheckUpdateTick = tick;
            EasyUpdate.create(KnowledgeGraphActivity.this, ApiUrl.URL_APP_UPDATE)
                    .isAutoMode(false)
                    .update();
        }
        mMainHandler.postDelayed(this, 60000); // 每60秒执行一次
    }
};
```

```171:179:app/src/main/java/com/cosinetech/imates/ui/activities/KnowledgeGraphActivity.java
private void miscellaneousInitialization() {
    stopFloatingWindowService();
    startFloatingWindowService();
        EasyUpdate.create(this, ApiUrl.URL_APP_UPDATE)
                .isAutoMode(false)
                .update();
    mCheckUpdateTick = System.currentTimeMillis();
    mMainHandler.postDelayed(mCheckUpdateRunnable, 60000);
}
```

#### 3.3.3 更新检查流程

1. **立即检查**：Activity 创建时立即执行一次更新检查
   ```java
   EasyUpdate.create(this, ApiUrl.URL_APP_UPDATE)
           .isAutoMode(false)
           .update();
   ```

2. **初始化时间戳**：记录当前时间
   ```java
   mCheckUpdateTick = System.currentTimeMillis();
   ```

3. **启动定时器**：60 秒后开始定时检查
   ```java
   mMainHandler.postDelayed(mCheckUpdateRunnable, 60000);
   ```

4. **定时检查**：与 LoginActivity 相同的逻辑

#### 3.3.4 特点分析

**优点**：
- ✅ 应用启动时立即检查更新（用户体验好）
- ✅ 有防重复请求机制
- ✅ 代码简洁

**缺点**：
- ❌ 无法获取版本号信息
- ⚠️ 启动时会立即发送一次请求（可能增加服务器压力）

## 四、更新接口数据结构

### 4.1 JSON 响应格式

```json
{
  "Code": 0,
  "Msg": "",
  "UpdateStatus": 1,
  "VersionCode": 20,
  "VersionName": "1.0.20",
  "ModifyContent": "1、优化api接口。\r\n2、添加使用demo演示。",
  "DownloadUrl": "https://www.imates.com.cn/bj101/apps/app-production-release-1.0.23-23.apk",
  "ApkSize": 83496941,
  "ApkMd5": "a56325a486948935c7d99d7fd3842263"
}
```

### 4.2 字段说明

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| Code | int | 是 | 请求状态码，0表示成功，非0表示失败 |
| Msg | string | 否 | 错误信息，当Code非0时返回错误描述 |
| UpdateStatus | int | 是 | 更新状态：<br/>0 = 不更新<br/>1 = 有更新（非强制）<br/>2 = 有更新（强制升级） |
| VersionCode | int | 是 | 新版本的版本号（versionCode），用于版本比较 |
| VersionName | string | 是 | 新版本的版本名称（versionName），如"1.0.20" |
| ModifyContent | string | 否 | 更新内容描述，支持换行符（\r\n） |
| DownloadUrl | string | 是 | APK下载地址的完整URL |
| ApkSize | int | 否 | APK文件大小（字节） |
| ApkMd5 | string | 否 | APK文件的MD5校验值，用于验证文件完整性 |

### 4.3 更新状态判断逻辑

EasyUpdate（XUpdate）会根据以下逻辑判断是否需要更新：

1. **UpdateStatus = 0**：不需要更新，不显示更新对话框
2. **UpdateStatus = 1**：有更新可用，用户可以选择更新或取消
3. **UpdateStatus = 2**：强制更新，用户必须更新，可能不允许取消

**重要**：即使 `UpdateStatus` 不为 0，XUpdate 也会比较本地的 `versionCode`（在 `build.gradle` 中定义）与服务器返回的 `VersionCode`，只有当**服务器版本号 > 本地版本号**时，才会提示更新。

## 五、版本号管理

### 5.1 本地版本配置

应用版本号在 `app/build.gradle` 中配置：

```gradle
defaultConfig {
    applicationId "com.cosinetech.imates.bj101"
    minSdk 24
    targetSdk 34
    versionCode 77
    versionName "1.0.77"
}
```

- **versionCode**：内部版本号，用于版本比较（必须是递增的整数）
- **versionName**：用户可见的版本名称

### 5.2 版本比较机制

XUpdate 库会：
1. 获取本地应用的 `versionCode`（从 `PackageManager` 读取）
2. 从服务器 JSON 中获取 `VersionCode`
3. 比较两个版本号，只有当**服务器版本号 > 本地版本号**时，才提示更新

## 六、更新模式

### 6.1 自动模式 vs 非自动模式

所有三个 Activity 都使用了**非自动模式**（`isAutoMode(false)`）：

```java
EasyUpdate.create(context, updateUrl)
        .isAutoMode(false)  // 非自动模式
        .update();
```

**非自动模式（isAutoMode(false)）**：
- 下载完成后**不会**自动弹出安装界面
- 需要用户手动点击安装按钮
- 适合需要用户确认的场景

**自动模式（isAutoMode(true)）**：
- 下载完成后**自动**弹出安装界面
- 用户体验更流畅，但可能打断用户操作

## 七、生命周期管理

### 7.1 定时器启动

**MainWebViewActivity**：
```java
private void initUpdateCheck() {
    // 启动后10秒执行首次更新检查
    mCheckUpdateHandler.postDelayed(mCheckUpdateRunnable, 10000);
}
```

**LoginActivity**：
```java
mCheckUpdateTick = System.currentTimeMillis();
mCheckUpdateHandler.postDelayed(mCheckUpdateRunnable, 60000);
```

**KnowledgeGraphActivity**：
```java
// 立即执行一次更新检查
EasyUpdate.create(this, ApiUrl.URL_APP_UPDATE)
        .isAutoMode(false)
        .update();
mCheckUpdateTick = System.currentTimeMillis();
mMainHandler.postDelayed(mCheckUpdateRunnable, 60000);
```

### 7.2 定时器清理

所有 Activity 都在 `onDestroy()` 中清理定时器，防止内存泄漏：

```java
@Override
protected void onDestroy() {
    super.onDestroy();
    mCheckUpdateHandler.removeCallbacksAndMessages(null); // 彻底清除
}
```

## 八、更新流程时序图

### 8.1 MainWebViewActivity 更新流程

```
Activity onCreate
    ↓
initUpdateCheck() (延迟10秒)
    ↓
mCheckUpdateRunnable 执行
    ↓
checkUpdateWithHttpRequest()
    ↓
OkHttp 发送 HTTP 请求
    ↓
解析 JSON，提取 VersionName
    ↓
dispatchAppVersionEvent() (通知Web端)
    ↓
EasyUpdate.update() (再次请求，内部比较版本)
    ↓
如果需要更新 → 显示更新对话框
    ↓
用户确认 → 下载 APK
    ↓
下载完成 → 用户手动安装
```

### 8.2 LoginActivity/KnowledgeGraphActivity 更新流程

```
Activity onCreate
    ↓
初始化 mCheckUpdateTick
    ↓
(KnowledgeGraphActivity: 立即执行一次 EasyUpdate.update())
    ↓
启动定时器 (60秒后执行)
    ↓
mCheckUpdateRunnable 执行
    ↓
检查时间差 >= 1小时？
    ├─ 否 → 跳过，60秒后再次检查
    └─ 是 → EasyUpdate.update()
            ↓
            EasyUpdate 内部发送 HTTP 请求
            ↓
            解析 JSON，比较版本号
            ↓
            如果需要更新 → 显示更新对话框
            ↓
            用户确认 → 下载 APK
            ↓
            下载完成 → 用户手动安装
```

## 九、问题分析

### 9.1 存在的问题

1. **MainWebViewActivity 重复请求**
   - 问题：先发送 OkHttp 请求，然后又调用 EasyUpdate.update()，导致发送两次请求
   - 影响：增加服务器压力，浪费网络资源

2. **更新检查频率不一致**
   - MainWebViewActivity：每 60 秒检查一次（没有防重复机制）
   - LoginActivity：每 60 秒检查一次，但 1 小时内只真正请求一次
   - KnowledgeGraphActivity：启动时立即请求，然后每 60 秒检查一次，但 1 小时内只真正请求一次

3. **MainWebViewActivity 的特殊需求**
   - 需要将版本号发送到 Web 端，所以使用了额外的 HTTP 请求
   - 但这种方式导致重复请求

### 9.2 改进建议

1. **统一更新检查逻辑**
   - 建议：统一使用 LoginActivity/KnowledgeGraphActivity 的方式（定时器 + 防重复请求）
   - 如果需要版本号信息，可以在 EasyUpdate 的回调中获取

2. **优化 MainWebViewActivity**
   - 方案1：移除 OkHttp 请求，直接使用 EasyUpdate，通过回调获取版本号
   - 方案2：保留 OkHttp 请求获取版本号，但移除 EasyUpdate.update() 调用，避免重复请求

3. **统一首次检查时机**
   - 建议：所有 Activity 都在启动时立即检查一次（类似 KnowledgeGraphActivity）
   - 然后启动定时器，使用防重复请求机制

## 十、总结

### 10.1 当前实现总结

项目中存在三种不同的更新检查实现方式：

1. **MainWebViewActivity**：HTTP请求 + EasyUpdate（有重复请求问题）
2. **LoginActivity**：定时器 + EasyUpdate（有防重复机制）
3. **KnowledgeGraphActivity**：立即检查 + 定时器 + EasyUpdate（最佳实践）

### 10.2 推荐方案

**推荐使用 KnowledgeGraphActivity 的方式**：
- ✅ 启动时立即检查（用户体验好）
- ✅ 有防重复请求机制（减少服务器压力）
- ✅ 代码简洁
- ✅ 统一管理，易于维护

### 10.3 关键要点

1. **版本比较**：XUpdate 会自动比较 `versionCode`，只有服务器版本号大于本地版本号时才提示更新
2. **更新模式**：当前使用非自动模式，需要用户手动安装
3. **生命周期管理**：必须在 `onDestroy()` 中清理定时器
4. **防重复请求**：建议使用时间戳控制，避免频繁请求服务器


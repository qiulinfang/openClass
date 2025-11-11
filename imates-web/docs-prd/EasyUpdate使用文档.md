# EasyUpdate 使用文档

## 一、库信息

### 1.1 依赖库

EasyUpdate 是基于 XUpdate 的简化封装 API，提供更便捷的调用方式。

**项目使用的版本：**
- **XUpdate**: `2.1.2`
  - Maven坐标: `com.github.xuexiangjys:XUpdate:2.1.2`
  - GitHub: https://github.com/xuexiangjys/XUpdate
  
- **EasyUpdate**: `1.0.1`
  - Maven坐标: `com.github.xuexiangjys.XUpdateAPI:xupdate-easy:1.0.1`
  - GitHub: https://github.com/xuexiangjys/XUpdateAPI

### 1.2 依赖配置

在 `app/build.gradle` 中添加依赖：

```gradle
implementation 'com.github.xuexiangjys:XUpdate:2.1.2'
implementation 'com.github.xuexiangjys.XUpdateAPI:xupdate-easy:1.0.1'
```

## 二、基本使用

### 2.1 最简单的使用方式

```java
import com.xuexiang.xupdate.easy.EasyUpdate;

// 基本调用
EasyUpdate.create(context, updateUrl)
        .update();
```

### 2.2 完整示例

```java
EasyUpdate.create(MainWebViewActivity.this, updateUrl)
        .isAutoMode(true)  // 设置自动模式
        .update();
```

## 三、API 方法说明

### 3.1 create() 方法

创建 EasyUpdate 实例。

**方法签名：**
```java
public static EasyUpdate create(Context context, String updateUrl)
```

**参数说明：**
- `context`: Android 上下文对象（Activity 或 Application）
- `updateUrl`: 更新接口的 URL 地址，返回更新信息的 JSON

**返回值：**
- `EasyUpdate` 实例，用于链式调用

### 3.2 isAutoMode() 方法

设置更新模式。

**方法签名：**
```java
public EasyUpdate isAutoMode(boolean isAuto)
```

**参数说明：**
- `isAuto`: 
  - `true` - **自动模式**：下载完成后自动弹出安装界面
  - `false` - **非自动模式**：下载完成后需要用户手动点击安装按钮

**返回值：**
- `EasyUpdate` 实例，支持链式调用

**使用示例：**
```java
// 自动模式：下载完成后自动安装
EasyUpdate.create(context, updateUrl)
        .isAutoMode(true)
        .update();

// 非自动模式：需要用户手动安装
EasyUpdate.create(context, updateUrl)
        .isAutoMode(false)
        .update();
```

### 3.3 update() 方法

执行更新检查。

**方法签名：**
```java
public void update()
```

**功能：**
- 向服务器发送 HTTP 请求，获取更新信息 JSON
- 解析 JSON 数据，判断是否需要更新
- 如果需要更新，显示更新对话框
- 用户确认后开始下载 APK
- 下载完成后根据 `isAutoMode` 设置决定是否自动安装

## 四、更新接口 JSON 格式

### 4.1 标准格式

更新接口需要返回以下 JSON 格式：

```json
{
  "Code": 0,
  "Msg": "",
  "UpdateStatus": 1,
  "VersionCode": 3,
  "VersionName": "1.0.2",
  "ModifyContent": "1、优化api接口。\r\n2、添加使用demo演示。",
  "DownloadUrl": "https://www.imates.com.cn/apps/app-1.0.18-18.apk",
  "ApkSize": 2048,
  "ApkMd5": "..."
}
```

### 4.2 字段说明

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| Code | int | 是 | 请求状态码，0表示成功，非0表示失败 |
| Msg | string | 否 | 错误信息，当Code非0时返回错误描述 |
| UpdateStatus | int | 是 | 更新状态：<br/>0 = 不更新<br/>1 = 有更新（非强制）<br/>2 = 有更新（强制升级） |
| VersionCode | int | 是 | 新版本的版本号（versionCode），用于版本比较 |
| VersionName | string | 是 | 新版本的版本名称（versionName），如"1.0.18" |
| ModifyContent | string | 否 | 更新内容描述，支持换行符（\r\n） |
| DownloadUrl | string | 是 | APK下载地址的完整URL |
| ApkSize | int | 否 | APK文件大小（字节） |
| ApkMd5 | string | 否 | APK文件的MD5校验值，用于验证文件完整性 |

### 4.3 更新状态说明

- **UpdateStatus = 0**：不需要更新，不显示更新对话框
- **UpdateStatus = 1**：有更新可用，用户可以选择更新或取消
- **UpdateStatus = 2**：强制更新，用户必须更新，可能不允许取消

## 五、版本比较机制

XUpdate 库会自动比较版本号：

1. 获取本地应用的 `versionCode`（在 `build.gradle` 中定义）
2. 从服务器 JSON 中获取 `VersionCode`
3. 只有当 **服务器版本号 > 本地版本号** 时，才会提示更新

**注意：** 即使 `UpdateStatus` 不为 0，如果服务器版本号不大于本地版本号，也不会提示更新。

## 六、项目中的使用示例

### 6.1 MainWebViewActivity 中的使用

```java
EasyUpdate.create(MainWebViewActivity.this, updateUrl)
        .isAutoMode(true)  // 自动模式：下载完成后自动弹出安装界面
        .update();
```

### 6.2 LoginActivity 中的使用

```java
EasyUpdate.create(LoginActivity.this, ApiUrl.URL_APP_UPDATE)
        .isAutoMode(false)  // 非自动模式：需要用户手动安装
        .update();
```

### 6.3 KnowledgeGraphActivity 中的使用

```java
EasyUpdate.create(KnowledgeGraphActivity.this, ApiUrl.URL_APP_UPDATE)
        .isAutoMode(false)  // 非自动模式：需要用户手动安装
        .update();
```

## 七、注意事项

### 7.1 权限配置

确保在 `AndroidManifest.xml` 中配置了必要的权限：

```xml
<!-- 网络权限 -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- 安装权限（Android 8.0+） -->
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
```

### 7.2 FileProvider 配置

如果需要在 Android 7.0+ 上安装 APK，需要配置 FileProvider：

```xml
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>
```

### 7.3 自动模式 vs 非自动模式

**自动模式 (`isAutoMode(true)`)：**
- ✅ 下载完成后自动弹出安装界面
- ✅ 用户体验更好，无需额外操作
- ⚠️ 需要确保已授予"安装未知应用"权限（Android 8.0+）

**非自动模式 (`isAutoMode(false)`)：**
- ✅ 下载完成后需要用户手动点击安装按钮
- ✅ 给用户更多控制权
- ⚠️ 用户可能忘记安装，导致更新未完成

### 7.4 网络请求

- 更新检查需要网络连接，需要考虑网络异常情况
- 建议在调用前检查网络状态
- 可以考虑添加重试机制

### 7.5 MD5 校验

- 建议在服务器端提供 `ApkMd5` 值
- 如果提供了 MD5，XUpdate 会验证下载的 APK 完整性
- 如果没有 MD5，每次都会重新下载

## 八、官方资源

### 8.1 GitHub 仓库

- **XUpdate 主仓库**: https://github.com/xuexiangjys/XUpdate
- **XUpdateAPI 仓库**: https://github.com/xuexiangjys/XUpdateAPI

### 8.2 文档链接

- XUpdate Wiki: https://github.com/xuexiangjys/XUpdate/wiki
- XUpdate README: https://github.com/xuexiangjys/XUpdate/blob/master/README.md

### 8.3 版本信息

- **当前项目使用版本**: 
  - XUpdate: `2.1.2`
  - EasyUpdate: `1.0.1`

## 九、常见问题

### 9.1 为什么下载完成后没有自动安装？

**可能原因：**
1. 使用了 `isAutoMode(false)`，需要手动安装
2. Android 8.0+ 未授予"安装未知应用"权限
3. FileProvider 配置不正确

**解决方案：**
1. 使用 `isAutoMode(true)` 启用自动模式
2. 在代码中请求安装权限（参考 `PermissionHelper.java`）
3. 检查 `AndroidManifest.xml` 中的 FileProvider 配置

### 9.2 为什么没有弹出更新对话框？

**可能原因：**
1. 服务器返回的 `VersionCode` 不大于本地版本号
2. `UpdateStatus` 为 0（不需要更新）
3. 网络请求失败
4. JSON 格式不正确

**解决方案：**
1. 检查服务器返回的 `VersionCode` 是否大于本地 `versionCode`
2. 检查 `UpdateStatus` 字段值
3. 检查网络连接和服务器接口
4. 验证 JSON 格式是否正确

### 9.3 如何自定义更新对话框？

EasyUpdate 是简化 API，如果需要自定义更新对话框，建议使用 XUpdate 的完整 API。

参考 XUpdate 官方文档：https://github.com/xuexiangjys/XUpdate/wiki

## 十、相关文件

- **更新逻辑分析文档**: `imates-web/docs-prd/src/安卓应用更新逻辑分析.md`
- **使用示例代码**:
  - `app/src/main/java/com/cosinetech/imates/ui/webview/MainWebViewActivity.java`
  - `app/src/main/java/com/cosinetech/imates/ui/activities/LoginActivity.java`
  - `app/src/main/java/com/cosinetech/imates/ui/activities/KnowledgeGraphActivity.java`




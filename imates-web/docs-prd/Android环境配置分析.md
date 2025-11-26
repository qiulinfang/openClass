# Android原生环境配置分析

## 一、环境配置概述

本项目采用**动态环境切换**机制，支持在运行时通过密码验证切换测试环境和正式环境，无需重新打包应用。

### 环境类型

项目定义了两种环境类型（`AppEnvConfig.java`）：

| 环境类型 | 枚举值 | 显示名称 | 说明 |
|---------|--------|---------|------|
| 正式环境 | `RELEASE` | `""` | 默认环境，生产环境 |
| 测试环境 | `INTERNAL_TEST` | `"Joined Testflight"` | 内部测试环境 |

---

## 二、核心配置文件

### 1. AppEnvConfig.java
**位置**: `app/src/main/java/com/cosinetech/imates/appenv/AppEnvConfig.java`

**核心功能**:
- 环境类型枚举定义
- 环境切换逻辑（带密码验证）
- 环境持久化存储（SharedPreferences）
- 版本信息获取

**关键配置**:
```java
// 测试环境切换密码
private static final String TEST_ENV_PASSWORD = "985211";

// SharedPreferences存储
private static final String PREFS_NAME = "app_env_config";
private static final String KEY_ENV_TYPE = "env_type";
```

**环境切换规则**:
- 正式环境 → 测试环境：需要密码 `985211`
- 测试环境 → 正式环境：无需密码

### 2. ApiUrl.java
**位置**: `app/src/main/java/com/cosinetech/imates/coreapiservice/ApiUrl.java`

**核心功能**: 根据环境类型配置所有API端点

---

## 三、环境差异对比

### 正式环境 (RELEASE)

| 配置项 | 值 |
|--------|-----|
| **基础API地址** | `http://www.imates.com.cn:8222/blw-edu-service-alc` |
| **资源基础地址** | `https://www.imates.com.cn` |
| **应用更新配置** | `https://www.imates.com.cn/appupdate.json` |
| **MQ主机地址** | `www.imates.com.cn` |
| **MQ端口** | `5673` |
| **Zammad服务** | `http://app.imates.com.cn:8080/api/v1` |

### 测试环境 (INTERNAL_TEST)

| 配置项 | 值 |
|--------|-----|
| **基础API地址** | `http://www.imates.com.cn:9222/blw-edu-service-alc` |
| **资源基础地址** | `https://www.imates.com.cn` |
| **应用更新配置** | `https://www.imates.com.cn/appupdate_test.json` |
| **MQ主机地址** | `www.imates.com.cn` |
| **MQ端口** | `5673` |
| **Zammad服务** | `http://app.imates.com.cn:8080/api/v1` |

### 主要差异

**最关键的差异是端口号**：
- 正式环境使用 `8222` 端口
- 测试环境使用 `9222` 端口
- 更新配置文件不同（`appupdate.json` vs `appupdate_test.json`）

---

## 四、API端点配置

所有API端点通过 `ApiUrl.switchEnv()` 方法动态生成，基于 `baseUrl` 拼接：

### 主要API端点

```java
// 用户相关
URL_LOGIN = baseUrl + "/admin/login";
URL_USER_INFO = baseUrl + "/admin/info";

// 搜题相关
URL_QUESTION_IMAGE_RECOGNISE_BIOLOGY = baseUrl + "/permission/img";          // 生物拍题
URL_QUESTION_IMAGE_RECOGNISE_MATH = baseUrl + "/permission/imgMath";         // 数学拍题
URL_QUESTION_TEXT_SEARCH_BIOLOGY = baseUrl + "/permission/textSearch";       // 生物文本搜题
URL_QUESTION_TEXT_SEARCH_MATH = baseUrl + "/permission/textSearchMath";      // 数学文本搜题

// AI对话相关
URL_CHAT_GENERAL = baseUrl + "/permission/chats";                            // 通用AI对话
URL_CHAT_PREVIEW_PICTURE = baseUrl + "/permission/previewPictureQA";         // 截图问答
URL_CHAT_BIOLOGY = baseUrl + "/permission/chat";                             // 生物引导解题
URL_CHAT_MATH = baseUrl + "/permission/chatMath";                            // 数学引导解题

// 习题相关
URL_ADD_EXERCISE_TO_LIST = baseUrl + "/permission/exercises";                // 上传习题
URL_GET_EXERCISE_BIOLOGY = baseUrl + "/permission/selectExercises/biology";  // 查询生物习题
URL_GET_EXERCISE_MATH = baseUrl + "/permission/selectExercises/math";        // 查询数学习题
URL_DELETE_EXERCISE_BASE = baseUrl + "/permission/deleteExercises";          // 删除习题

// 知识点相关
URL_QUERY_SIMILAR_EXERCISE = baseUrl + "/permission/topicAndAck";            // 查询相似题
URL_QUERY_SIMILAR_EXERCISE_BY_KNOWLEDGE = baseUrl + "/biologyTopicKnowledge/knowledgeTopicAndAck";
```

**特殊端点**（固定地址，不随环境变化）：
```java
URL_QUERY_KNOWLEDGE_ID_BY_CHAPTER_ID = "http://www.imates.com.cn:8090/knowledge";
```

---

## 五、环境切换机制

### 1. 初始化流程

**触发时机**: `LoginActivity.onCreate()`
```java
AppEnvConfig.checkAndUpdateVersion(this);
```

**初始化逻辑**:
1. 从SharedPreferences读取保存的环境类型
2. 如果未设置，默认使用正式环境
3. 调用 `ApiUrl.switchEnv()` 配置所有API端点

### 2. 切换界面

**辅助类**: 
- `AppEnvSwitchHelper.java`: 提供切换入口
- `AppEnvSwitchDialog.java`: 显示切换对话框

**用户交互**:
- 当前正式环境：显示"加入测试通道"对话框，需要输入密码
- 当前测试环境：显示"离开测试通道"对话框，无需密码

### 3. 环境持久化

```java
// 保存环境类型到SharedPreferences
SharedPreferences prefs = context.getSharedPreferences("app_env_config", Context.MODE_PRIVATE);
prefs.edit().putString("env_type", targetEnv.name()).apply();
```

---

## 六、构建配置

### Gradle配置 (app/build.gradle)

```gradle
android {
    namespace 'com.cosinetech.imates'
    compileSdk 34
    
    defaultConfig {
        applicationId "com.cosinetech.imates"
        minSdk 24
        targetSdk 34
        versionCode 67
        versionName "1.0.67"
    }
    
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.debug  // 使用debug签名
        }
    }
}
```

**关键点**:
- 项目使用 **单一构建类型**（release）
- **没有使用 productFlavors** 区分环境
- 环境切换完全通过运行时动态配置实现
- APK输出命名格式：`app-{versionName}-{versionCode}.apk`

### APK自动生成信息

构建时自动生成APK信息文件：
```json
{
  "fileName": "app-1.0.67-67.apk",
  "filePath": "/path/to/apk",
  "fileSize": 12345678,
  "md5Checksum": "abc123..."
}
```

---

## 七、应用更新配置

### 正式环境更新配置
**文件**: `appupdate.json`
**URL**: `https://www.imates.com.cn/appupdate.json`

### 测试环境更新配置
**文件**: `appupdate_test.json`
**URL**: `https://www.imates.com.cn/appupdate_test.json`

### 配置格式
```json
{
  "Code": 0,
  "Msg": "",
  "UpdateStatus": 1,          // 更新状态：1-需要更新
  "VersionCode": 18,          // 版本号
  "VersionName": "1.0.18",    // 版本名称
  "ModifyContent": "更新内容说明",
  "DownloadUrl": "https://www.imates.com.cn/apps/app-1.0.18-18.apk",
  "ApkSize": 224800,          // APK大小（字节）
  "ApkMd5": ""                // APK MD5校验码
}
```

---

## 八、优点与缺点

### 优点

1. **无需重新打包**: 同一个APK可以切换环境，方便测试
2. **用户友好**: 通过密码保护，避免误切换到测试环境
3. **灵活性高**: 可以在生产环境下临时切换到测试环境调试
4. **配置集中**: 所有环境配置集中在两个类中管理

### 缺点

1. **安全性**: 测试环境密码硬编码在代码中（`985211`）
2. **包体积**: 正式包中包含了测试环境的代码和配置
3. **易混淆**: 用户可能误操作切换环境
4. **不符合标准实践**: 标准做法是使用 `productFlavors` 在编译期区分环境

---

## 九、改进建议

### 1. 使用 productFlavors 区分环境

```gradle
android {
    flavorDimensions "environment"
    
    productFlavors {
        release {
            dimension "environment"
            buildConfigField "String", "BASE_URL", "\"http://www.imates.com.cn:8222/blw-edu-service-alc\""
            buildConfigField "int", "API_PORT", "8222"
        }
        
        test {
            dimension "environment"
            applicationIdSuffix ".test"
            buildConfigField "String", "BASE_URL", "\"http://www.imates.com.cn:9222/blw-edu-service-alc\""
            buildConfigField "int", "API_PORT", "9222"
        }
    }
}
```

### 2. 使用环境变量

将敏感配置放在 `local.properties` 或环境变量中：
```properties
# local.properties
api.base.url.release=http://www.imates.com.cn:8222/blw-edu-service-alc
api.base.url.test=http://www.imates.com.cn:9222/blw-edu-service-alc
env.switch.password=985211
```

### 3. 独立测试通道

为测试版本使用不同的 `applicationId`：
```gradle
test {
    applicationIdSuffix ".test"  // 包名变为 com.cosinetech.imates.test
    versionNameSuffix "-test"    // 版本名显示为 1.0.67-test
}
```

这样测试版和正式版可以同时安装，互不影响。

### 4. 使用签名配置区分

```gradle
signingConfigs {
    release {
        storeFile file("release.keystore")
        storePassword "xxx"
        keyAlias "release"
        keyPassword "xxx"
    }
    
    test {
        storeFile file("test.keystore")
        // ...
    }
}
```

---

## 十、总结

### 当前实现方式
- **动态运行时切换**：通过SharedPreferences保存环境类型，运行时动态配置API地址
- **密码保护**：切换到测试环境需要密码 `985211`
- **单APK多环境**：同一个APK包含正式和测试环境配置

### 核心差异
- **API端口**: 正式环境 `8222`，测试环境 `9222`
- **更新配置**: 使用不同的JSON文件
- **其他配置**: MQ、资源地址等基本相同

### 建议
考虑迁移到标准的 `productFlavors` 方案，可以：
- 提高安全性（测试代码不进入生产包）
- 减小正式包体积
- 符合Android开发最佳实践
- 便于CI/CD自动化构建

---

**文档生成时间**: 2025-11-26
**项目版本**: 1.0.67 (versionCode 67)

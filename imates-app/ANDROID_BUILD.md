# imates-app Android APK 本地打包流程

## 1. 环境准备

需要安装：

- Node.js 20 或 22
- JDK 17 或 21
- Android Studio 与 Android SDK
- Android SDK Platform 36、Build Tools 36、NDK 27.1.12297006

macOS 可设置：

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

## 2. 一键生成三个可并存安装的 APK

在项目目录执行：

```bash
cd /Users/chuwenlong/Desktop/yxCode/openClass/imates-app
npm run build:android:all
```

一次生成：

```text
手机学伴.apk
手机学伴内测版.apk
手机学伴开发版.apk
```

三版使用不同包名，可同时安装：

| 构建 | 桌面名称 | Android 包名 | 接口 | 网络调试 |
| --- | --- | --- | --- | --- |
| 正式版 | 手机学伴 | `com.cosinetech.imates.edu` | 正式 | 关闭 |
| 正式调试版 | 手机学伴内测版 | `com.cosinetech.imates.edu.internal` | 正式 | 开启 |
| 测试版 | 手机学伴开发版 | `com.cosinetech.imates.edu.development` | 测试 | 开启 |

也可以单独构建：

```bash
npm run build:android:release
npm run build:android:internal
npm run build:android:development
```

内测版和开发版在所有页面提供全局 `NET` 网络仪表台，可查看每个 Fetch 接口的请求、响应、耗时和完整错误，敏感字段会自动遮盖。

## 3. 完全手动执行

首次拉取项目：

```bash
cd /Users/chuwenlong/Desktop/yxCode/openClass/imates-app
npm ci
npx expo install --check
npm run build:pdf-explore-viewer
npx tsc --noEmit
npx expo prebuild --platform android --no-install
```

生成 APK：

```bash
cd android
NODE_ENV=production \
EXPO_PUBLIC_APP_ENV=RELEASE \
EXPO_PUBLIC_BUILD_CHANNEL=RELEASE \
./gradlew \
  -Pimates.applicationId=com.cosinetech.imates.edu \
  -Pimates.appName=手机学伴 \
  assembleRelease
```

Gradle 原始产物位于：

```text
android/app/build/outputs/apk/release/app-release.apk
```

修改 `app.json`、Expo 插件或原生依赖后，可重新生成 Android 工程：

```bash
npx expo prebuild --clean --platform android
```

注意：`--clean` 会重建 `android` 目录；如果手动改过原生代码，应先备份或提交改动。

## 4. 测试安装

手机开启 USB 调试并连接电脑后：

```bash
adb devices
adb install -r 手机学伴.apk
adb install -r 手机学伴内测版.apk
adb install -r 手机学伴开发版.apk
```

若手机中已有同包名但签名不同的版本，需要先卸载旧版本；卸载会清除该应用的本地数据。

## 5. 正式发布签名

当前 Expo 生成的 `release` 配置使用 Android Debug 证书，只适合内部安装测试，不能作为应用商店正式包。

创建正式 keystore：

```bash
keytool -genkeypair -v \
  -keystore imates-upload.jks \
  -alias imates-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

不要把 keystore 或密码提交到 Git。将路径和密码放入用户级 `~/.gradle/gradle.properties`：

```properties
IMATES_UPLOAD_STORE_FILE=/绝对路径/imates-upload.jks
IMATES_UPLOAD_KEY_ALIAS=imates-upload
IMATES_UPLOAD_STORE_PASSWORD=替换为真实密码
IMATES_UPLOAD_KEY_PASSWORD=替换为真实密码
```

然后在 `android/app/build.gradle` 中增加正式 `signingConfigs.release`，并将 `buildTypes.release.signingConfig` 改为 `signingConfigs.release`。再次运行：

```bash
cd android
NODE_ENV=production EXPO_PUBLIC_APP_ENV=RELEASE ./gradlew assembleRelease
```

由于本项目的 `android` 目录由 Expo 生成且被 Git 忽略，重新执行 `prebuild --clean` 会丢失手动签名配置。长期发布建议将签名配置写成 Expo config plugin，或者使用 EAS Build 管理正式证书。

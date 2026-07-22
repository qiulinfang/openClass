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

## 2. 一键生成可安装 APK

在项目目录执行：

```bash
cd /Users/chuwenlong/Desktop/yxCode/openClass/imates-app
npm run build:android:internal
```

内测版使用正式接口，显示“内测版”标识，并在所有页面提供全局 `NET` 网络仪表台。仪表台可查看每一个 Fetch 接口的请求、响应、耗时和完整错误，敏感字段会自动遮盖：

```text
imates-app/imates-app-internal.apk
```

生成正式版：

```bash
npm run build:android:release
```

正式版使用正式接口，显示“正式版”标识，只向用户显示安全、简洁的错误提示：

```text
imates-app/imates-app-release.apk
```

也可以直接执行 `./scripts/build-android-apk.sh internal` 或 `./scripts/build-android-apk.sh release`。脚本会依次检查依赖、生成 PDF viewer、执行 TypeScript 检查、生成 Android 原生工程，并运行 `assembleRelease`。

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
NODE_ENV=production EXPO_PUBLIC_APP_ENV=RELEASE ./gradlew assembleRelease
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
adb install -r imates-app-release.apk
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
